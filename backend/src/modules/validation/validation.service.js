import crypto from 'crypto';
import prisma from '../../utils/prisma.js';
import logger from '../../utils/logger.js';
import { AppError } from '../../middlewares/errorHandler.js';
import ValidationStateMachine from './validation.machine.js';

export class ValidationService {
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
        currentLevel: 1,
        currentStatus: 'BROUILLON',
        communeId: communeId || null,
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

    return request;
  }

  /**
   * Executes a state transition atomically inside a database transaction.
   */
  static async executeTransition(requestId, { action, comment }, actorUser) {
    return await prisma.$transaction(async (tx) => {
      // 1. Fetch current request state
      const request = await tx.validationRequest.findUnique({
        where: { id: requestId },
        include: { commune: true },
      });

      if (!request) {
        throw new AppError('Dossier de validation introuvable.', 404, 'REQUEST_NOT_FOUND');
      }

      // 2. Evaluate State Machine rules (Role, Scope, Self-Approval, Comment)
      const { newStatus, newLevel } = ValidationStateMachine.evaluate({
        currentStatus: request.currentStatus,
        action,
        reviewerUser: actorUser,
        submitterId: request.submitterId,
        comment,
        requestCommuneId: request.communeId,
      });

      const isSubmitting = action === 'SUBMIT';
      const isFinalApproval = newStatus === 'VALIDE';
      const isFinalRejection = newStatus === 'REJETE';

      // 3. Create the audit step record
      const step = await tx.validationStep.create({
        data: {
          validationRequestId: request.id,
          level: request.currentLevel,
          reviewerId: actorUser.id,
          action,
          previousStatus: request.currentStatus,
          newStatus,
          comment: comment ? comment.trim() : null,
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
              reviewer: { select: { id: true, firstName: true, lastName: true } },
            },
          },
          submitter: { select: { id: true, firstName: true, lastName: true } },
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
      }

      // 6. Record Audit Log
      await tx.auditLog.create({
        data: {
          actorId: actorUser.id,
          action: `VALIDATION_${action}`,
          targetModule: 'VALIDATION',
          targetRecordId: request.id,
          previousValues: { status: request.currentStatus, level: request.currentLevel },
          newValues: { status: newStatus, level: newLevel },
          reason: comment || null,
        },
      });

      logger.info('Validation transition executed successfully', {
        requestId: request.id,
        action,
        previousStatus: request.currentStatus,
        newStatus,
        actorId: actorUser.id,
      });

      return updatedRequest;
    });
  }

  /**
   * Retrieves a validation request with complete history steps.
   */
  static async getRequestById(requestId, actorUser) {
    const request = await prisma.validationRequest.findUnique({
      where: { id: requestId },
      include: {
        steps: {
          orderBy: { decidedAt: 'asc' },
          include: {
            reviewer: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        submitter: { select: { id: true, firstName: true, lastName: true, phoneNumber: true } },
        commune: true,
      },
    });

    if (!request) {
      throw new AppError('Dossier de validation introuvable.', 404, 'REQUEST_NOT_FOUND');
    }

    // Scope check: Chef de Service or Agent can only view their commune
    const isGlobal = actorUser.roles.includes('SUPER_ADMIN') || actorUser.roles.includes('DIRECTOR');
    if (!isGlobal && actorUser.communeId && request.communeId && actorUser.communeId !== request.communeId) {
      throw new AppError(
        'Accès refusé. Ce dossier relève d une autre commune.',
        403,
        'FORBIDDEN_COMMUNE_SCOPE'
      );
    }

    return request;
  }

  /**
   * List validation requests with scope and status filters.
   */
  static async listRequests({ page = 1, limit = 20, status = null, level = null, communeId = null }, actorUser) {
    const skip = (page - 1) * limit;

    // Filter by scope
    const filterCommuneId = actorUser.communeId || communeId || undefined;

    const where = {
      ...(status ? { currentStatus: status } : {}),
      ...(level ? { currentLevel: level } : {}),
      ...(filterCommuneId ? { communeId: filterCommuneId } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.validationRequest.findMany({
        where,
        skip,
        take: limit,
        include: {
          submitter: { select: { id: true, firstName: true, lastName: true } },
          commune: true,
          _count: { select: { steps: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.validationRequest.count({ where }),
    ]);

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
