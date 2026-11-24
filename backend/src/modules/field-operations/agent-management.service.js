import crypto from 'crypto';
import argon2 from 'argon2';
import prisma from '../../utils/prisma.js';
import logger from '../../utils/logger.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { RevocationRegistry } from '../../middlewares/authMiddleware.js';
import { generateSecurePassword, normalizePhoneNumber } from '../users/users.service.js';

export class AgentManagementService {
  /**
   * Helper to ensure user is authorized to manage or view agents.
   * Enforces commune scoping for CHEF_SERVICE.
   */
  static enforceCommuneScope(actorUser, targetCommuneId = null) {
    const isSuperAdmin = actorUser?.roles?.includes('SUPER_ADMIN');
    const isDirector = actorUser?.roles?.includes('DIRECTOR');
    const isChefService = actorUser?.roles?.includes('CHEF_SERVICE');

    if (isSuperAdmin || isDirector) {
      return targetCommuneId || null;
    }

    if (isChefService) {
      if (!actorUser.communeId) {
        throw new AppError('Chef de Service sans commune assignée.', 403, 'FORBIDDEN_COMMUNE_UNASSIGNED');
      }
      if (targetCommuneId && targetCommuneId !== actorUser.communeId) {
        throw new AppError(
          'Accès interdit : Vous ne pouvez gérer que les agents de votre propre commune.',
          403,
          'FORBIDDEN_COMMUNE_MISMATCH'
        );
      }
      return actorUser.communeId;
    }

    throw new AppError('Accès non autorisé à la gestion des agents.', 403, 'FORBIDDEN');
  }

  /**
   * Generates a unique, standardized employee number for an agent.
   * Format: AGT-[COMM]-[HEX] (e.g. AGT-MTT-4A2F)
   */
  static async generateEmployeeNumber(communeId) {
    let communeCode = 'GN';
    if (communeId) {
      const commune = await prisma.commune.findUnique({
        where: { id: communeId },
        select: { code: true },
      });
      if (commune?.code) {
        communeCode = commune.code.toUpperCase();
      }
    }

    let attempts = 0;
    while (attempts < 10) {
      const randomHex = crypto.randomBytes(2).toString('hex').toUpperCase();
      const candidate = `AGT-${communeCode}-${randomHex}`;
      const exists = await prisma.user.findUnique({
        where: { employeeNumber: candidate },
        select: { id: true },
      });
      if (!exists) {
        return candidate;
      }
      attempts++;
    }

    return `AGT-${communeCode}-${Date.now().toString().slice(-4)}`;
  }

  /**
   * List agents with filtering, pagination, and strict commune scoping.
   */
  static async listAgents(actorUser, query = {}) {
    const {
      page = 1,
      limit = 50,
      search = '',
      communeId: queryCommuneId,
      teamId,
      status,
    } = query;

    // Enforce territorial restriction
    const effectiveCommuneId = this.enforceCommuneScope(actorUser, queryCommuneId);
    const skip = (page - 1) * limit;

    const isChefService = actorUser?.roles?.includes('CHEF_SERVICE') && !actorUser?.roles?.includes('SUPER_ADMIN');

    const where = {
      // If Chef de Service, strictly restrict to AGENT_TERRAIN role only
      ...(isChefService
        ? {
            roles: {
              some: {
                role: { name: 'AGENT_TERRAIN' },
              },
            },
          }
        : {}),
      ...(effectiveCommuneId ? { communeId: effectiveCommuneId } : {}),
      ...(teamId ? { assignedTeamId: teamId } : {}),
      ...(status ? { accountStatus: status } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phoneNumber: { contains: search, mode: 'insensitive' } },
              { employeeNumber: { contains: search, mode: 'insensitive' } },
              { jobTitle: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [agents, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
          email: true,
          jobTitle: true,
          avatarUrl: true,
          employeeNumber: true,
          address: true,
          accountStatus: true,
          isActive: true,
          communeId: true,
          commune: { select: { id: true, code: true, name: true } },
          assignedTeamId: true,
          assignedTeam: { select: { id: true, code: true, name: true } },
          roles: { include: { role: true } },
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              assignedMissionAgents: true,
              agentFieldInspections: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      items: agents.map((a) => ({
        ...a,
        roles: a.roles.map((r) => r.role.name),
        missionsCount: a._count.assignedMissionAgents,
        inspectionsCount: a._count.agentFieldInspections,
      })),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieve single agent by ID with security checks.
   */
  static async getAgentById(actorUser, agentId) {
    const agent = await prisma.user.findUnique({
      where: { id: agentId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        email: true,
        jobTitle: true,
        avatarUrl: true,
        employeeNumber: true,
        address: true,
        accountStatus: true,
        isActive: true,
        communeId: true,
        commune: { select: { id: true, code: true, name: true } },
        assignedTeamId: true,
        assignedTeam: { select: { id: true, code: true, name: true } },
        roles: { include: { role: true } },
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            assignedMissionAgents: true,
            agentFieldInspections: true,
          },
        },
      },
    });

    if (!agent) {
      throw new AppError('Agent introuvable.', 404, 'AGENT_NOT_FOUND');
    }

    const roles = agent.roles.map((r) => r.role.name);

    // Chef de Service scoping
    const isChefService = actorUser?.roles?.includes('CHEF_SERVICE') && !actorUser?.roles?.includes('SUPER_ADMIN');
    if (isChefService) {
      if (agent.communeId !== actorUser.communeId) {
        throw new AppError('Accès interdit : Cet agent n appartient pas à votre commune.', 403, 'FORBIDDEN_COMMUNE_MISMATCH');
      }
      if (!roles.includes('AGENT_TERRAIN')) {
        throw new AppError('Accès interdit : Cet utilisateur n est pas un agent de terrain.', 403, 'FORBIDDEN_ROLE');
      }
    }

    return {
      ...agent,
      roles,
      missionsCount: agent._count.assignedMissionAgents,
      inspectionsCount: agent._count.agentFieldInspections,
    };
  }

  /**
   * Create a new field agent account.
   */
  static async createAgent(actorUser, data) {
    const isSuperAdmin = actorUser?.roles?.includes('SUPER_ADMIN');
    const isChefService = actorUser?.roles?.includes('CHEF_SERVICE');

    if (!isSuperAdmin && !isChefService) {
      throw new AppError('Droit insuffisant pour créer un agent de terrain.', 403, 'FORBIDDEN');
    }

    // Determine and enforce commune
    let targetCommuneId = null;
    if (isChefService && !isSuperAdmin) {
      targetCommuneId = actorUser.communeId;
      if (!targetCommuneId) {
        throw new AppError('Chef de Service sans commune assignée.', 403, 'FORBIDDEN_COMMUNE_UNASSIGNED');
      }
      // CHEF_SERVICE can NEVER set communeId to anything other than their own
      if (data.communeId && data.communeId !== targetCommuneId) {
        throw new AppError(
          'Création interdite : Le Chef de Service ne peut créer des agents que pour sa propre commune.',
          403,
          'FORBIDDEN_COMMUNE_MISMATCH'
        );
      }
    } else {
      targetCommuneId = data.communeId || actorUser.communeId;
    }

    if (!targetCommuneId) {
      throw new AppError('La commune de rattachement est requise.', 400, 'COMMUNE_REQUIRED');
    }

    // Verify commune exists
    const commune = await prisma.commune.findUnique({
      where: { id: targetCommuneId },
    });
    if (!commune) {
      throw new AppError('Commune spécifiée introuvable.', 404, 'COMMUNE_NOT_FOUND');
    }

    // Verify assigned team if provided
    if (data.assignedTeamId) {
      const team = await prisma.fieldTeam.findUnique({
        where: { id: data.assignedTeamId },
      });
      if (!team) {
        throw new AppError('Équipe spécifiée introuvable.', 404, 'TEAM_NOT_FOUND');
      }
      if (team.communeId && team.communeId !== targetCommuneId) {
        throw new AppError(
          'L équipe assignée doit appartenir à la même commune que l agent.',
          400,
          'TEAM_COMMUNE_MISMATCH'
        );
      }
    }

    const normalizedPhone = normalizePhoneNumber(data.phoneNumber);
    if (!normalizedPhone || normalizedPhone.length < 8) {
      throw new AppError('Numéro de téléphone invalide.', 400, 'INVALID_PHONE');
    }

    const normalizedEmail = data.email ? data.email.trim().toLowerCase() : null;

    // Check duplicate phone/email
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
          `Un compte avec le numéro ${normalizedPhone} existe déjà.`,
          409,
          'PHONE_ALREADY_EXISTS'
        );
      }
      throw new AppError(
        `Un compte avec l adresse email ${normalizedEmail} existe déjà.`,
        409,
        'EMAIL_ALREADY_EXISTS'
      );
    }

    // Handle employee number
    let employeeNumber = data.employeeNumber ? data.employeeNumber.trim().toUpperCase() : null;
    if (employeeNumber) {
      const empExists = await prisma.user.findUnique({
        where: { employeeNumber },
      });
      if (empExists) {
        throw new AppError(
          `Le numéro matricule ${employeeNumber} est déjà attribué.`,
          409,
          'EMPLOYEE_NUMBER_ALREADY_EXISTS'
        );
      }
    } else {
      employeeNumber = await this.generateEmployeeNumber(targetCommuneId);
    }

    // Role check: Chef de Service can ONLY assign AGENT_TERRAIN
    const agentRole = await prisma.role.findUnique({
      where: { name: 'AGENT_TERRAIN' },
    });
    if (!agentRole) {
      throw new AppError('Rôle AGENT_TERRAIN introuvable dans le système.', 500, 'ROLE_NOT_FOUND');
    }

    const rawPassword = data.password ? data.password.trim() : generateSecurePassword(12);
    const passwordHash = await argon2.hash(rawPassword);

    const newAgent = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          phoneNumber: normalizedPhone,
          email: normalizedEmail,
          passwordHash,
          jobTitle: data.jobTitle?.trim() || 'Agent de Terrain AOTUC',
          avatarUrl: data.avatarUrl || null,
          employeeNumber,
          address: data.address?.trim() || null,
          communeId: targetCommuneId,
          assignedTeamId: data.assignedTeamId || null,
          accountStatus: 'ACTIVE',
          isActive: true,
          roles: {
            create: {
              roleId: agentRole.id,
            },
          },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
          email: true,
          jobTitle: true,
          avatarUrl: true,
          employeeNumber: true,
          address: true,
          accountStatus: true,
          isActive: true,
          communeId: true,
          commune: { select: { id: true, code: true, name: true } },
          assignedTeamId: true,
          assignedTeam: { select: { id: true, code: true, name: true } },
          createdAt: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actor: actorUser?.id ? { connect: { id: actorUser.id } } : undefined,
          action: 'AGENT_CREATED',
          targetModule: 'FIELD_OPERATIONS',
          targetRecordId: user.id,
          ipAddress: actorUser.ipAddress || null,
          userAgent: actorUser.userAgent || null,
          newValues: {
            employeeNumber: user.employeeNumber,
            communeId: user.communeId,
            fullName: `${user.firstName} ${user.lastName}`,
            assignedTeamId: user.assignedTeamId,
          },
        },
      });

      return user;
    });

    logger.info('AOTUC Agent created successfully', {
      agentId: newAgent.id,
      employeeNumber: newAgent.employeeNumber,
      createdBy: actorUser.id,
    });

    return {
      agent: {
        ...newAgent,
        roles: [{ id: agentRole.id, name: 'AGENT_TERRAIN' }],
        roleNames: ['AGENT_TERRAIN'],
      },
      temporaryPassword: rawPassword,
      initialPassword: rawPassword, // Returned once so the creator can communicate credentials
    };
  }

  /**
   * Update agent profile information.
   */
  static async updateAgent(actorUser, agentId, data) {
    const isSuperAdmin = actorUser?.roles?.includes('SUPER_ADMIN');
    const isChefService = actorUser?.roles?.includes('CHEF_SERVICE');

    if (!isSuperAdmin && !isChefService) {
      throw new AppError('Droit insuffisant pour modifier cet agent.', 403, 'FORBIDDEN');
    }

    const existingAgent = await prisma.user.findUnique({
      where: { id: agentId },
      include: {
        roles: { include: { role: true } },
      },
    });

    if (!existingAgent) {
      throw new AppError('Agent introuvable.', 404, 'AGENT_NOT_FOUND');
    }

    const existingRoles = existingAgent.roles.map((r) => r.role.name);

    if (isChefService && !isSuperAdmin) {
      if (existingAgent.communeId !== actorUser.communeId) {
        throw new AppError('Accès interdit : Cet agent n appartient pas à votre commune.', 403, 'FORBIDDEN_COMMUNE_MISMATCH');
      }
      if (!existingRoles.includes('AGENT_TERRAIN')) {
        throw new AppError('Accès interdit : Le Chef de Service ne peut modifier que des agents de terrain.', 403, 'FORBIDDEN_ROLE');
      }
      // Forbidden: Chef de Service cannot change the agent's commune
      if (data.communeId && data.communeId !== actorUser.communeId) {
        throw new AppError('Interdit : Vous ne pouvez pas réassigner un agent à une autre commune.', 403, 'FORBIDDEN_COMMUNE_REASSIGNMENT');
      }
    }

    const updateData = {};

    if (data.firstName !== undefined) updateData.firstName = data.firstName.trim();
    if (data.lastName !== undefined) updateData.lastName = data.lastName.trim();
    if (data.jobTitle !== undefined) updateData.jobTitle = data.jobTitle?.trim() || null;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
    if (data.address !== undefined) updateData.address = data.address?.trim() || null;

    if (data.phoneNumber) {
      const normalizedPhone = normalizePhoneNumber(data.phoneNumber);
      if (normalizedPhone !== existingAgent.phoneNumber) {
        const phoneExists = await prisma.user.findFirst({
          where: { phoneNumber: normalizedPhone, id: { not: agentId } },
        });
        if (phoneExists) {
          throw new AppError(`Le numéro ${normalizedPhone} est déjà utilisé.`, 409, 'PHONE_ALREADY_EXISTS');
        }
        updateData.phoneNumber = normalizedPhone;
      }
    }

    if (data.email !== undefined) {
      const normalizedEmail = data.email ? data.email.trim().toLowerCase() : null;
      if (normalizedEmail !== existingAgent.email) {
        if (normalizedEmail) {
          const emailExists = await prisma.user.findFirst({
            where: { email: normalizedEmail, id: { not: agentId } },
          });
          if (emailExists) {
            throw new AppError(`L adresse email ${normalizedEmail} est déjà utilisée.`, 409, 'EMAIL_ALREADY_EXISTS');
          }
        }
        updateData.email = normalizedEmail;
      }
    }

    if (data.employeeNumber && data.employeeNumber !== existingAgent.employeeNumber) {
      const empNumber = data.employeeNumber.trim().toUpperCase();
      const empExists = await prisma.user.findFirst({
        where: { employeeNumber: empNumber, id: { not: agentId } },
      });
      if (empExists) {
        throw new AppError(`Le matricule ${empNumber} est déjà attribué.`, 409, 'EMPLOYEE_NUMBER_ALREADY_EXISTS');
      }
      updateData.employeeNumber = empNumber;
    }

    if (data.assignedTeamId !== undefined) {
      if (data.assignedTeamId) {
        const team = await prisma.fieldTeam.findUnique({
          where: { id: data.assignedTeamId },
        });
        if (!team) {
          throw new AppError('Équipe spécifiée introuvable.', 404, 'TEAM_NOT_FOUND');
        }
        const effectiveCommune = existingAgent.communeId;
        if (team.communeId && team.communeId !== effectiveCommune) {
          throw new AppError('L équipe assignée doit appartenir à la commune de l agent.', 400, 'TEAM_COMMUNE_MISMATCH');
        }
        updateData.assignedTeamId = data.assignedTeamId;
      } else {
        updateData.assignedTeamId = null;
      }
    }

    if (data.password) {
      updateData.passwordHash = await argon2.hash(data.password.trim());
    }

    if (isSuperAdmin && data.communeId) {
      updateData.communeId = data.communeId;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: agentId },
        data: updateData,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
          email: true,
          jobTitle: true,
          avatarUrl: true,
          employeeNumber: true,
          address: true,
          accountStatus: true,
          isActive: true,
          communeId: true,
          commune: { select: { id: true, code: true, name: true } },
          assignedTeamId: true,
          assignedTeam: { select: { id: true, code: true, name: true } },
          updatedAt: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actor: actorUser?.id ? { connect: { id: actorUser.id } } : undefined,
          action: 'AGENT_UPDATED',
          targetModule: 'FIELD_OPERATIONS',
          targetRecordId: agentId,
          ipAddress: actorUser.ipAddress || null,
          userAgent: actorUser.userAgent || null,
          previousValues: {
            phoneNumber: existingAgent.phoneNumber,
            email: existingAgent.email,
            jobTitle: existingAgent.jobTitle,
            employeeNumber: existingAgent.employeeNumber,
            assignedTeamId: existingAgent.assignedTeamId,
          },
          newValues: updateData,
        },
      });

      return user;
    });

    return {
      ...updated,
      roles: existingRoles,
    };
  }

  /**
   * Update agent account status (ACTIVE, SUSPENDED, INACTIVE) with session revocation.
   */
  static async updateAgentStatus(actorUser, agentId, { status, accountStatus, reason }) {
    const isSuperAdmin = actorUser?.roles?.includes('SUPER_ADMIN');
    const isChefService = actorUser?.roles?.includes('CHEF_SERVICE');

    if (!isSuperAdmin && !isChefService) {
      throw new AppError('Droit insuffisant pour modifier le statut d un agent.', 403, 'FORBIDDEN');
    }

    const effectiveStatus = status || accountStatus;
    if (!['ACTIVE', 'SUSPENDED', 'INACTIVE'].includes(effectiveStatus)) {
      throw new AppError('Statut de compte invalide. Valeurs acceptées: ACTIVE, SUSPENDED, INACTIVE.', 400, 'INVALID_STATUS');
    }

    const targetAgent = await prisma.user.findUnique({
      where: { id: agentId },
      include: {
        roles: { include: { role: true } },
      },
    });

    if (!targetAgent) {
      throw new AppError('Agent introuvable.', 404, 'AGENT_NOT_FOUND');
    }

    const targetRoles = targetAgent.roles.map((r) => r.role.name);

    if (isChefService && !isSuperAdmin) {
      if (targetAgent.communeId !== actorUser.communeId) {
        throw new AppError('Accès interdit : Cet agent n appartient pas à votre commune.', 403, 'FORBIDDEN_COMMUNE_MISMATCH');
      }
      if (!targetRoles.includes('AGENT_TERRAIN')) {
        throw new AppError('Accès interdit : Le Chef de Service ne peut modifier que des agents de terrain.', 403, 'FORBIDDEN_ROLE');
      }
    }

    const newIsActive = effectiveStatus === 'ACTIVE';

    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: agentId },
        data: {
          accountStatus: effectiveStatus,
          isActive: newIsActive,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
          email: true,
          accountStatus: true,
          isActive: true,
          employeeNumber: true,
          communeId: true,
          updatedAt: true,
        },
      });

      // If suspended or deactivated, invalidate refresh tokens immediately
      if (!newIsActive) {
        await tx.refreshToken.deleteMany({
          where: { userId: agentId },
        });
      }

      await tx.auditLog.create({
        data: {
          actor: actorUser?.id ? { connect: { id: actorUser.id } } : undefined,
          action: `AGENT_STATUS_${effectiveStatus}`,
          targetModule: 'FIELD_OPERATIONS',
          targetRecordId: agentId,
          ipAddress: actorUser.ipAddress || null,
          userAgent: actorUser.userAgent || null,
          reason: reason || null,
          previousValues: {
            accountStatus: targetAgent.accountStatus,
            isActive: targetAgent.isActive,
          },
          newValues: {
            accountStatus: effectiveStatus,
            isActive: newIsActive,
          },
        },
      });

      return user;
    });

    // Instant in-memory revocation check update
    if (!newIsActive) {
      RevocationRegistry.deactivateUser(agentId);
      logger.warn(`Agent session revoked in memory`, { agentId, status: effectiveStatus, reason });
    } else {
      RevocationRegistry.reactivateUser(agentId);
      logger.info(`Agent session reactivated in memory`, { agentId });
    }

    return {
      ...updated,
      roles: targetRoles,
    };
  }
}

export default AgentManagementService;
