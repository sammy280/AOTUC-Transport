import crypto from 'crypto';
import argon2 from 'argon2';
import prisma from '../../utils/prisma.js';
import logger from '../../utils/logger.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { RevocationRegistry } from '../../middlewares/authMiddleware.js';

/**
 * Generates a cryptographically strong, human-readable random password.
 * Format guarantees uppercase, lowercase, numbers, and special symbols.
 */
export function generateSecurePassword(length = 14) {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$%&*';
  const all = upper + lower + numbers + symbols;

  const chars = [
    upper[crypto.randomInt(upper.length)],
    lower[crypto.randomInt(lower.length)],
    numbers[crypto.randomInt(numbers.length)],
    symbols[crypto.randomInt(symbols.length)],
  ];

  for (let i = chars.length; i < length; i++) {
    chars.push(all[crypto.randomInt(all.length)]);
  }

  // Fisher-Yates cryptographically-safe shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}

/**
 * Normalizes phone numbers to standard Guinean E.164 (+224...).
 */
export function normalizePhoneNumber(raw) {
  if (!raw) return raw;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('00224') && digits.length >= 14) {
    return `+${digits.slice(2)}`;
  }
  if (digits.startsWith('224') && digits.length >= 11) {
    return `+${digits}`;
  }
  if (digits.length === 9) {
    return `+224${digits}`;
  }
  return String(raw).trim();
}

const SLUG_TO_COMMUNE_CODE = {
  'COMM-KLM': 'KLM',
  'CM-KALOUM': 'KLM',
  'COMM-DXN': 'DXN',
  'CM-DIXINN': 'DXN',
  'COMM-MTM': 'MTM',
  'CM-MATAM': 'MTM',
  'COMM-RTM': 'RTM',
  'CM-RATOMA': 'RTM',
  'COMM-MTT': 'MTT',
  'CM-MATOTO': 'MTT',
  'COMM-KSS': 'KSS',
  'CM-KASSA': 'KSS',
};

async function resolveCommuneIdentifier(communeId, communeCode) {
  const candidate = (communeId || communeCode || '').toString().trim();
  if (!candidate) return null;

  const upper = candidate.toUpperCase();
  const mappedCode = SLUG_TO_COMMUNE_CODE[upper] || upper;

  const commune = await prisma.commune.findFirst({
    where: {
      OR: [
        { id: candidate },
        { code: { equals: mappedCode, mode: 'insensitive' } },
        { name: { equals: candidate, mode: 'insensitive' } },
      ],
    },
    select: { id: true },
  });

  return commune ? commune.id : null;
}

async function resolveValidActorId(txOrPrisma, rawActorId) {
  if (!rawActorId) return null;
  try {
    const found = await txOrPrisma.user.findUnique({
      where: { id: String(rawActorId) },
      select: { id: true },
    });
    return found ? found.id : null;
  } catch (_) {
    return null;
  }
}

export class UsersService {
  /**
   * Lists user accounts with role, commune relations, and jobTitle.
   */
  static async listUsers({ page = 1, limit = 50, search = '' }) {
    const skip = (page - 1) * limit;
    const where = search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phoneNumber: { contains: search, mode: 'insensitive' } },
            { jobTitle: { contains: search, mode: 'insensitive' } },
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
          jobTitle: true,
          avatarUrl: true,
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
        jobTitle: true,
        avatarUrl: true,
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
   * Creates a new system user account with secure password, email, role, and job/work assignment.
   */
  static async createUser(data, actorUser) {
    const normalizedPhone = normalizePhoneNumber(data.phoneNumber);
    const normalizedEmail = data.email ? data.email.trim().toLowerCase() : null;

    // 1. Check for duplicates
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { phoneNumber: normalizedPhone },
          ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
        ],
      },
    });

    if (existing) {
      if (existing.phoneNumber === normalizedPhone) {
        throw new AppError(
          `Un compte avec le numéro de téléphone ${normalizedPhone} existe déjà.`,
          409,
          'PHONE_ALREADY_EXISTS'
        );
      }
      throw new AppError(
        `Un compte avec l'adresse email ${normalizedEmail} existe déjà.`,
        409,
        'EMAIL_ALREADY_EXISTS'
      );
    }

    // 2. Resolve commune (accepts UUID, commune code, slug like comm-mtt, or commune name)
    const resolvedCommuneId = await resolveCommuneIdentifier(
      data.communeId,
      data.communeCode
    );

    // 3. Password selection: use provided or generate strong unique password
    const plainPassword =
      data.password && data.password.trim().length >= 8
        ? data.password.trim()
        : generateSecurePassword(14);

    const passwordHash = await argon2.hash(plainPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const created = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          email: normalizedEmail,
          phoneNumber: normalizedPhone,
          jobTitle: data.jobTitle ? data.jobTitle.trim() : null,
          avatarUrl: data.avatarUrl ? data.avatarUrl.trim() : null,
          passwordHash,
          communeId: resolvedCommuneId,
          isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
        },
      });

      if (data.role) {
        let roleRecord = await tx.role.findUnique({
          where: { name: data.role },
        });
        if (!roleRecord && tx.role.upsert) {
          roleRecord = await tx.role.upsert({
            where: { name: data.role },
            update: {},
            create: { name: data.role, description: `Rôle ${data.role}` },
          });
        }

        if (roleRecord) {
          await tx.userRole.create({
            data: {
              userId: newUser.id,
              roleId: roleRecord.id,
            },
          });
        }
      }

      const validActorId = await resolveValidActorId(tx, actorUser?.id);

      await tx.auditLog.create({
        data: {
          actorId: validActorId,
          action: 'USER_ACCOUNT_CREATED',
          targetModule: 'USERS',
          targetRecordId: newUser.id,
          newValues: {
            email: newUser.email,
            phoneNumber: newUser.phoneNumber,
            role: data.role,
            jobTitle: newUser.jobTitle,
            communeId: newUser.communeId,
            createdByActor: actorUser?.id || null,
          },
        },
      });

      return newUser;
    });

    const fullUser = await this.getUserById(created.id);
    return {
      ...fullUser,
      temporaryPassword: plainPassword,
    };
  }

  /**
   * Updates an existing user account.
   */
  static async updateUser(userId, data, actorUser) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('Utilisateur introuvable.', 404, 'USER_NOT_FOUND');
    }

    // Resolve commune if communeId or communeCode provided
    let resolvedCommuneId = undefined;
    if (data.communeId !== undefined || data.communeCode !== undefined) {
      resolvedCommuneId = await resolveCommuneIdentifier(data.communeId, data.communeCode);
    }

    const normalizedPhone = data.phoneNumber ? normalizePhoneNumber(data.phoneNumber) : undefined;
    const normalizedEmail = data.email !== undefined ? (data.email ? data.email.trim().toLowerCase() : null) : undefined;

    // Check duplicate phone or email if changing
    if (normalizedPhone && normalizedPhone !== user.phoneNumber) {
      const dup = await prisma.user.findUnique({ where: { phoneNumber: normalizedPhone } });
      if (dup) {
        throw new AppError(`Le numéro de téléphone ${normalizedPhone} est déjà utilisé.`, 409, 'PHONE_ALREADY_EXISTS');
      }
    }
    if (normalizedEmail && normalizedEmail !== user.email) {
      const dup = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (dup) {
        throw new AppError(`L'adresse email ${normalizedEmail} est déjà utilisée.`, 409, 'EMAIL_ALREADY_EXISTS');
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          ...(data.firstName ? { firstName: data.firstName.trim() } : {}),
          ...(data.lastName ? { lastName: data.lastName.trim() } : {}),
          ...(normalizedEmail !== undefined ? { email: normalizedEmail } : {}),
          ...(normalizedPhone !== undefined ? { phoneNumber: normalizedPhone } : {}),
          ...(data.jobTitle !== undefined ? { jobTitle: data.jobTitle ? data.jobTitle.trim() : null } : {}),
          ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl ? data.avatarUrl.trim() : null } : {}),
          ...(resolvedCommuneId !== undefined ? { communeId: resolvedCommuneId } : {}),
          ...(data.isActive !== undefined ? { isActive: Boolean(data.isActive) } : {}),
        },
      });

      // Update role if specified
      if (data.role) {
        let roleRecord = await tx.role.findUnique({ where: { name: data.role } });
        if (!roleRecord && tx.role.upsert) {
          roleRecord = await tx.role.upsert({
            where: { name: data.role },
            update: {},
            create: { name: data.role, description: `Rôle ${data.role}` },
          });
        }
        if (roleRecord) {
          await tx.userRole.deleteMany({ where: { userId } });
          await tx.userRole.create({
            data: {
              userId,
              roleId: roleRecord.id,
            },
          });
        }
      }

      const validActorId = await resolveValidActorId(tx, actorUser?.id);

      await tx.auditLog.create({
        data: {
          actorId: validActorId,
          action: 'USER_ACCOUNT_UPDATED',
          targetModule: 'USERS',
          targetRecordId: userId,
          newValues: {
            ...data,
            phoneNumber: normalizedPhone,
            email: normalizedEmail,
          },
        },
      });
    });

    return this.getUserById(userId);
  }

  /**
   * Resets a user's password securely, revoking active sessions.
   */
  static async resetUserPassword(userId, newPassword, actorUser) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('Utilisateur introuvable.', 404, 'USER_NOT_FOUND');
    }

    const plainPassword = newPassword && newPassword.trim().length >= 8
      ? newPassword.trim()
      : generateSecurePassword(14);

    const passwordHash = await argon2.hash(plainPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash },
      });

      // Invalidate existing refresh tokens so active stolen sessions are closed
      await tx.refreshToken.deleteMany({ where: { userId } });

      const validActorId = await resolveValidActorId(tx, actorUser?.id);

      await tx.auditLog.create({
        data: {
          actorId: validActorId,
          action: 'USER_PASSWORD_RESET',
          targetModule: 'USERS',
          targetRecordId: userId,
          reason: `Réinitialisation administrative par ${actorUser?.email || actorUser?.id}`,
        },
      });
    });

    logger.info('User password reset successfully', { userId, actorId: actorUser?.id });

    return {
      userId,
      temporaryPassword: plainPassword,
      message: 'Mot de passe réinitialisé avec succès. Les sessions actives précédentes ont été révoquées.',
    };
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
      logger.info('User account reactivated by admin', { userId, actorId: actorUser?.id });
    } else {
      RevocationRegistry.deactivateUser(userId);
      logger.warn('User account deactivated by admin - sessions invalidated', {
        userId,
        actorId: actorUser?.id,
      });
    }

    const validActorId = await resolveValidActorId(prisma, actorUser?.id);

    await prisma.auditLog.create({
      data: {
        actorId: validActorId,
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

  /**
   * Lists official territorial communes of Conakry.
   */
  static async listCommunes() {
    return prisma.commune.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        administrativeOrigin: true,
      },
      orderBy: { name: 'asc' },
    });
  }
}

export default UsersService;
