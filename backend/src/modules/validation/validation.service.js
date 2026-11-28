import crypto from 'crypto';
import prisma from '../../utils/prisma.js';
import logger from '../../utils/logger.js';
import { AppError } from '../../middlewares/errorHandler.js';
import ValidationStateMachine from './validation.machine.js';

const DOCUMENT_METADATA_SELECT = {
  id: true,
  fileName: true,
  originalName: true,
  mimeType: true,
  fileSizeBytes: true,
  fileHashSha256: true,
  category: true,
  uploadedByUserId: true,
  personId: true,
  vehicleId: true,
  createdAt: true,
};

export class ValidationService {
  /**
   * Helper to enrich a validation request with target entity details,
   * applicant details, documents, and formatted history steps.
   */
  static async enrichRequest(request) {
    if (!request) return null;

    let applicantName = 'Dossier d Enrôlement';
    let applicantPhone = 'N/A';
    let targetDetails = '';
    let communeName = request.commune?.name || 'Conakry';
    let documents = [];
    let targetEntity = null;

    if (request.entityType === 'DRIVER_ENROLMENT') {
      const driver = await prisma.driver.findUnique({
        where: { id: request.targetEntityId },
        include: {
          person: {
            include: {
              commune: true,
              documents: { select: DOCUMENT_METADATA_SELECT },
            },
          },
          union: true,
        },
      });

      if (driver) {
        targetEntity = driver;
        applicantName = `${driver.person?.firstName || ''} ${driver.person?.lastName || ''}`.trim() || 'Chauffeur';
        applicantPhone = driver.person?.phoneNumber || 'N/A';
        targetDetails = `Permis ${driver.licenseCategory || 'B'} • N° ${driver.drivingLicenseNumber} • ${driver.union ? driver.union.name : 'Indépendant'}`;
        communeName = request.commune?.name || driver.person?.commune?.name || 'Conakry';
        documents = (driver.person?.documents || []).map((doc) => ({
          id: doc.id,
          category: doc.category,
          label:
            doc.category === 'PHOTO_PORTRAIT'
              ? 'Photo d identité 4x4'
              : doc.category === 'CNI_RECTO'
              ? 'Carte Nationale d Identité (Recto)'
              : doc.category === 'CNI_VERSO'
              ? 'Carte Nationale d Identité (Verso)'
              : doc.category === 'PERMIS_CONDUIRE'
              ? 'Permis de Conduire biométrique'
              : doc.originalName || doc.fileName,
          url: `/api/v1/documents/${doc.id}/stream`,
        }));
      }
    } else if (request.entityType === 'VEHICLE_ENROLMENT') {
      const vehicle = await prisma.vehicle.findUnique({
        where: { id: request.targetEntityId },
        include: {
          owner: {
            include: {
              person: {
                include: {
                  commune: true,
                },
              },
            },
          },
          documents: { select: DOCUMENT_METADATA_SELECT },
          assignments: {
            include: {
              driver: {
                include: {
                  person: true,
                },
              },
            },
          },
        },
      });

      if (vehicle) {
        targetEntity = vehicle;
        applicantName =
          vehicle.owner?.businessName ||
          `${vehicle.owner?.person?.firstName || ''} ${vehicle.owner?.person?.lastName || ''}`.trim() ||
          'Propriétaire Véhicule';
        applicantPhone = vehicle.owner?.person?.phoneNumber || 'N/A';
        targetDetails = `${vehicle.make} ${vehicle.model} • Plaque ${vehicle.plateNumber} • VIN ${vehicle.chassisVin}`;
        communeName = request.commune?.name || vehicle.owner?.person?.commune?.name || 'Conakry';
        documents = (vehicle.documents || []).map((doc) => ({
          id: doc.id,
          category: doc.category,
          label:
            doc.category === 'CARTE_GRISE'
              ? 'Carte Grise officielle'
              : doc.category === 'VISITE_TECHNIQUE'
              ? 'Certificat Contrôle Technique valide'
              : doc.category === 'PHOTO_VEHICULE_AVANT'
              ? 'Photo Véhicule (Face avant)'
              : doc.originalName || doc.fileName,
          url: `/api/v1/documents/${doc.id}/stream`,
        }));
      }
    } else if (request.entityType === 'OWNER_ENROLMENT') {
      const owner = await prisma.owner.findUnique({
        where: { id: request.targetEntityId },
        include: {
          person: {
            include: {
              commune: true,
              documents: { select: DOCUMENT_METADATA_SELECT },
            },
          },
        },
      });

      if (owner) {
        targetEntity = owner;
        applicantName =
          owner.businessName ||
          `${owner.person?.firstName || ''} ${owner.person?.lastName || ''}`.trim() ||
          'Propriétaire';
        applicantPhone = owner.person?.phoneNumber || 'N/A';
        targetDetails = `NIN: ${owner.person?.nin || 'N/A'} • Type: ${owner.ownerType || 'INDIVIDUAL'}`;
        communeName = request.commune?.name || owner.person?.commune?.name || 'Conakry';
        documents = (owner.person?.documents || []).map((doc) => ({
          id: doc.id,
          category: doc.category,
          label: doc.category || doc.originalName || doc.fileName,
          url: `/api/v1/documents/${doc.id}/stream`,
        }));
      }
    }

    const history = (request.steps || []).map((step) => ({
      id: step.id,
      reviewerName: step.reviewer
        ? `${step.reviewer.firstName} ${step.reviewer.lastName}`
        : 'Chef des Agents',
      role: step.reviewer?.roles?.[0]?.role?.name || step.reviewer?.jobTitle || 'CHEF_SERVICE',
      action: step.action,
      comment: step.comment,
      timestamp: step.decidedAt
        ? new Date(step.decidedAt).toLocaleString('fr-FR')
        : '',
      decidedAt: step.decidedAt,
    }));

    const submitterName = request.submitter
      ? `${request.submitter.firstName} ${request.submitter.lastName}`
      : 'Agent Enrôleur';

    const latestStep = request.steps?.[0] || null;

    return {
      ...request,
      status: request.currentStatus || 'SOUMIS_NIVEAU2',
      currentStatus: request.currentStatus || 'SOUMIS_NIVEAU2',
      applicantName,
      applicantPhone,
      targetDetails,
      communeName,
      submitterName,
      documents,
      history,
      latestComment: latestStep?.comment || null,
      latestReviewerName: latestStep?.reviewer
        ? `${latestStep.reviewer.firstName} ${latestStep.reviewer.lastName}`
        : null,
      latestAction: latestStep?.action || null,
      targetEntity,
    };
  }

  /**
   * Creates a new validation request dossier for an enrolled driver, vehicle, or owner.
   */
  static async createRequest({ entityType, targetEntityId, communeId }, actorUser) {
    // 1. Verify target entity exists
    if (entityType === 'DRIVER_ENROLMENT') {
      const driver = await prisma.driver.findUnique({
        where: { id: targetEntityId },
        include: { person: true },
      });
      if (!driver) throw new AppError('Chauffeur introuvable.', 404, 'ENTITY_NOT_FOUND');
      communeId = communeId || driver.person.communeId || actorUser.communeId;
    } else if (entityType === 'VEHICLE_ENROLMENT') {
      const vehicle = await prisma.vehicle.findUnique({
        where: { id: targetEntityId },
        include: { owner: { include: { person: true } } },
      });
      if (!vehicle) throw new AppError('Véhicule introuvable.', 404, 'ENTITY_NOT_FOUND');
      communeId = communeId || vehicle.owner?.person?.communeId || actorUser.communeId;
    }

    // 2. Prevent duplicate pending requests for the same entity
    const existingPending = await prisma.validationRequest.findFirst({
      where: {
        targetEntityId,
        currentStatus: { in: ['BROUILLON', 'SOUMIS_NIVEAU2', 'EN_ATTENTE_NIVEAU3', 'RETOURNE_POUR_CORRECTION'] },
      },
    });

    if (existingPending) {
      throw new AppError(
        'Un dossier d examen est déjà en cours de traitement pour cette entité.',
        409,
        'PENDING_REQUEST_EXISTS'
      );
    }

    // 3. Generate unique sequential reference
    const requestNumber = `VAL-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const request = await prisma.validationRequest.create({
      data: {
        requestNumber,
        entityType,
        targetEntityId,
        submitterId: actorUser.id,
        currentLevel: 2, // Submitted directly to Chef des Agents (Level 2)
        currentStatus: 'SOUMIS_NIVEAU2',
        communeId: communeId || null,
        submittedAt: new Date(),
      },
      include: {
        submitter: { select: { id: true, firstName: true, lastName: true, email: true } },
        commune: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: actorUser.id,
        action: 'VALIDATION_REQUEST_CREATED',
        targetModule: 'VALIDATION',
        targetRecordId: request.id,
        newValues: { requestNumber, entityType, targetEntityId },
      },
    });

    return await this.enrichRequest(request);
  }

  /**
   * Executes a state transition atomically inside a database transaction.
   * Enforces mandatory rejection remark, role permission, and operational status synchronization.
   */
  static async executeTransition(requestId, { action, comment }, actorUser) {
    const trimmedComment = comment ? comment.trim() : null;

    // Strict validation: Rejection and Return require explanation
    if ((action === 'REJECT' || action === 'RETURN_FOR_CORRECTION')) {
      if (!trimmedComment || trimmedComment.length < 5) {
        throw new AppError(
          'Un motif circonstancié (au moins 5 caractères) est obligatoire pour motiver le rejet ou le renvoi d un dossier.',
          400,
          'MANDATORY_COMMENT_REQUIRED'
        );
      }
    }

    const updatedRequest = await prisma.$transaction(async (tx) => {
      // 1. Fetch current request state
      const request = await tx.validationRequest.findUnique({
        where: { id: requestId },
        include: { commune: true },
      });

      if (!request) {
        throw new AppError('Dossier de validation introuvable.', 404, 'REQUEST_NOT_FOUND');
      }

      // 2. Evaluate State Machine rules (Role, Scope, Self-Approval, Comment, Entity Type)
      const { newStatus, newLevel } = ValidationStateMachine.evaluate({
        currentStatus: request.currentStatus,
        action,
        reviewerUser: actorUser,
        submitterId: request.submitterId,
        comment: trimmedComment,
        requestCommuneId: request.communeId,
        entityType: request.entityType,
      });

      const isSubmitting = action === 'SUBMIT';
      const isFinalApproval = newStatus === 'VALIDE';
      const isFinalRejection = newStatus === 'REJETE';
      const isReturned = newStatus === 'RETOURNE_POUR_CORRECTION';

      // 3. Create the audit step record with the persisted comment and reviewer attribution
      await tx.validationStep.create({
        data: {
          validationRequestId: request.id,
          level: request.currentLevel,
          reviewerId: actorUser.id,
          action,
          previousStatus: request.currentStatus,
          newStatus,
          comment: trimmedComment,
        },
      });

      // 4. Update the ValidationRequest
      const updatedRequest = await tx.validationRequest.update({
        where: { id: request.id },
        data: {
          currentStatus: newStatus,
          currentLevel: newLevel,
          submittedAt: isSubmitting ? new Date() : request.submittedAt,
          finalDecisionAt: (isFinalApproval || isFinalRejection) ? new Date() : null,
        },
        include: {
          steps: {
            orderBy: { decidedAt: 'desc' },
            include: {
              reviewer: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  jobTitle: true,
                  roles: { include: { role: true } },
                },
              },
            },
          },
          submitter: { select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true } },
          commune: true,
        },
      });

      // 5. Side-effect: Synchronize underlying entity operational status
      if (isFinalApproval) {
        if (request.entityType === 'DRIVER_ENROLMENT') {
          await tx.driver.update({
            where: { id: request.targetEntityId },
            data: { status: 'ACTIF' },
          });
        } else if (request.entityType === 'VEHICLE_ENROLMENT') {
          await tx.vehicle.update({
            where: { id: request.targetEntityId },
            data: { status: 'ACTIF' },
          });
        }
      } else if (isFinalRejection) {
        if (request.entityType === 'DRIVER_ENROLMENT') {
          await tx.driver.update({
            where: { id: request.targetEntityId },
            data: { status: 'INACTIF' },
          });
        } else if (request.entityType === 'VEHICLE_ENROLMENT') {
          await tx.vehicle.update({
            where: { id: request.targetEntityId },
            data: { status: 'SUSPENDU' },
          });
        }
      } else if (isReturned) {
        if (request.entityType === 'DRIVER_ENROLMENT') {
          await tx.driver.update({
            where: { id: request.targetEntityId },
            data: { status: 'BROUILLON' },
          });
        } else if (request.entityType === 'VEHICLE_ENROLMENT') {
          await tx.vehicle.update({
            where: { id: request.targetEntityId },
            data: { status: 'BROUILLON' },
          });
        }
      }

      // 6. Record Audit Log with complete attribution and rejection reason
      await tx.auditLog.create({
        data: {
          actorId: actorUser.id,
          action: `VALIDATION_${action}`,
          targetModule: 'VALIDATION',
          targetRecordId: request.id,
          previousValues: { status: request.currentStatus, level: request.currentLevel },
          newValues: { status: newStatus, level: newLevel },
          reason: trimmedComment || null,
        },
      });

      logger.info('Validation transition executed successfully', {
        requestId: request.id,
        action,
        previousStatus: request.currentStatus,
        newStatus,
        actorId: actorUser.id,
        comment: trimmedComment,
      });

      return updatedRequest;
    }, { maxWait: 10000, timeout: 25000 });

    return await this.enrichRequest(updatedRequest);
  }

  /**
   * Retrieves a validation request with complete history steps and hydrated target entity.
   */
  static async getRequestById(requestId, actorUser) {
    const request = await prisma.validationRequest.findUnique({
      where: { id: requestId },
      include: {
        steps: {
          orderBy: { decidedAt: 'desc' },
          include: {
            reviewer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                jobTitle: true,
                roles: { include: { role: true } },
              },
            },
          },
        },
        submitter: { select: { id: true, firstName: true, lastName: true, phoneNumber: true, email: true } },
        commune: true,
      },
    });

    if (!request) {
      throw new AppError('Dossier de validation introuvable.', 404, 'REQUEST_NOT_FOUND');
    }

    // Scope check: Chef de Service can only review their assigned commune
    const userRoles = actorUser.roles || [];
    const isGlobal = userRoles.includes('SUPER_ADMIN') || userRoles.includes('DIRECTOR') || userRoles.includes('IT');
    if (!isGlobal && actorUser.communeId && request.communeId && actorUser.communeId !== request.communeId) {
      throw new AppError(
        'Accès refusé. Ce dossier relève d une autre commune.',
        403,
        'FORBIDDEN_COMMUNE_SCOPE'
      );
    }

    return await this.enrichRequest(request);
  }

  /**
   * List validation requests with scope and status filters, returning enriched dossiers.
   */
  static async listRequests({ page = 1, limit = 50, status = null, level = null, communeId = null }, actorUser) {
    const skip = (page - 1) * limit;

    const userRoles = actorUser.roles || [];
    const isGlobal = userRoles.includes('SUPER_ADMIN') || userRoles.includes('DIRECTOR') || userRoles.includes('IT');

    // Scoped filtering
    let filterCommuneId = undefined;
    if (!isGlobal && actorUser.communeId) {
      filterCommuneId = actorUser.communeId;
    } else if (communeId && communeId !== 'ALL') {
      filterCommuneId = communeId;
    }

    const where = {
      ...(status && status !== 'ALL' ? { currentStatus: status } : {}),
      ...(level ? { currentLevel: level } : {}),
      ...(filterCommuneId ? { communeId: filterCommuneId } : {}),
    };

    const [rawItems, total] = await Promise.all([
      prisma.validationRequest.findMany({
        where,
        skip,
        take: limit,
        include: {
          submitter: { select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true } },
          commune: true,
          steps: {
            orderBy: { decidedAt: 'desc' },
            include: {
              reviewer: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  jobTitle: true,
                  roles: { include: { role: true } },
                },
              },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.validationRequest.count({ where }),
    ]);

    // Enrich all items with applicant names, phones, documents, target details
    const items = await Promise.all(rawItems.map((r) => this.enrichRequest(r)));

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export default ValidationService;
