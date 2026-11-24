import crypto from 'crypto';
import prisma from '../../utils/prisma.js';
import logger from '../../utils/logger.js';
import { AppError } from '../../middlewares/errorHandler.js';
import SocketService from '../../services/socketService.js';

export class InspectionsService {
  /**
   * Normalize 3-state checkpoint to database enum (YES, NO, NOT_CHECKED)
   */
  static normalizeCheckpoint(val) {
    if (!val) return 'NOT_CHECKED';
    const upper = String(val).toUpperCase();
    if (upper === 'YES' || upper === 'CONFORME' || upper === 'TRUE') return 'YES';
    if (upper === 'NO' || upper === 'NON_CONFORME' || upper === 'FALSE') return 'NO';
    return 'NOT_CHECKED';
  }

  /**
   * Determine or validate InspectionOutcome enum
   */
  static normalizeOutcome(val, checkpoints = []) {
    if (val) {
      const upper = String(val).toUpperCase();
      if (['NOT_ASSESSED', 'CONFORME', 'NON_CONFORME', 'AVERTISSEMENT', 'INFRACTION'].includes(upper)) {
        return upper;
      }
      if (upper === 'AVEC_RESERVES') return 'AVERTISSEMENT';
      if (upper === 'IMMOBILISATION') return 'INFRACTION';
    }
    const allNotChecked = checkpoints.every((c) => c === 'NOT_CHECKED');
    if (allNotChecked) return 'NOT_ASSESSED';
    const anyNo = checkpoints.includes('NO');
    if (anyNo) return 'NON_CONFORME';
    if (checkpoints.every((c) => c === 'YES')) return 'CONFORME';
    return 'AVERTISSEMENT';
  }

  /**
   * Generates sequential/unique inspection reference (e.g. INS-2026-00042-4A2F).
   */
  static async generateInspectionReference() {
    const year = new Date().getFullYear();
    const count = await prisma.fieldInspection.count();
    const seq = String(count + 1).padStart(5, '0');
    const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `INS-${year}-${seq}-${randomSuffix}`;
  }

  /**
   * List field inspections with filtering and role-based territory scoping.
   */
  static async listInspections(user, query = {}) {
    const {
      page = 1,
      limit = 50,
      assignmentId,
      missionId,
      communeId,
      outcome,
      plateNumber,
      search,
    } = query;

    const skip = (Number(page) - 1) * Number(limit);
    const where = {};

    const isAgent = user.roles?.includes('AGENT_TERRAIN') && !user.roles?.includes('CHEF_SERVICE') && !user.roles?.includes('SUPER_ADMIN') && !user.roles?.includes('DIRECTOR');
    const isChef = user.roles?.includes('CHEF_SERVICE') && !user.roles?.includes('SUPER_ADMIN') && !user.roles?.includes('DIRECTOR');

    // 1. Territorial and ownership scoping
    if (isAgent) {
      where.OR = [
        { agentUserId: user.id },
        {
          assignment: {
            OR: [
              { assignedUserId: user.id },
              { assignedAgents: { some: { agentUserId: user.id } } },
            ],
          },
        },
      ];
    } else if (isChef) {
      where.communeId = user.communeId;
    } else if (communeId) {
      where.communeId = communeId;
    }

    // 2. Specific filters
    const targetMissionId = assignmentId || missionId;
    if (targetMissionId) {
      where.assignmentId = targetMissionId;
    }

    if (outcome) {
      where.outcome = outcome;
    }

    if (plateNumber) {
      where.plateNumber = { contains: plateNumber, mode: 'insensitive' };
    }

    if (search) {
      const searchConditions = [
        { reference: { contains: search, mode: 'insensitive' } },
        { plateNumber: { contains: search, mode: 'insensitive' } },
        { licenseNumber: { contains: search, mode: 'insensitive' } },
        { driverName: { contains: search, mode: 'insensitive' } },
        { driverPhone: { contains: search, mode: 'insensitive' } },
        { observations: { contains: search, mode: 'insensitive' } },
      ];
      if (where.OR) {
        where.AND = [
          { OR: where.OR },
          { OR: searchConditions },
        ];
        delete where.OR;
      } else {
        where.OR = searchConditions;
      }
    }

    const [inspections, total] = await Promise.all([
      prisma.fieldInspection.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          commune: { select: { id: true, code: true, name: true } },
          agentUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeNumber: true,
              phoneNumber: true,
            },
          },
          assignment: {
            select: {
              id: true,
              reference: true,
              title: true,
              status: true,
              locationName: true,
            },
          },
          documents: true,
        },
        orderBy: { inspectedAt: 'desc' },
      }),
      prisma.fieldInspection.count({ where }),
    ]);

    return {
      items: inspections,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  /**
   * Retrieve single inspection with security checks.
   */
  static async getInspectionById(user, id) {
    const inspection = await prisma.fieldInspection.findUnique({
      where: { id },
      include: {
        commune: { select: { id: true, code: true, name: true } },
        agentUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
            phoneNumber: true,
            avatarUrl: true,
          },
        },
        assignment: {
          include: {
            commune: { select: { id: true, code: true, name: true } },
            assignedAgents: {
              include: {
                agentUser: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    employeeNumber: true,
                  },
                },
              },
            },
          },
        },
        documents: true,
      },
    });

    if (!inspection) {
      throw new AppError('Contrôle de terrain introuvable.', 404, 'INSPECTION_NOT_FOUND');
    }

    const isAgent = user.roles?.includes('AGENT_TERRAIN') && !user.roles?.includes('CHEF_SERVICE') && !user.roles?.includes('SUPER_ADMIN') && !user.roles?.includes('DIRECTOR');
    const isChef = user.roles?.includes('CHEF_SERVICE') && !user.roles?.includes('SUPER_ADMIN') && !user.roles?.includes('DIRECTOR');

    if (isAgent) {
      const isAssigned = inspection.agentUserId === user.id ||
        inspection.assignment.assignedUserId === user.id ||
        inspection.assignment.assignedAgents?.some((a) => a.agentUserId === user.id);
      if (!isAssigned) {
        throw new AppError('Accès refusé : vous ne pouvez consulter que vos propres contrôles.', 403, 'FORBIDDEN');
      }
    } else if (isChef) {
      if (inspection.communeId !== user.communeId) {
        throw new AppError('Accès interdit : ce contrôle appartient à une autre commune.', 403, 'FORBIDDEN_COMMUNE_MISMATCH');
      }
    }

    return inspection;
  }

  /**
   * Create a field inspection record (Operational, physically isolated from administrative validations).
   */
  static async createInspection(user, data) {
    const targetMissionId = data.assignmentId || data.missionId;
    if (!targetMissionId) {
      throw new AppError('Identifiant de la mission requis.', 400, 'MISSION_ID_REQUIRED');
    }

    const assignment = await prisma.fieldAssignment.findUnique({
      where: { id: targetMissionId },
      include: {
        assignedAgents: true,
      },
    });

    if (!assignment) {
      throw new AppError('Mission de rattachement introuvable.', 404, 'MISSION_NOT_FOUND');
    }

    // Safety rule: Terminated or cancelled missions CANNOT accept new inspections
    if (assignment.status === 'COMPLETED' || assignment.status === 'CANCELLED') {
      throw new AppError(
        `Impossible d enregistrer une inspection : la mission est ${assignment.status === 'COMPLETED' ? 'terminée' : 'annulée'}.`,
        400,
        'MISSION_TERMINATED'
      );
    }

    // Scoping check for agents
    const isAgent = user.roles?.includes('AGENT_TERRAIN') && !user.roles?.includes('CHEF_SERVICE') && !user.roles?.includes('SUPER_ADMIN') && !user.roles?.includes('DIRECTOR');
    const isChef = user.roles?.includes('CHEF_SERVICE') && !user.roles?.includes('SUPER_ADMIN') && !user.roles?.includes('DIRECTOR');

    if (isAgent) {
      const isAssigned = assignment.assignedUserId === user.id ||
        assignment.assignedAgents.some((a) => a.agentUserId === user.id);
      if (!isAssigned) {
        throw new AppError('Accès refusé : vous n êtes pas assigné à cette mission de terrain.', 403, 'FORBIDDEN_ASSIGNMENT');
      }
    } else if (isChef) {
      if (assignment.communeId !== user.communeId) {
        throw new AppError('Accès refusé : la mission appartient à une autre commune.', 403, 'FORBIDDEN_COMMUNE');
      }
    }

    const reference = await this.generateInspectionReference();

    // Map three-state checkpoints (strictly default to NOT_CHECKED if unspecified)
    const hasValidLicense = this.normalizeCheckpoint(data.checkpointDriverLicense || data.hasValidLicense);
    const hasMunicipalSticker = this.normalizeCheckpoint(data.checkpointVehiclePermit || data.hasMunicipalSticker);
    const hasTechnicalControl = this.normalizeCheckpoint(data.checkpointTechnicalVisit || data.hasTechnicalControl);
    const isAuthorizedRoute = this.normalizeCheckpoint(data.isAuthorizedRoute);
    const hasSafetyEquipment = this.normalizeCheckpoint(data.checkpointFireExtinguisher || data.hasSafetyEquipment);

    // Outcome determination: An inspection must NEVER automatically be compliant when checkpoints are unverified
    const checkpoints = [hasValidLicense, hasMunicipalSticker, hasTechnicalControl, isAuthorizedRoute, hasSafetyEquipment];
    const calculatedOutcome = this.normalizeOutcome(data.outcome, checkpoints);

    const targetType = data.targetType || (data.vehiclePlate || data.plateNumber ? 'VEHICLE' : 'DRIVER');
    const plateNumber = data.vehiclePlate || data.plateNumber || null;
    const licenseNumber = data.driverLicenseNumber || data.licenseNumber || null;
    const driverName = data.driverName || null;
    const driverPhone = data.driverPhone || null;
    const vehicleType = data.vehicleType || null;
    const observations = data.notes || data.observations || null;
    const violations = data.infractions || data.violations || [];

    const documentsToCreate = Array.isArray(data.documents)
      ? data.documents.map((d) => ({
          category: d.documentType || d.category || 'VIOLATION_EVIDENCE',
          fileUrl: d.fileUrl,
          mimeType: d.mimeType || 'image/jpeg',
          fileHash: d.fileHash || null,
        }))
      : [];

    const result = await prisma.$transaction(async (tx) => {
      const inspection = await tx.fieldInspection.create({
        data: {
          reference,
          assignmentId: assignment.id,
          agentUserId: user.id,
          communeId: assignment.communeId,
          vehicleId: data.vehicleId || null,
          personId: data.personId || null,
          targetType,
          plateNumber,
          licenseNumber,
          driverName,
          driverPhone,
          vehicleType,
          hasValidLicense,
          hasMunicipalSticker,
          hasTechnicalControl,
          isAuthorizedRoute,
          hasSafetyEquipment,
          outcome: calculatedOutcome,
          violations,
          observations,
          latitude: data.latitude || null,
          longitude: data.longitude || null,
          locationName: data.locationName || assignment.locationName || null,
          documents: documentsToCreate.length > 0
            ? {
                create: documentsToCreate,
              }
            : undefined,
        },
        include: {
          commune: { select: { id: true, code: true, name: true } },
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
      });

      // If assignment was ASSIGNED, transition to IN_PROGRESS upon first active inspection
      if (assignment.status === 'ASSIGNED') {
        await tx.fieldAssignment.update({
          where: { id: assignment.id },
          data: { status: 'IN_PROGRESS' },
        });
      }

      await tx.auditLog.create({
        data: {
          actor: user?.id ? { connect: { id: user.id } } : undefined,
          action: 'FIELD_INSPECTION_RECORDED',
          targetModule: 'FIELD_OPERATIONS',
          targetRecordId: inspection.id,
          newValues: {
            reference: inspection.reference,
            assignmentId: assignment.id,
            outcome: inspection.outcome,
            plateNumber: inspection.plateNumber,
            licenseNumber: inspection.licenseNumber,
          },
        },
      });

      return inspection;
    });

    SocketService.emitNotification(
      `commune:${assignment.communeId}`,
      'field:inspection_recorded',
      {
        id: result.id,
        reference: result.reference,
        assignmentId: assignment.id,
        outcome: result.outcome,
        plateNumber: result.plateNumber,
      }
    );

    logger.info('Field inspection recorded', {
      inspectionId: result.id,
      reference: result.reference,
      agentId: user.id,
      outcome: result.outcome,
    });

    return result;
  }
}

export default InspectionsService;
