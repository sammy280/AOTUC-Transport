import crypto from 'crypto';
import prisma from '../../utils/prisma.js';
import logger from '../../utils/logger.js';
import { AppError } from '../../middlewares/errorHandler.js';
import SocketService from '../../services/socketService.js';

export class FieldOperationsService {
  /**
   * Helper to resolve a commune from UUID, code (e.g. 'KLM'), or name (e.g. 'Kaloum').
   */
  static async resolveCommune(raw) {
    if (!raw) return null;
    const trimmed = String(raw).trim();
    const upper = trimmed.toUpperCase();
    const slugStripped = upper.replace(/^(COMM-|CM-)/, '');

    return await prisma.commune.findFirst({
      where: {
        OR: [
          { id: trimmed },
          { code: { equals: trimmed, mode: 'insensitive' } },
          { code: { equals: slugStripped, mode: 'insensitive' } },
          { name: { equals: trimmed, mode: 'insensitive' } },
          { name: { equals: slugStripped, mode: 'insensitive' } },
        ],
      },
    });
  }

  /**
   * Generate sequential/unique assignment reference (e.g. ASN-2026-00042).
   */
  static async generateAssignmentReference() {
    const year = new Date().getFullYear();
    const count = await prisma.fieldAssignment.count();
    const seq = String(count + 1).padStart(5, '0');
    const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `ASN-${year}-${seq}-${randomSuffix}`;
  }

  /**
   * Generate unique field receipt reference (e.g. REC-FLD-2026-00042).
   */
  static async generateReceiptNumber() {
    const year = new Date().getFullYear();
    const count = await prisma.fieldReceipt.count();
    const seq = String(count + 1).padStart(5, '0');
    const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `REC-FLD-${year}-${seq}-${randomSuffix}`;
  }

  /**
   * Calculate real target vs actual registrations from PostgreSQL for an assignment.
   * Eliminates double counting and derives actual numbers strictly from persisted records.
   */
  static async calculateProgress(assignment) {
    if (!assignment.assignedUserId) {
      return {
        targetPeople: assignment.targetPeople,
        actualPeople: 0,
        peoplePercent: 0,
        targetVehicles: assignment.targetVehicles,
        actualVehicles: 0,
        vehiclesPercent: 0,
        overallPercent: 0,
      };
    }

    const dateFilter = {
      createdAt: {
        gte: assignment.startDate,
        ...(assignment.endDate ? { lte: assignment.endDate } : {}),
      },
    };

    // Actual distinct people registered by this agent in this commune during this assignment
    const actualPeople = await prisma.person.count({
      where: {
        registeredByUserId: assignment.assignedUserId,
        communeId: assignment.communeId,
        ...dateFilter,
      },
    });

    // Actual distinct vehicles registered by this agent during this assignment
    const actualVehicles = await prisma.vehicle.count({
      where: {
        registeredByUserId: assignment.assignedUserId,
        ...dateFilter,
      },
    });

    const targetPeople = assignment.targetPeople || 0;
    const targetVehicles = assignment.targetVehicles || 0;

    const peoplePercent = targetPeople > 0
      ? Math.min(100, Math.round((actualPeople / targetPeople) * 100))
      : (actualPeople > 0 ? 100 : 0);

    const vehiclesPercent = targetVehicles > 0
      ? Math.min(100, Math.round((actualVehicles / targetVehicles) * 100))
      : (actualVehicles > 0 ? 100 : 0);

    const overallPercent = (targetPeople + targetVehicles) > 0
      ? Math.min(100, Math.round(((actualPeople + actualVehicles) / (targetPeople + targetVehicles)) * 100))
      : Math.round((peoplePercent + vehiclesPercent) / 2);

    return {
      targetPeople,
      actualPeople,
      peoplePercent,
      targetVehicles,
      actualVehicles,
      vehiclesPercent,
      overallPercent,
    };
  }

  /**
   * Enforces role & territory restrictions.
   */
  static enforceTerritoryScope(user, targetCommuneId) {
    const isSuperOrDirector =
      user.roles?.includes('SUPER_ADMIN') ||
      user.roles?.includes('DIRECTOR') ||
      user.roles?.includes('IT');
    if (isSuperOrDirector) return; // National scope

    const isChefService = user.roles?.includes('CHEF_SERVICE');
    if (isChefService) {
      if (!user.communeId || user.communeId !== targetCommuneId) {
        throw new AppError(
          'Accès refusé : votre rôle de Chef de Service est restreint strictement à votre commune d affectation.',
          403,
          'TERRITORY_RESTRICTION'
        );
      }
    }
  }

  /**
   * Independently validates that an agent is eligible for field mission assignment:
   * 1. Agent must exist in the database.
   * 2. Agent must possess the AGENT_TERRAIN role.
   * 3. Agent must have an active account (accountStatus === 'ACTIVE' and isActive === true).
   * 4. For CHEF_SERVICE (scoped supervisor), the agent must belong to the supervisor's commune.
   */
  static async validateEligibleAgent(actorUser, agentUserId, missionCommuneId = null) {
    if (!agentUserId) return null;

    const agent = await prisma.user.findUnique({
      where: { id: agentUserId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneNumber: true,
        employeeNumber: true,
        accountStatus: true,
        isActive: true,
        communeId: true,
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!agent) {
      throw new AppError('Agent désigné introuvable dans le système.', 404, 'AGENT_NOT_FOUND');
    }

    const roleNames = agent.roles?.map((r) => r.role?.name || r.roleName) || [];
    if (!roleNames.includes('AGENT_TERRAIN')) {
      throw new AppError(
        `L'utilisateur ${agent.firstName} ${agent.lastName} n'est pas accrédité en tant qu'Agent de Terrain (rôle: ${roleNames.join(', ') || 'aucun'}).`,
        400,
        'INVALID_AGENT_ROLE'
      );
    }

    if (!agent.isActive || agent.accountStatus !== 'ACTIVE') {
      throw new AppError(
        `Le compte de l'agent ${agent.firstName} ${agent.lastName} n'est pas actif (statut: ${agent.accountStatus || 'INACTIF'}). Seuls les agents actifs peuvent être affectés à une mission.`,
        400,
        'INACTIVE_AGENT'
      );
    }

    const isGlobal =
      actorUser?.roles?.includes('SUPER_ADMIN') ||
      actorUser?.roles?.includes('DIRECTOR') ||
      actorUser?.roles?.includes('IT');

    const isChefService = actorUser?.roles?.includes('CHEF_SERVICE') && !isGlobal;

    if (isChefService) {
      if (agent.communeId && actorUser.communeId && agent.communeId !== actorUser.communeId) {
        throw new AppError(
          `Accès refusé : En tant que Chef de Service, vous ne pouvez assigner que des agents affectés à votre propre commune.`,
          403,
          'AGENT_COMMUNE_MISMATCH'
        );
      }
    }

    return agent;
  }

  /**
   * List assignments with real-time target progress and role-based scoping.
   */
  static async listAssignments(user, query = {}) {
    const where = {};

    // 1. Territorial and multi-agent scoping
    const isAgent = user.roles?.includes('AGENT_TERRAIN') && !user.roles?.includes('CHEF_SERVICE') && !user.roles?.includes('SUPER_ADMIN') && !user.roles?.includes('DIRECTOR');
    const isChef = user.roles?.includes('CHEF_SERVICE') && !user.roles?.includes('SUPER_ADMIN') && !user.roles?.includes('DIRECTOR');

    if (isAgent) {
      where.OR = [
        { assignedUserId: user.id },
        { assignedAgents: { some: { agentUserId: user.id } } },
      ];
    } else if (isChef) {
      where.communeId = user.communeId;
    } else if (query.communeId) {
      const resolved = await this.resolveCommune(query.communeId);
      if (resolved) where.communeId = resolved.id;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.assignedUserId && !isAgent) {
      where.OR = [
        { assignedUserId: query.assignedUserId },
        { assignedAgents: { some: { agentUserId: query.assignedUserId } } },
      ];
    }

    if (query.search) {
      const searchCondition = [
        { reference: { contains: query.search, mode: 'insensitive' } },
        { title: { contains: query.search, mode: 'insensitive' } },
        { locationName: { contains: query.search, mode: 'insensitive' } },
      ];
      if (where.OR) {
        where.AND = [
          { OR: where.OR },
          { OR: searchCondition },
        ];
        delete where.OR;
      } else {
        where.OR = searchCondition;
      }
    }

    const assignments = await prisma.fieldAssignment.findMany({
      where,
      include: {
        commune: { select: { id: true, code: true, name: true } },
        assignedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
            avatarUrl: true,
            employeeNumber: true,
            jobTitle: true,
          },
        },
        assignedAgents: {
          include: {
            agentUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phoneNumber: true,
                avatarUrl: true,
                employeeNumber: true,
                jobTitle: true,
              },
            },
          },
        },
        supervisor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
          },
        },
        team: { select: { id: true, code: true, name: true } },
        _count: {
          select: {
            inspections: true,
            receipts: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit || 50,
      skip: ((query.page || 1) - 1) * (query.limit || 50),
    });

    const total = await prisma.fieldAssignment.count({ where });

    // Compute real progress for each assignment
    const enriched = await Promise.all(
      assignments.map(async (a) => {
        const progress = await this.calculateProgress(a);
        return {
          ...a,
          progress,
        };
      })
    );

    return {
      total,
      page: query.page || 1,
      limit: query.limit || 50,
      assignments: enriched,
    };
  }

  /**
   * Get single assignment with progress and receipts.
   */
  static async getAssignmentById(user, id) {
    const assignment = await prisma.fieldAssignment.findUnique({
      where: { id },
      include: {
        commune: { select: { id: true, code: true, name: true } },
        assignedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
            avatarUrl: true,
            employeeNumber: true,
            jobTitle: true,
          },
        },
        assignedAgents: {
          include: {
            agentUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phoneNumber: true,
                avatarUrl: true,
                employeeNumber: true,
                jobTitle: true,
              },
            },
          },
        },
        supervisor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
          },
        },
        cancelledByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        team: { select: { id: true, code: true, name: true } },
        inspections: {
          include: {
            agentUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeNumber: true,
              },
            },
            documents: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        missionReport: {
          include: {
            leadAuthor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeNumber: true,
              },
            },
            reviewedByUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            versions: {
              include: {
                submittedByUser: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
              orderBy: { versionNumber: 'desc' },
            },
          },
        },
        receipts: {
          take: 20,
          orderBy: { issuedAt: 'desc' },
        },
      },
    });

    if (!assignment) {
      throw new AppError('Mission de terrain introuvable.', 404, 'NOT_FOUND');
    }

    // Role checks
    const isAgent = user.roles?.includes('AGENT_TERRAIN') && !user.roles?.includes('CHEF_SERVICE') && !user.roles?.includes('SUPER_ADMIN') && !user.roles?.includes('DIRECTOR');
    if (isAgent) {
      const isAssigned = assignment.assignedUserId === user.id ||
        assignment.assignedAgents?.some((a) => a.agentUserId === user.id);
      if (!isAssigned) {
        throw new AppError('Accès refusé : vous ne pouvez consulter que vos propres missions.', 403, 'FORBIDDEN');
      }
    }

    this.enforceTerritoryScope(user, assignment.communeId);

    const progress = await this.calculateProgress(assignment);
    return {
      ...assignment,
      progress,
    };
  }

  /**
   * Complete Mission Lifecycle State Machine Transitions
   * DRAFT → ASSIGNED → IN_PROGRESS → AWAITING_REPORT → SUBMITTED → (APPROVED | REJECTED | CHANGES_REQUESTED)
   * CHANGES_REQUESTED → SUBMITTED
   * APPROVED → COMPLETED
   * CANCELLED (Supervisor only, mandatory reason)
   */
  static VALID_MISSION_TRANSITIONS = {
    DRAFT: ['ASSIGNED', 'CANCELLED'],
    PLANNED: ['DRAFT', 'ASSIGNED', 'CANCELLED'], // Backward compatibility
    ASSIGNED: ['IN_PROGRESS', 'DRAFT', 'CANCELLED'],
    IN_PROGRESS: ['AWAITING_REPORT', 'COMPLETED', 'CANCELLED'],
    AWAITING_REPORT: ['SUBMITTED', 'IN_PROGRESS', 'CANCELLED'],
    SUBMITTED: ['APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'CANCELLED'],
    CHANGES_REQUESTED: ['SUBMITTED', 'CANCELLED'],
    APPROVED: ['COMPLETED', 'CANCELLED'],
    REJECTED: ['CHANGES_REQUESTED', 'CANCELLED'],
    COMPLETED: [], // Terminal
    CANCELLED: [], // Terminal
  };

  /**
   * Create a new field assignment (Multi-Agent enabled).
   */
  static async createAssignment(user, data) {
    const resolvedCommune = await this.resolveCommune(data.communeId);
    if (!resolvedCommune) {
      throw new AppError('Commune de mission invalide ou non reconnue.', 400, 'INVALID_COMMUNE');
    }

    this.enforceTerritoryScope(user, resolvedCommune.id);

    const reference = await this.generateAssignmentReference();

    // Prepare multi-agent list and validate agent eligibility
    const agentsList = [];
    if (Array.isArray(data.assignedAgents) && data.assignedAgents.length > 0) {
      for (const ag of data.assignedAgents) {
        await this.validateEligibleAgent(user, ag.userId, resolvedCommune.id);
        agentsList.push({
          userId: ag.userId,
          role: ag.role || 'CONTRIBUTOR',
        });
      }
    } else if (data.assignedUserId || data.leadAgentId) {
      const leadId = data.assignedUserId || data.leadAgentId;
      await this.validateEligibleAgent(user, leadId, resolvedCommune.id);
      agentsList.push({
        userId: leadId,
        role: 'LEAD',
      });
    }

    // Default status: if agents are attached, ASSIGNED; otherwise DRAFT
    let initialStatus = data.status || (agentsList.length > 0 ? 'ASSIGNED' : 'DRAFT');

    const leadAgent = agentsList.find((a) => a.role === 'LEAD') || agentsList[0];
    const primaryAssignedUserId = leadAgent ? leadAgent.userId : (data.assignedUserId || null);

    const assignment = await prisma.fieldAssignment.create({
      data: {
        reference,
        title: data.title,
        communeId: resolvedCommune.id,
        locationName: data.locationName,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        assignedUserId: primaryAssignedUserId,
        teamId: data.teamId || null,
        supervisorId: user.id,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        targetPeople: data.targetPeople || 0,
        targetVehicles: data.targetVehicles || 0,
        instructions: data.instructions || null,
        status: initialStatus,
        assignedAgents: agentsList.length > 0
          ? {
              create: agentsList.map((ag) => ({
                agentUserId: ag.userId,
                roleInMission: ag.role || 'MEMBER',
              })),
            }
          : undefined,
      },
      include: {
        commune: { select: { id: true, code: true, name: true } },
        assignedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
            avatarUrl: true,
            employeeNumber: true,
          },
        },
        assignedAgents: {
          include: {
            agentUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phoneNumber: true,
                avatarUrl: true,
                employeeNumber: true,
                jobTitle: true,
              },
            },
          },
        },
        supervisor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
          },
        },
      },
    });

    try {
      await prisma.auditLog.create({
        data: {
          actor: user?.id ? { connect: { id: user.id } } : undefined,
          action: 'FIELD_ASSIGNMENT_CREATED',
          targetModule: 'FIELD_OPERATIONS',
          targetRecordId: assignment.id,
          newValues: {
            reference: assignment.reference,
            title: assignment.title,
            communeId: resolvedCommune.id,
            assignedUserId: assignment.assignedUserId,
            assignedAgentsCount: agentsList.length,
            status: assignment.status,
          },
        },
      });
    } catch (auditErr) {
      logger.warn('Non-fatal: failed to write audit log for assignment creation', { error: auditErr.message });
    }

    // Notify assigned agents or commune
    SocketService.emitNotification(
      assignment.assignedUserId ? `user:${assignment.assignedUserId}` : `commune:${resolvedCommune.id}`,
      'field:assignment_created',
      {
        id: assignment.id,
        reference: assignment.reference,
        title: assignment.title,
        commune: resolvedCommune.name,
        location: assignment.locationName,
        targetPeople: assignment.targetPeople,
        targetVehicles: assignment.targetVehicles,
      }
    );

    const progress = await this.calculateProgress(assignment);
    return { ...assignment, progress };
  }

  /**
   * Update an existing field assignment (Multi-Agent enabled).
   */
  static async updateAssignment(user, id, data) {
    const existing = await prisma.fieldAssignment.findUnique({
      where: { id },
      include: { commune: true },
    });

    if (!existing) {
      throw new AppError('Mission introuvable.', 404, 'NOT_FOUND');
    }

    if (['COMPLETED', 'CANCELLED'].includes(existing.status)) {
      throw new AppError('Une mission terminée ou annulée ne peut plus être modifiée.', 400, 'MISSION_TERMINATED');
    }

    this.enforceTerritoryScope(user, existing.communeId);

    const updateData = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.locationName !== undefined) updateData.locationName = data.locationName;
    if (data.latitude !== undefined) updateData.latitude = data.latitude;
    if (data.longitude !== undefined) updateData.longitude = data.longitude;
    if (data.teamId !== undefined) updateData.teamId = data.teamId;
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null;
    if (data.targetPeople !== undefined) updateData.targetPeople = data.targetPeople;
    if (data.targetVehicles !== undefined) updateData.targetVehicles = data.targetVehicles;
    if (data.instructions !== undefined) updateData.instructions = data.instructions;
    if (data.supervisorNotes !== undefined) updateData.supervisorNotes = data.supervisorNotes;
    if (data.status !== undefined) updateData.status = data.status;

    if (data.communeId) {
      const resolvedCommune = await this.resolveCommune(data.communeId);
      if (!resolvedCommune) throw new AppError('Commune invalide.', 400, 'INVALID_COMMUNE');
      this.enforceTerritoryScope(user, resolvedCommune.id);
      updateData.communeId = resolvedCommune.id;
    }

    const targetCommuneId = updateData.communeId || existing.communeId;
    if (Array.isArray(data.assignedAgents)) {
      for (const ag of data.assignedAgents) {
        await this.validateEligibleAgent(user, ag.userId, targetCommuneId);
      }
    } else if (data.assignedUserId) {
      await this.validateEligibleAgent(user, data.assignedUserId, targetCommuneId);
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Handle multi-agent sync if assignedAgents passed
      if (Array.isArray(data.assignedAgents)) {
        await tx.fieldAssignmentAgent.deleteMany({ where: { assignmentId: id } });
        if (data.assignedAgents.length > 0) {
          await tx.fieldAssignmentAgent.createMany({
            data: data.assignedAgents.map((ag) => ({
              assignmentId: id,
              agentUserId: ag.userId,
              roleInMission: ag.role || 'MEMBER',
            })),
          });
          const lead = data.assignedAgents.find((ag) => ag.role === 'LEAD') || data.assignedAgents[0];
          updateData.assignedUserId = lead.userId;
          if (existing.status === 'DRAFT') {
            updateData.status = 'ASSIGNED';
          }
        } else {
          updateData.assignedUserId = null;
        }
      } else if (data.assignedUserId !== undefined) {
        updateData.assignedUserId = data.assignedUserId;
      }

      const res = await tx.fieldAssignment.update({
        where: { id },
        data: updateData,
        include: {
          commune: { select: { id: true, code: true, name: true } },
          assignedUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
              avatarUrl: true,
              employeeNumber: true,
            },
          },
          assignedAgents: {
            include: {
              agentUser: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phoneNumber: true,
                  avatarUrl: true,
                  employeeNumber: true,
                  jobTitle: true,
                },
              },
            },
          },
          supervisor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actor: user?.id ? { connect: { id: user.id } } : undefined,
          action: 'FIELD_ASSIGNMENT_UPDATED',
          targetModule: 'FIELD_OPERATIONS',
          targetRecordId: res.id,
          previousValues: { status: existing.status, title: existing.title, assignedUserId: existing.assignedUserId },
          newValues: { status: res.status, title: res.title, assignedUserId: res.assignedUserId },
        },
      });

      return res;
    });

    if (updated.assignedUserId) {
      SocketService.emitNotification(
        `user:${updated.assignedUserId}`,
        'field:assignment_updated',
        {
          id: updated.id,
          reference: updated.reference,
          title: updated.title,
          targetPeople: updated.targetPeople,
          targetVehicles: updated.targetVehicles,
          endDate: updated.endDate,
        }
      );
    }

    const progress = await this.calculateProgress(updated);
    return { ...updated, progress };
  }

  /**
   * Reassign an agent to an assignment with a recorded reason.
   */
  static async reassignAgent(user, id, data) {
    const existing = await prisma.fieldAssignment.findUnique({
      where: { id },
      include: { assignedUser: true, commune: true },
    });

    if (!existing) {
      throw new AppError('Mission introuvable.', 404, 'NOT_FOUND');
    }

    if (['COMPLETED', 'CANCELLED'].includes(existing.status)) {
      throw new AppError('Impossible de réassigner une mission terminée ou annulée.', 400, 'MISSION_TERMINATED');
    }

    this.enforceTerritoryScope(user, existing.communeId);

    const newAgent = await this.validateEligibleAgent(user, data.assignedUserId, existing.communeId);

    const previousAgentName = existing.assignedUser
      ? `${existing.assignedUser.firstName} ${existing.assignedUser.lastName}`
      : 'Aucun';

    const noteEntry = `[${new Date().toISOString()}] Réassignation par ${user.name || user.email} : De "${previousAgentName}" vers "${newAgent.firstName} ${newAgent.lastName}". Motif: ${data.reason}. ${data.supervisorNotes || ''}`.trim();

    const mergedNotes = existing.supervisorNotes
      ? `${existing.supervisorNotes}\n${noteEntry}`
      : noteEntry;

    const updated = await prisma.$transaction(async (tx) => {
      // Upsert lead in assignedAgents
      await tx.fieldAssignmentAgent.upsert({
        where: {
          assignmentId_agentUserId: {
            assignmentId: id,
            agentUserId: data.assignedUserId,
          },
        },
        update: { roleInMission: 'LEAD' },
        create: {
          assignmentId: id,
          agentUserId: data.assignedUserId,
          roleInMission: 'LEAD',
        },
      });

      const res = await tx.fieldAssignment.update({
        where: { id },
        data: {
          assignedUserId: data.assignedUserId,
          status: existing.status === 'DRAFT' ? 'ASSIGNED' : existing.status,
          supervisorNotes: mergedNotes,
        },
        include: {
          commune: { select: { id: true, code: true, name: true } },
          assignedUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
              avatarUrl: true,
              employeeNumber: true,
            },
          },
          assignedAgents: {
            include: {
              agentUser: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phoneNumber: true,
                  employeeNumber: true,
                },
              },
            },
          },
          supervisor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actor: user?.id ? { connect: { id: user.id } } : undefined,
          action: 'FIELD_ASSIGNMENT_REASSIGNED',
          targetModule: 'FIELD_OPERATIONS',
          targetRecordId: id,
          reason: data.reason,
          previousValues: { assignedUserId: existing.assignedUserId },
          newValues: { assignedUserId: newAgent.id, supervisorNotes: mergedNotes },
        },
      });

      return res;
    });

    SocketService.emitNotification(
      `user:${newAgent.id}`,
      'field:assignment_reassigned',
      {
        assignmentId: updated.id,
        reference: updated.reference,
        title: updated.title,
        reason: data.reason,
      }
    );

    const progress = await this.calculateProgress(updated);
    return { ...updated, progress };
  }

  /**
   * Update assignment status strictly enforcing lifecycle transitions.
   * DRAFT → ASSIGNED → IN_PROGRESS → AWAITING_REPORT → SUBMITTED → (APPROVED | REJECTED | CHANGES_REQUESTED)
   * APPROVED → COMPLETED
   */
  static async updateStatus(user, id, data) {
    const existing = await prisma.fieldAssignment.findUnique({
      where: { id },
      include: { commune: true },
    });

    if (!existing) {
      throw new AppError('Mission introuvable.', 404, 'NOT_FOUND');
    }

    if (['COMPLETED', 'CANCELLED'].includes(existing.status)) {
      throw new AppError('Cette mission est terminée ou annulée. Aucune modification de statut n est autorisée.', 400, 'MISSION_TERMINATED');
    }

    // Validate lifecycle transitions
    const allowedNext = this.VALID_MISSION_TRANSITIONS[existing.status] || [];
    if (!allowedNext.includes(data.status)) {
      throw new AppError(
        `Transition de statut invalide : Impossible de passer de ${existing.status} à ${data.status}.`,
        400,
        'INVALID_STATUS_TRANSITION'
      );
    }

    const isAgent = user.roles?.includes('AGENT_TERRAIN') && !user.roles?.includes('CHEF_SERVICE') && !user.roles?.includes('SUPER_ADMIN') && !user.roles?.includes('DIRECTOR');
    if (isAgent) {
      const isAssigned = existing.assignedUserId === user.id ||
        (await prisma.fieldAssignmentAgent.findFirst({ where: { assignmentId: id, agentUserId: user.id } }));
      if (!isAssigned) {
        throw new AppError('Accès refusé : vous ne pouvez modifier que le statut de votre propre mission.', 403, 'FORBIDDEN');
      }

      // Agents can only switch to IN_PROGRESS, AWAITING_REPORT, or COMPLETED
      const agentPermitted = ['IN_PROGRESS', 'AWAITING_REPORT', 'COMPLETED'];
      if (!agentPermitted.includes(data.status)) {
        throw new AppError('Les agents de terrain ne peuvent pas effectuer cette transition de statut.', 403, 'FORBIDDEN_STATUS_TRANSITION');
      }
    } else {
      this.enforceTerritoryScope(user, existing.communeId);
    }

    let mergedNotes = existing.supervisorNotes;
    if (data.supervisorNotes) {
      const noteEntry = `[${new Date().toISOString()}] Statut passé à ${data.status} : ${data.supervisorNotes}`;
      mergedNotes = mergedNotes ? `${mergedNotes}\n${noteEntry}` : noteEntry;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.fieldAssignment.update({
        where: { id },
        data: {
          status: data.status,
          supervisorNotes: mergedNotes,
        },
        include: {
          commune: { select: { id: true, code: true, name: true } },
          assignedUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
              avatarUrl: true,
              employeeNumber: true,
            },
          },
          assignedAgents: {
            include: {
              agentUser: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phoneNumber: true,
                  employeeNumber: true,
                },
              },
            },
          },
          supervisor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actor: user?.id ? { connect: { id: user.id } } : undefined,
          action: 'FIELD_ASSIGNMENT_STATUS_CHANGED',
          targetModule: 'FIELD_OPERATIONS',
          targetRecordId: res.id,
          previousValues: { status: existing.status },
          newValues: { status: res.status, supervisorNotes: mergedNotes },
        },
      });

      return res;
    });

    SocketService.emitNotification(
      updated.assignedUserId ? `user:${updated.assignedUserId}` : `commune:${updated.communeId}`,
      'field:assignment_status_changed',
      {
        id: updated.id,
        reference: updated.reference,
        title: updated.title,
        status: updated.status,
        supervisorNotes: data.supervisorNotes || null,
      }
    );

    const progress = await this.calculateProgress(updated);
    return { ...updated, progress };
  }

  /**
   * Cancel an assignment (Supervisors only, requires mandatory written reason).
   */
  static async cancelAssignment(user, id, data) {
    const isSuperOrDirector = user.roles?.includes('SUPER_ADMIN') || user.roles?.includes('DIRECTOR');
    const isChef = user.roles?.includes('CHEF_SERVICE');
    if (!isSuperOrDirector && !isChef) {
      throw new AppError('Seuls les superviseurs et administrateurs peuvent annuler une mission.', 403, 'FORBIDDEN');
    }

    const existing = await prisma.fieldAssignment.findUnique({
      where: { id },
      include: { commune: true },
    });

    if (!existing) {
      throw new AppError('Mission introuvable.', 404, 'NOT_FOUND');
    }

    this.enforceTerritoryScope(user, existing.communeId);

    if (existing.status === 'COMPLETED') {
      throw new AppError('Impossible d annuler une mission déjà terminée.', 400, 'MISSION_ALREADY_COMPLETED');
    }
    if (existing.status === 'CANCELLED') {
      throw new AppError('Cette mission est déjà annulée.', 400, 'MISSION_ALREADY_CANCELLED');
    }

    if (!data.reason || data.reason.trim().length < 3) {
      throw new AppError('Le motif d annulation écrit est obligatoire (au moins 3 caractères).', 400, 'REASON_REQUIRED');
    }

    const reason = data.reason.trim();
    const noteEntry = `[${new Date().toISOString()}] Mission ANNULÉE par ${user.name || user.email}. Motif: ${reason}. ${data.supervisorNotes || ''}`.trim();
    const mergedNotes = existing.supervisorNotes ? `${existing.supervisorNotes}\n${noteEntry}` : noteEntry;

    const updated = await prisma.$transaction(async (tx) => {
      const assignment = await tx.fieldAssignment.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledByUser: { connect: { id: user.id } },
          cancellationReason: reason,
          cancelledAt: new Date(),
          supervisorNotes: mergedNotes,
        },
        include: {
          commune: { select: { id: true, code: true, name: true } },
          assignedUser: { select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true } },
          supervisor: { select: { id: true, firstName: true, lastName: true, email: true } },
          cancelledByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          actor: user?.id ? { connect: { id: user.id } } : undefined,
          action: 'FIELD_ASSIGNMENT_CANCELLED',
          targetModule: 'FIELD_OPERATIONS',
          targetRecordId: id,
          reason,
          previousValues: { status: existing.status },
          newValues: { status: 'CANCELLED', cancellationReason: reason, cancelledAt: assignment.cancelledAt },
        },
      });

      return assignment;
    });

    SocketService.emitNotification(
      updated.assignedUserId ? `user:${updated.assignedUserId}` : `commune:${updated.communeId}`,
      'field:assignment_cancelled',
      {
        id: updated.id,
        reference: updated.reference,
        title: updated.title,
        reason,
      }
    );

    const progress = await this.calculateProgress(updated);
    return { ...updated, progress };
  }

  /**
   * Supervisor Field Dashboard Summary:
   * Aggregates total, active, completed missions, assigned agents, registrations today,
   * progress by commune, agent performance, distinguishing online server records from pending offline syncs.
   */
  static async getDashboardSummary(user, query = {}) {
    const isChef = user.roles?.includes('CHEF_SERVICE') && !user.roles?.includes('SUPER_ADMIN') && !user.roles?.includes('DIRECTOR');
    const scopedCommuneId = isChef ? user.communeId : (query.communeId ? (await this.resolveCommune(query.communeId))?.id : null);

    const assignmentWhere = scopedCommuneId ? { communeId: scopedCommuneId } : {};

    // 1. Mission counts
    const totalAssignments = await prisma.fieldAssignment.count({ where: assignmentWhere });
    const activeAssignments = await prisma.fieldAssignment.count({
      where: {
        ...assignmentWhere,
        status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
      },
    });
    const completedAssignments = await prisma.fieldAssignment.count({
      where: {
        ...assignmentWhere,
        status: 'COMPLETED',
      },
    });

    // 2. Distinct assigned field agents on active missions
    const activeMissionsWithAgents = await prisma.fieldAssignment.findMany({
      where: {
        ...assignmentWhere,
        status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
        assignedUserId: { not: null },
      },
      select: { assignedUserId: true },
    });
    const assignedAgentsCount = new Set(activeMissionsWithAgents.map((m) => m.assignedUserId)).size;

    // 3. Registrations today (from 00:00:00 today)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const personWhereToday = {
      createdAt: { gte: todayStart },
      ...(scopedCommuneId ? { communeId: scopedCommuneId } : {}),
    };
    const vehicleWhereToday = {
      createdAt: { gte: todayStart },
    };

    const peopleToday = await prisma.person.count({ where: personWhereToday });
    const vehiclesToday = await prisma.vehicle.count({ where: vehicleWhereToday });
    const registrationsToday = peopleToday + vehiclesToday;

    // 4. Commune Breakdown (Kaloum, Dixinn, Matam, Ratoma, Matoto)
    const allCommunes = await prisma.commune.findMany({
      where: scopedCommuneId ? { id: scopedCommuneId } : {},
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    });

    const communeBreakdown = await Promise.all(
      allCommunes.map(async (c) => {
        const commMissions = await prisma.fieldAssignment.findMany({
          where: { communeId: c.id },
          select: {
            id: true,
            targetPeople: true,
            targetVehicles: true,
            status: true,
            assignedUserId: true,
            startDate: true,
            endDate: true,
          },
        });

        const activeInCommune = commMissions.filter((m) => ['ASSIGNED', 'IN_PROGRESS'].includes(m.status)).length;
        const targetPeople = commMissions.reduce((acc, m) => acc + (m.targetPeople || 0), 0);
        const targetVehicles = commMissions.reduce((acc, m) => acc + (m.targetVehicles || 0), 0);

        const actualPeople = await prisma.person.count({
          where: { communeId: c.id },
        });

        // Vehicles linked to persons or registered in this commune
        const actualVehicles = await prisma.vehicle.count({
          where: {
            owner: {
              person: { communeId: c.id },
            },
          },
        });

        return {
          communeId: c.id,
          communeCode: c.code,
          communeName: c.name,
          activeAssignments: activeInCommune,
          totalAssignments: commMissions.length,
          targetPeople,
          actualPeople,
          targetVehicles,
          actualVehicles,
          completionRate: (targetPeople + targetVehicles) > 0
            ? Math.min(100, Math.round(((actualPeople + actualVehicles) / (targetPeople + targetVehicles)) * 100))
            : 0,
        };
      })
    );

    // 5. Total targets vs actuals across the board
    const totalTargetPeople = communeBreakdown.reduce((sum, c) => sum + c.targetPeople, 0);
    const totalActualPeople = communeBreakdown.reduce((sum, c) => sum + c.actualPeople, 0);
    const totalTargetVehicles = communeBreakdown.reduce((sum, c) => sum + c.targetVehicles, 0);
    const totalActualVehicles = communeBreakdown.reduce((sum, c) => sum + c.actualVehicles, 0);

    // 6. Total Receipts Issued
    const receiptWhere = scopedCommuneId ? { communeId: scopedCommuneId } : {};
    const totalReceiptsIssued = await prisma.fieldReceipt.count({ where: receiptWhere });

    return {
      totalAssignments,
      activeAssignments,
      completedAssignments,
      assignedAgentsCount,
      registrationsToday,
      todayBreakdown: {
        peopleToday,
        vehiclesToday,
      },
      targetsSummary: {
        targetPeople: totalTargetPeople,
        actualPeople: totalActualPeople,
        peoplePercent: totalTargetPeople > 0 ? Math.round((totalActualPeople / totalTargetPeople) * 100) : 0,
        targetVehicles: totalTargetVehicles,
        actualVehicles: totalActualVehicles,
        vehiclesPercent: totalTargetVehicles > 0 ? Math.round((totalActualVehicles / totalTargetVehicles) * 100) : 0,
        overallPercent: (totalTargetPeople + totalTargetVehicles) > 0
          ? Math.round(((totalActualPeople + totalActualVehicles) / (totalTargetPeople + totalTargetVehicles)) * 100)
          : 0,
      },
      totalReceiptsIssued,
      communeBreakdown,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create an official Field Receipt (Proof of Work) upon field registration.
   * Free of fraudulent fees, strictly serving as verifiable administrative receipt.
   */
  static async createReceipt(user, data) {
    let resolvedCommuneId = data.communeId || null;

    if (data.assignmentId) {
      const assignment = await prisma.fieldAssignment.findUnique({
        where: { id: data.assignmentId },
      });
      if (assignment) {
        resolvedCommuneId = assignment.communeId;
      }
    }

    // Check duplicate receipt for this entity
    if (data.personId) {
      const existingReceipt = await prisma.fieldReceipt.findFirst({
        where: {
          personId: data.personId,
          ...(data.assignmentId ? { assignmentId: data.assignmentId } : {}),
        },
      });
      if (existingReceipt) {
        return { ...existingReceipt, isExisting: true };
      }
    }

    if (data.vehicleId) {
      const existingReceipt = await prisma.fieldReceipt.findFirst({
        where: {
          vehicleId: data.vehicleId,
          ...(data.assignmentId ? { assignmentId: data.assignmentId } : {}),
        },
      });
      if (existingReceipt) {
        return { ...existingReceipt, isExisting: true };
      }
    }

    const receiptNumber = await this.generateReceiptNumber();

    const receipt = await prisma.fieldReceipt.create({
      data: {
        receiptNumber,
        assignmentId: data.assignmentId || null,
        agentUserId: user.id,
        personId: data.personId || null,
        vehicleId: data.vehicleId || null,
        communeId: resolvedCommuneId,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        notes: data.notes || null,
      },
      include: {
        agentUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phoneNumber: true,
          },
        },
        commune: { select: { id: true, code: true, name: true } },
        person: { select: { id: true, firstName: true, lastName: true, nin: true, phoneNumber: true } },
        vehicle: { select: { id: true, plateNumber: true, make: true, model: true } },
        assignment: { select: { id: true, reference: true, title: true, locationName: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        actor: user?.id ? { connect: { id: user.id } } : undefined,
        action: 'FIELD_RECEIPT_ISSUED',
        targetModule: 'FIELD_OPERATIONS',
        targetRecordId: receipt.id,
        newValues: {
          receiptNumber: receipt.receiptNumber,
          assignmentId: receipt.assignmentId,
          personId: receipt.personId,
          vehicleId: receipt.vehicleId,
        },
      },
    });

    return receipt;
  }

  /**
   * List receipts with search & filters.
   */
  static async listReceipts(user, query = {}) {
    const where = {};
    const isChef = user.roles?.includes('CHEF_SERVICE') && !user.roles?.includes('SUPER_ADMIN') && !user.roles?.includes('DIRECTOR');
    const isAgent = user.roles?.includes('AGENT_TERRAIN') && !user.roles?.includes('CHEF_SERVICE') && !user.roles?.includes('SUPER_ADMIN') && !user.roles?.includes('DIRECTOR');

    if (isAgent) {
      where.agentUserId = user.id;
    } else if (isChef) {
      where.communeId = user.communeId;
    } else if (query.communeId) {
      const resolved = await this.resolveCommune(query.communeId);
      if (resolved) where.communeId = resolved.id;
    }

    if (query.assignmentId) where.assignmentId = query.assignmentId;
    if (query.agentUserId && !isAgent) where.agentUserId = query.agentUserId;

    if (query.search) {
      where.OR = [
        { receiptNumber: { contains: query.search, mode: 'insensitive' } },
        { person: { nin: { contains: query.search, mode: 'insensitive' } } },
        { vehicle: { plateNumber: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const receipts = await prisma.fieldReceipt.findMany({
      where,
      include: {
        agentUser: { select: { id: true, firstName: true, lastName: true, phoneNumber: true } },
        commune: { select: { id: true, code: true, name: true } },
        person: { select: { id: true, firstName: true, lastName: true, nin: true, phoneNumber: true } },
        vehicle: { select: { id: true, plateNumber: true, make: true, model: true } },
        assignment: { select: { id: true, reference: true, title: true, locationName: true } },
      },
      orderBy: { issuedAt: 'desc' },
      take: query.limit || 50,
      skip: ((query.page || 1) - 1) * (query.limit || 50),
    });

    const total = await prisma.fieldReceipt.count({ where });

    return {
      total,
      page: query.page || 1,
      limit: query.limit || 50,
      receipts,
    };
  }

  /**
   * Get single receipt by ID or Receipt Number.
   */
  static async getReceiptById(user, idOrNumber) {
    const receipt = await prisma.fieldReceipt.findFirst({
      where: {
        OR: [{ id: idOrNumber }, { receiptNumber: idOrNumber }],
      },
      include: {
        agentUser: { select: { id: true, firstName: true, lastName: true, phoneNumber: true, email: true } },
        commune: { select: { id: true, code: true, name: true } },
        person: { select: { id: true, firstName: true, lastName: true, nin: true, phoneNumber: true, address: true } },
        vehicle: { select: { id: true, plateNumber: true, registrationCardNumber: true, make: true, model: true, vehicleType: true } },
        assignment: { select: { id: true, reference: true, title: true, locationName: true, startDate: true } },
      },
    });

    if (!receipt) {
      throw new AppError('Récépissé de terrain introuvable.', 404, 'NOT_FOUND');
    }

    const isAgent = user.roles?.includes('AGENT_TERRAIN') && !user.roles?.includes('CHEF_SERVICE') && !user.roles?.includes('SUPER_ADMIN') && !user.roles?.includes('DIRECTOR');
    if (isAgent && receipt.agentUserId !== user.id) {
      throw new AppError('Accès refusé : vous ne pouvez consulter que vos propres récépissés.', 403, 'FORBIDDEN');
    }

    if (receipt.communeId) {
      this.enforceTerritoryScope(user, receipt.communeId);
    }

    return receipt;
  }

  /**
   * Team Management
   */
  static async listTeams(user) {
    const isChef = user.roles?.includes('CHEF_SERVICE') && !user.roles?.includes('SUPER_ADMIN') && !user.roles?.includes('DIRECTOR');
    const where = isChef && user.communeId ? { communeId: user.communeId } : {};

    return await prisma.fieldTeam.findMany({
      where,
      include: {
        commune: { select: { id: true, code: true, name: true } },
        leader: { select: { id: true, firstName: true, lastName: true, phoneNumber: true } },
        _count: { select: { assignments: true } },
      },
      orderBy: { code: 'asc' },
    });
  }

  static async createTeam(user, data) {
    let resolvedCommuneId = null;
    if (data.communeId) {
      const resolved = await this.resolveCommune(data.communeId);
      if (resolved) {
        this.enforceTerritoryScope(user, resolved.id);
        resolvedCommuneId = resolved.id;
      }
    } else if (user.communeId) {
      resolvedCommuneId = user.communeId;
    }

    return await prisma.fieldTeam.create({
      data: {
        code: data.code,
        name: data.name,
        communeId: resolvedCommuneId,
        leaderId: data.leaderId || null,
      },
      include: {
        commune: { select: { id: true, code: true, name: true } },
        leader: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }
}

export default FieldOperationsService;
