import argon2 from 'argon2';
import prisma from '../../utils/prisma.js';
import logger from '../../utils/logger.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { RevocationRegistry } from '../../middlewares/authMiddleware.js';

export class UsersService {
  /**
   * Lists user accounts with role and commune relations.
   */
  static async listUsers({ page = 1, limit = 20, search = '' }) {
    const skip = (page - 1) * limit;
    const where = search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phoneNumber: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          phoneNumber: true,
          firstName: true,
          lastName: true,
          isActive: true,
          createdAt: true,
          commune: { select: { id: true, code: true, name: true } },
          roles: { include: { role: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      items: users.map((u) => ({
        ...u,
        roles: u.roles.map((ur) => ur.role.name),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieves single user details.
   */
  static async getUserById(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phoneNumber: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
        commune: { select: { id: true, code: true, name: true } },
        roles: { include: { role: true } },
      },
    });

    if (!user) {
      throw new AppError('Utilisateur introuvable.', 404, 'USER_NOT_FOUND');
    }

    return {
      ...user,
      roles: user.roles.map((ur) => ur.role.name),
    };
  }

  /**
   * Creates a new system user account.
   */
  static async createUser(data, actorUser) {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { phoneNumber: data.phoneNumber },
          ...(data.email ? [{ email: data.email }] : []),
        ],
      },
    });

    if (existing) {
      throw new AppError(
        'Un compte avec ce numéro de téléphone ou cet email existe déjà.',
        409,
        'USER_ALREADY_EXISTS'
      );
    }

    const defaultPassword = data.password || 'DevAotuc2026!';
    const passwordHash = await argon2.hash(defaultPassword);

    const created = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          email: data.email || null,
          phoneNumber: data.phoneNumber,
          passwordHash,
          communeId: data.communeId || null,
          isActive: data.isActive !== undefined ? data.isActive : true,
        },
      });

      if (data.role) {
        const roleRecord = await tx.role.findUnique({
          where: { name: data.role },
        });

        if (roleRecord) {
          await tx.userRole.create({
            data: {
              userId: newUser.id,
              roleId: roleRecord.id,
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          actorId: actorUser.id,
          action: 'USER_ACCOUNT_CREATED',
          targetModule: 'USERS',
          targetRecordId: newUser.id,
          newValues: {
            email: newUser.email,
            phoneNumber: newUser.phoneNumber,
            role: data.role,
          },
        },
      });

      return newUser;
    });

    return this.getUserById(created.id);
  }

  /**
   * Updates an existing user account.
   */
  static async updateUser(userId, data, actorUser) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('Utilisateur introuvable.', 404, 'USER_NOT_FOUND');
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.firstName ? { firstName: data.firstName.trim() } : {}),
        ...(data.lastName ? { lastName: data.lastName.trim() } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.communeId !== undefined ? { communeId: data.communeId } : {}),
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: actorUser.id,
        action: 'USER_ACCOUNT_UPDATED',
        targetModule: 'USERS',
        targetRecordId: userId,
        newValues: data,
      },
    });

    return this.getUserById(userId);
  }

  /**
   * Activates or deactivates a user account.
   * Immediately invalidates active token sessions when deactivated!
   */
  static async setUserStatus(userId, isActive, actorUser) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('Utilisateur introuvable.', 404, 'USER_NOT_FOUND');
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isActive: Boolean(isActive) },
    });

    if (isActive) {
      RevocationRegistry.reactivateUser(userId);
      logger.info('User account reactivated by admin', { userId, actorId: actorUser.id });
    } else {
      RevocationRegistry.deactivateUser(userId);
      logger.warn('User account deactivated by admin - sessions invalidated', {
        userId,
        actorId: actorUser.id,
      });
    }

    await prisma.auditLog.create({
      data: {
        actorId: actorUser.id,
        action: isActive ? 'USER_ACCOUNT_REACTIVATED' : 'USER_ACCOUNT_DEACTIVATED',
        targetModule: 'USERS',
        targetRecordId: userId,
        newValues: { isActive },
      },
    });

    return {
      id: updated.id,
      isActive: updated.isActive,
      message: isActive
        ? 'Compte utilisateur réactivé avec succès.'
        : 'Compte utilisateur désactivé. Sessions actives immédiatement révoquées.',
    };
  }
}

export default UsersService;
