import crypto from 'crypto';
import prisma from '../../utils/prisma.js';
import logger from '../../utils/logger.js';
import { AppError } from '../../middlewares/errorHandler.js';
import CryptoSignatureService from '../../services/cryptoSignatureService.js';
import PdfBadgeService from '../../services/pdfBadgeService.js';

export class BadgeService {
  /**
   * Enforces territorial and role scope for badge validation/rejection.
   * - DIRECTOR: Global national authority for credential issuance and badge validation.
   * - CHEF_SERVICE: Territorial authority for chauffeurs within their assigned commune.
   */
  static enforceBadgeValidationScope(actorUser, driver) {
    const userRoles = actorUser?.roles || [];
    const isDirector = userRoles.includes('DIRECTOR');
    const isChef = userRoles.includes('CHEF_SERVICE');

    if (!isDirector && !isChef) {
      throw new AppError(
        'Permissions insuffisantes : votre rôle ne vous autorise pas à valider ou rejeter un badge chauffeur.',
        403,
        'FORBIDDEN_ROLE'
      );
    }

    if (isChef && !isDirector) {
      const driverCommuneId = driver?.person?.communeId || null;
      if (actorUser.communeId && driverCommuneId && actorUser.communeId !== driverCommuneId) {
        throw new AppError(
          'Accès refusé : vous ne pouvez valider ou rejeter que les badges des chauffeurs rattachés à votre commune.',
          403,
          'FORBIDDEN_COMMUNE_SCOPE'
        );
      }
    }
  }

  /**
   * Formats a Driver + latest DriverBadge + ValidationRequest + AuditLogs into a unified badge record.
   */
  static formatDriverBadgeRecord(driver, valReq = null, badgeAudits = []) {
    const sortedBadges = Array.isArray(driver.badges)
      ? [...driver.badges].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      : [];
    const activeBadge = sortedBadges.find((b) => b.status === 'ACTIF') || null;
    const latestBadge = activeBadge || sortedBadges[0] || null;

    const latestDossierStep = valReq?.steps?.[0] || null;
    const latestDossierComment = latestDossierStep?.comment || null;
    const dossierStatus =
      valReq?.currentStatus || (driver.status === 'ACTIF' ? 'VALIDE' : 'SOUMIS_NIVEAU2');

    const isDossierApproved = driver.status === 'ACTIF';
    const isPaymentConfirmed = Boolean(
      driver.isPaymentConfirmed !== false &&
        (latestBadge ? latestBadge.isPaymentConfirmed !== false : true)
    );

    let badgeWorkflowStatus = 'NON_ELIGIBLE_DOSSIER';
    let status = 'NON_ELIGIBLE';
    let eligibilityReason = '';

    if (latestBadge && (latestBadge.status === 'REVOQUE' || latestBadge.status === 'SUSPENDU')) {
      badgeWorkflowStatus = 'REJETE';
      status = latestBadge.status === 'SUSPENDU' ? 'SUSPENDU' : 'REVOQUE';
      eligibilityReason = `Badge rejeté / suspendu : « ${
        latestBadge.suspensionReason || 'Motif administratif'
      } ».`;
    } else if (!isDossierApproved) {
      badgeWorkflowStatus = 'NON_ELIGIBLE_DOSSIER';
      status = 'NON_ELIGIBLE';
      if (dossierStatus === 'REJETE' || driver.status === 'INACTIF') {
        eligibilityReason = `Non éligible au badge : Le dossier d'enrôlement du chauffeur a été rejeté par le Chef des Agents${
          latestDossierComment ? ` (« ${latestDossierComment} »)` : ''
        }.`;
      } else if (dossierStatus === 'RETOURNE_POUR_CORRECTION' || driver.status === 'BROUILLON') {
        eligibilityReason = `Non éligible au badge : Dossier retourné à l'agent pour correction${
          latestDossierComment ? ` (« ${latestDossierComment} »)` : ''
        }.`;
      } else {
        eligibilityReason =
          "Non éligible au badge : Le dossier d'enrôlement est en attente de validation préalable par le Chef des Agents (Statut : En attente Chef).";
      }
    } else if (!isPaymentConfirmed) {
      badgeWorkflowStatus = 'ATTENTE_PAIEMENT';
      status = 'ATTENTE_PAIEMENT';
      eligibilityReason =
        "En attente de paiement : Le dossier du chauffeur est approuvé, mais le paiement des droits d'enrôlement doit être confirmé avant la validation et l'impression du badge.";
    } else if (activeBadge) {
      badgeWorkflowStatus = 'VALIDE';
      status = 'ACTIF';
      eligibilityReason =
        'Badge validé, signé cryptographiquement (Ed25519) et prêt pour impression CR80.';
    } else {
      badgeWorkflowStatus = 'EN_ATTENTE_VALIDATION';
      status = 'EN_ATTENTE_VALIDATION';
      eligibilityReason =
        'Chauffeur éligible : Dossier approuvé par le Chef des Agents et paiement en règle. En attente de validation du badge professionnel CR80.';
    }

    const portraitDoc = (driver.person?.documents || []).find(
      (d) => d.category === 'PHOTO_PORTRAIT'
    );

    // Build chronological validation history combining dossier steps and badge audits
    const history = [];

    for (const audit of badgeAudits) {
      const actorName = audit.actor
        ? `${audit.actor.firstName || ''} ${audit.actor.lastName || ''}`.trim()
        : 'Autorité AOTUC';
      const actorRole =
        audit.actor?.roles?.[0]?.role?.name || audit.actor?.jobTitle || 'DIRECTION';
      history.push({
        id: audit.id,
        action: audit.action,
        label:
          audit.action === 'DRIVER_BADGE_ISSUED' || audit.action === 'DRIVER_BADGE_VALIDATED'
            ? 'Badge Validé & Émis (Ed25519)'
            : audit.action === 'DRIVER_BADGE_REJECTED'
            ? 'Badge Rejeté'
            : audit.action === 'DRIVER_BADGE_SUSPENDED'
            ? 'Badge Suspendu / Révoqué'
            : audit.action === 'DRIVER_PAYMENT_CONFIRMED'
            ? 'Paiement Chauffeur Confirmé'
            : audit.action === 'DRIVER_BADGE_PRINTED'
            ? 'Badge Imprimé / PDF Généré'
            : audit.action,
        actorName,
        actorRole,
        comment: audit.reason || audit.newValues?.comment || null,
        timestamp: audit.timestamp,
        formattedDate: audit.timestamp
          ? new Date(audit.timestamp).toLocaleString('fr-FR')
          : '',
      });
    }

    if (Array.isArray(valReq?.steps)) {
      for (const step of valReq.steps) {
        const reviewerName = step.reviewer
          ? `${step.reviewer.firstName || ''} ${step.reviewer.lastName || ''}`.trim()
          : 'Chef des Agents';
        const reviewerRole =
          step.reviewer?.roles?.[0]?.role?.name || step.reviewer?.jobTitle || 'CHEF_SERVICE';
        history.push({
          id: `step-${step.id}`,
          action: `DOSSIER_${step.action}`,
          label:
            step.action === 'APPROVE_FINAL'
              ? 'Dossier Chauffeur Approuvé (Chef des Agents)'
              : step.action === 'REJECT'
              ? 'Dossier Chauffeur Rejeté'
              : step.action === 'RETURN_FOR_CORRECTION'
              ? 'Dossier Retourné pour Correction'
              : `Dossier : ${step.action}`,
          actorName: reviewerName,
          actorRole: reviewerRole,
          comment: step.comment || null,
          timestamp: step.decidedAt,
          formattedDate: step.decidedAt
            ? new Date(step.decidedAt).toLocaleString('fr-FR')
            : '',
        });
      }
    }

    history.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

    const issueDateObj = latestBadge?.issuedAt
      ? new Date(latestBadge.issuedAt)
      : new Date(driver.createdAt);
    const expiryDateObj = latestBadge?.expiresAt
      ? new Date(latestBadge.expiresAt)
      : new Date(issueDateObj.getTime() + 365 * 24 * 3600 * 1000);

    const badgeNumberDisplay =
      latestBadge && latestBadge.status === 'ACTIF'
        ? latestBadge.badgeNumber
        : latestBadge && (latestBadge.status === 'REVOQUE' || latestBadge.status === 'SUSPENDU')
        ? latestBadge.badgeNumber
        : `EN-ATTENTE (${driver.drivingLicenseNumber})`;

    return {
      id: latestBadge?.id || driver.id,
      badgeId: latestBadge?.id || null,
      driverId: driver.id,
      badgeNumber: badgeNumberDisplay,
      registrationNumber: latestBadge?.badgeNumber || driver.drivingLicenseNumber,
      hasIssuedBadge: Boolean(activeBadge),
      driverName: `${driver.person?.firstName || ''} ${driver.person?.lastName || ''}`.trim(),
      firstName: driver.person?.firstName || '',
      lastName: driver.person?.lastName || '',
      dateOfBirth: driver.person?.dateOfBirth
        ? new Date(driver.person.dateOfBirth).toLocaleDateString('fr-FR')
        : 'Non renseignée',
      phoneNumber: driver.person?.phoneNumber || 'N/A',
      nin: driver.person?.nin || 'N/A',
      licenseNumber: driver.drivingLicenseNumber,
      categories: driver.licenseCategory || 'B',
      licenseExpirationDate: driver.licenseExpirationDate
        ? new Date(driver.licenseExpirationDate).toISOString().slice(0, 10)
        : '',
      activitySector: driver.union?.name
        ? `Transport Urbain — ${driver.union.name}`
        : 'Transport Urbain — Taxi Communal',
      unionName: driver.union?.name || 'Indépendant',
      commune: driver.person?.commune?.name || 'Conakry',
      communeId: driver.person?.communeId || null,
      issueDate: issueDateObj.toISOString().slice(0, 10),
      expiryDate: expiryDateObj.toISOString().slice(0, 10),
      status,
      badgeWorkflowStatus,
      driverStatus: driver.status,
      dossierStatus,
      dossierRequestNumber: valReq?.requestNumber || null,
      isDossierApproved,
      isEligibleForValidation: isDossierApproved && isPaymentConfirmed,
      canPrint: Boolean(activeBadge && isDossierApproved && isPaymentConfirmed),
      isPaymentConfirmed,
      paymentReference: latestBadge?.paymentReference || null,
      rejectionReason:
        latestBadge?.suspensionReason ||
        (dossierStatus === 'REJETE' || dossierStatus === 'RETOURNE_POUR_CORRECTION'
          ? latestDossierComment
          : null) ||
        null,
      eligibilityReason,
      signaturePreview:
        activeBadge?.qrPayload ||
        `APERÇU_NON_SIGNÉ.ed25519_2026_01.DRV_${driver.id.slice(0, 8)}.${driver.drivingLicenseNumber}`,
      photoDocumentId: portraitDoc?.id || null,
      photoUrl: portraitDoc ? `/api/v1/documents/${portraitDoc.id}/stream` : null,
      printCount: latestBadge?.printCount || 0,
      printedAt: latestBadge?.printedAt || null,
      validationHistory: history,
      createdAt: driver.createdAt,
      updatedAt: latestBadge?.updatedAt || driver.updatedAt,
    };
  }

  /**
   * Lists all enrolled chauffeurs with their badge status, eligibility, payment state, and history.
   */
  static async listDriverBadges(
    actorUser,
    { search = '', status = 'ALL', communeId = null, page = 1, limit = 100 } = {}
  ) {
    const userRoles = actorUser?.roles || [];
    const isGlobal =
      userRoles.includes('SUPER_ADMIN') ||
      userRoles.includes('DIRECTOR') ||
      userRoles.includes('IT');

    let effectiveCommuneId = undefined;
    if (!isGlobal && actorUser?.communeId) {
      effectiveCommuneId = actorUser.communeId;
    } else if (communeId && communeId !== 'ALL') {
      effectiveCommuneId = communeId;
    }

    const trimmedSearch = search ? String(search).trim() : '';

    const where = {
      ...(effectiveCommuneId
        ? {
            person: {
              communeId: effectiveCommuneId,
            },
          }
        : {}),
      ...(trimmedSearch
        ? {
            OR: [
              { drivingLicenseNumber: { contains: trimmedSearch, mode: 'insensitive' } },
              { person: { firstName: { contains: trimmedSearch, mode: 'insensitive' } } },
              { person: { lastName: { contains: trimmedSearch, mode: 'insensitive' } } },
              { person: { nin: { contains: trimmedSearch, mode: 'insensitive' } } },
              { person: { phoneNumber: { contains: trimmedSearch, mode: 'insensitive' } } },
              {
                badges: {
                  some: {
                    badgeNumber: { contains: trimmedSearch, mode: 'insensitive' },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const drivers = await prisma.driver.findMany({
      where,
      take: Number(limit) || 100,
      skip: ((Number(page) || 1) - 1) * (Number(limit) || 100),
      include: {
        person: {
          include: {
            commune: true,
            documents: true,
          },
        },
        union: true,
        badges: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const driverIds = drivers.map((d) => d.id);
    const badgeIds = drivers.flatMap((d) => (d.badges || []).map((b) => b.id));

    const [valRequests, badgeAudits] = await Promise.all([
      driverIds.length > 0
        ? prisma.validationRequest.findMany({
            where: {
              entityType: 'DRIVER_ENROLMENT',
              targetEntityId: { in: driverIds },
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
            },
            orderBy: { updatedAt: 'desc' },
          })
        : [],
      driverIds.length > 0
        ? prisma.auditLog.findMany({
            where: {
              targetModule: 'BADGES',
              targetRecordId: { in: [...driverIds, ...badgeIds] },
            },
            include: {
              actor: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  jobTitle: true,
                  roles: { include: { role: true } },
                },
              },
            },
            orderBy: { timestamp: 'desc' },
          })
        : [],
    ]);

    const valMap = new Map();
    for (const vr of valRequests) {
      if (!valMap.has(vr.targetEntityId)) {
        valMap.set(vr.targetEntityId, vr);
      }
    }

    let items = drivers.map((driver) => {
      const driverBadgeIds = new Set((driver.badges || []).map((b) => b.id));
      const relevantAudits = badgeAudits.filter(
        (a) => a.targetRecordId === driver.id || driverBadgeIds.has(a.targetRecordId)
      );
      return this.formatDriverBadgeRecord(driver, valMap.get(driver.id) || null, relevantAudits);
    });

    const counts = {
      total: items.length,
      pendingValidation: items.filter((i) => i.badgeWorkflowStatus === 'EN_ATTENTE_VALIDATION').length,
      validated: items.filter((i) => i.badgeWorkflowStatus === 'VALIDE').length,
      awaitingPayment: items.filter((i) => i.badgeWorkflowStatus === 'ATTENTE_PAIEMENT').length,
      nonEligibleDossier: items.filter((i) => i.badgeWorkflowStatus === 'NON_ELIGIBLE_DOSSIER').length,
      rejected: items.filter((i) => i.badgeWorkflowStatus === 'REJETE').length,
    };

    if (status && status !== 'ALL') {
      items = items.filter(
        (item) => item.badgeWorkflowStatus === status || item.status === status
      );
    }

    return {
      items,
      counts,
    };
  }

  /**
   * Retrieves a single driver's badge record with complete details and validation history.
   */
  static async getDriverBadgeDetails(driverOrBadgeId, actorUser) {
    let driver = await prisma.driver.findUnique({
      where: { id: driverOrBadgeId },
      include: {
        person: { include: { commune: true, documents: true } },
        union: true,
        badges: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!driver) {
      const badge = await prisma.driverBadge.findUnique({
        where: { id: driverOrBadgeId },
        include: {
          driver: {
            include: {
              person: { include: { commune: true, documents: true } },
              union: true,
              badges: { orderBy: { createdAt: 'desc' } },
            },
          },
        },
      });
      if (badge?.driver) {
        driver = badge.driver;
      }
    }

    if (!driver) {
      throw new AppError('Chauffeur ou badge introuvable.', 404, 'DRIVER_NOT_FOUND');
    }

    const userRoles = actorUser?.roles || [];
    const isGlobal =
      userRoles.includes('SUPER_ADMIN') ||
      userRoles.includes('DIRECTOR') ||
      userRoles.includes('IT');

    if (
      !isGlobal &&
      actorUser?.communeId &&
      driver.person?.communeId &&
      actorUser.communeId !== driver.person.communeId
    ) {
      throw new AppError(
        'Accès refusé. Ce chauffeur est rattaché à une autre commune.',
        403,
        'FORBIDDEN_COMMUNE_SCOPE'
      );
    }

    const badgeIds = (driver.badges || []).map((b) => b.id);
    const [valReq, badgeAudits] = await Promise.all([
      prisma.validationRequest.findFirst({
        where: {
          entityType: 'DRIVER_ENROLMENT',
          targetEntityId: driver.id,
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
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.auditLog.findMany({
        where: {
          targetModule: 'BADGES',
          targetRecordId: { in: [driver.id, ...badgeIds] },
        },
        include: {
          actor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              jobTitle: true,
              roles: { include: { role: true } },
            },
          },
        },
        orderBy: { timestamp: 'desc' },
      }),
    ]);

    return this.formatDriverBadgeRecord(driver, valReq, badgeAudits);
  }

  /**
   * Issues / Validates a signed CR80 professional badge for an approved driver.
   */
  static async issueDriverBadge(driverId, actorUser, { comment = null } = {}) {
    // 1. Verify driver exists and is approved (ACTIF)
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      include: {
        person: { include: { commune: true, documents: true } },
        union: true,
        badges: {
          where: { status: 'ACTIF' },
        },
      },
    });

    if (!driver) {
      throw new AppError('Chauffeur introuvable.', 404, 'DRIVER_NOT_FOUND');
    }

    // Enforce role & commune scope
    this.enforceBadgeValidationScope(actorUser, driver);

    if (driver.status !== 'ACTIF') {
      throw new AppError(
        'Délivrance impossible : le dossier du chauffeur doit impérativement avoir été approuvé au préalable par le Chef des Agents (statut ACTIF).',
        400,
        'DRIVER_NOT_ELIGIBLE'
      );
    }

    // Payment Gate: Badge can only become valid and issued after payment has been confirmed
    if (driver.isPaymentConfirmed === false) {
      throw new AppError(
        'Délivrance impossible : Le paiement des droits d enrôlement du chauffeur n a pas encore été confirmé.',
        400,
        'PAYMENT_NOT_CONFIRMED'
      );
    }

    // 2. Compute 1-year validity period
    const issuedAt = new Date();
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    // 3. Generate unique sequential badge serial (CH-YYYY-HEX)
    const badgeNumber = `CH-${issuedAt.getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // 4. Cryptographically sign the credential using Ed25519 private key
    const { keyId, signature, qrPayload } = CryptoSignatureService.signCredential({
      credentialId: badgeNumber,
      type: 'DRIVER_BADGE',
      targetId: driver.id,
      issuedAt,
      expiresAt,
    });

    // 5. Atomic database execution: replace existing active or rejected badge if renewal/replacement
    const newBadge = await prisma.$transaction(async (tx) => {
      let replacesBadgeId = null;

      const existingBadges = await tx.driverBadge.findMany({
        where: { driverId: driver.id, status: { in: ['ACTIF', 'REVOQUE', 'SUSPENDU'] } },
        orderBy: { createdAt: 'desc' },
      });

      if (existingBadges.length > 0) {
        const previousBadge = existingBadges[0];
        replacesBadgeId = previousBadge.id;

        await tx.driverBadge.updateMany({
          where: { driverId: driver.id, status: { in: ['ACTIF', 'REVOQUE', 'SUSPENDU'] } },
          data: { status: 'REMPLACE' },
        });

        if (previousBadge.status === 'ACTIF') {
          await tx.credentialRevocation.create({
            data: {
              credentialType: 'DRIVER_BADGE',
              credentialId: previousBadge.id,
              serialNumber: previousBadge.badgeNumber,
              revokedByUserId: actorUser.id,
              reason: `Remplacé par le nouveau badge ${badgeNumber}`,
            },
          });
        }
      }

      // Create new badge
      const createdBadge = await tx.driverBadge.create({
        data: {
          driverId: driver.id,
          badgeNumber,
          qrPayload,
          signature,
          keyId,
          issuedAt,
          expiresAt,
          status: 'ACTIF',
          isPaymentConfirmed: driver.isPaymentConfirmed ?? true,
          replacesBadgeId,
        },
        include: {
          driver: {
            include: { person: { include: { commune: true } }, union: true },
          },
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          actorId: actorUser.id,
          action: 'DRIVER_BADGE_ISSUED',
          targetModule: 'BADGES',
          targetRecordId: driver.id,
          reason: comment ? comment.trim() : 'Validation et émission officielle du badge chauffeur CR80',
          newValues: {
            badgeId: createdBadge.id,
            badgeNumber,
            driverId: driver.id,
            keyId,
            expiresAt,
            comment: comment ? comment.trim() : null,
          },
        },
      });

      logger.info('Driver badge validated, issued and signed', {
        badgeNumber,
        driverId: driver.id,
        keyId,
        actorId: actorUser.id,
      });

      return createdBadge;
    }, { maxWait: 10000, timeout: 25000 });

    return newBadge;
  }

  /**
   * Rejects a driver's badge (before or after issuance) with a mandatory explanation.
   */
  static async rejectDriverBadge(driverOrBadgeId, reason, actorUser) {
    if (!reason || String(reason).trim().length < 5) {
      throw new AppError(
        'Un motif circonstancié (au moins 5 caractères) est obligatoire pour rejeter un badge.',
        400,
        'REASON_REQUIRED'
      );
    }

    const trimmedReason = String(reason).trim();

    let driver = await prisma.driver.findUnique({
      where: { id: driverOrBadgeId },
      include: {
        person: { include: { commune: true } },
        badges: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!driver) {
      const badge = await prisma.driverBadge.findUnique({
        where: { id: driverOrBadgeId },
        include: {
          driver: {
            include: {
              person: { include: { commune: true } },
              badges: { orderBy: { createdAt: 'desc' } },
            },
          },
        },
      });
      if (badge?.driver) {
        driver = badge.driver;
      }
    }

    if (!driver) {
      throw new AppError('Chauffeur ou badge introuvable.', 404, 'DRIVER_NOT_FOUND');
    }

    // Enforce role and commune scope
    this.enforceBadgeValidationScope(actorUser, driver);

    await prisma.$transaction(async (tx) => {
      const existingActiveOrLatest = driver.badges?.[0] || null;
      let targetBadge;

      if (existingActiveOrLatest) {
        targetBadge = await tx.driverBadge.update({
          where: { id: existingActiveOrLatest.id },
          data: {
            status: 'REVOQUE',
            suspendedAt: new Date(),
            suspensionReason: trimmedReason,
          },
        });

        await tx.credentialRevocation.create({
          data: {
            credentialType: 'DRIVER_BADGE',
            credentialId: targetBadge.id,
            serialNumber: targetBadge.badgeNumber,
            revokedByUserId: actorUser.id,
            reason: trimmedReason,
            isPermanent: false,
          },
        });
      } else {
        const now = new Date();
        const rejectedBadgeNumber = `CH-REJ-${now.getFullYear()}-${crypto
          .randomBytes(3)
          .toString('hex')
          .toUpperCase()}`;

        targetBadge = await tx.driverBadge.create({
          data: {
            driverId: driver.id,
            badgeNumber: rejectedBadgeNumber,
            qrPayload: 'REJECTED',
            signature: 'REJECTED',
            keyId: 'ed25519_2026_01',
            issuedAt: now,
            expiresAt: now,
            status: 'REVOQUE',
            suspendedAt: now,
            suspensionReason: trimmedReason,
            isPaymentConfirmed: driver.isPaymentConfirmed ?? true,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: actorUser.id,
          action: 'DRIVER_BADGE_REJECTED',
          targetModule: 'BADGES',
          targetRecordId: driver.id,
          reason: trimmedReason,
          newValues: {
            badgeId: targetBadge.id,
            badgeNumber: targetBadge.badgeNumber,
            driverId: driver.id,
            status: 'REVOQUE',
            reason: trimmedReason,
          },
        },
      });
    }, { maxWait: 10000, timeout: 25000 });

    return await this.getDriverBadgeDetails(driver.id, actorUser);
  }

  /**
   * Suspends a badge with mandatory justification (Director/Chef within commune).
   */
  static async suspendBadge(badgeOrDriverId, reason, actorUser) {
    if (!reason || reason.trim().length < 5) {
      throw new AppError(
        'Un motif de suspension officiel est obligatoire (au moins 5 caractères).',
        400,
        'REASON_REQUIRED'
      );
    }

    return await prisma.$transaction(async (tx) => {
      let badge = await tx.driverBadge.findUnique({
        where: { id: badgeOrDriverId },
        include: { driver: { include: { person: true } } },
      });

      if (!badge) {
        badge = await tx.driverBadge.findFirst({
          where: { driverId: badgeOrDriverId },
          include: { driver: { include: { person: true } } },
          orderBy: { createdAt: 'desc' },
        });
      }

      if (!badge) throw new AppError('Badge introuvable.', 404, 'BADGE_NOT_FOUND');

      this.enforceBadgeValidationScope(actorUser, badge.driver);

      const updatedBadge = await tx.driverBadge.update({
        where: { id: badge.id },
        data: {
          status: 'SUSPENDU',
          suspendedAt: new Date(),
          suspensionReason: reason.trim(),
        },
      });

      // Add to revocation registry
      await tx.credentialRevocation.create({
        data: {
          credentialType: 'DRIVER_BADGE',
          credentialId: badge.id,
          serialNumber: badge.badgeNumber,
          revokedByUserId: actorUser.id,
          reason: reason.trim(),
          isPermanent: false,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actorUser.id,
          action: 'DRIVER_BADGE_SUSPENDED',
          targetModule: 'BADGES',
          targetRecordId: badge.driverId,
          reason: reason.trim(),
        },
      });

      return updatedBadge;
    }, { maxWait: 10000, timeout: 25000 });
  }

  /**
   * Generates printable CR80 PDF for a badge.
   */
  static async generateBadgePdf(badgeOrDriverId, actorUser) {
    let badge = await prisma.driverBadge.findUnique({
      where: { id: badgeOrDriverId },
      include: {
        driver: { include: { person: true } },
      },
    });

    if (!badge) {
      badge = await prisma.driverBadge.findFirst({
        where: { driverId: badgeOrDriverId, status: 'ACTIF' },
        include: {
          driver: { include: { person: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!badge) {
      throw new AppError(
        'Badge introuvable ou non encore validé. Veuillez valider le badge avant de télécharger le PDF.',
        404,
        'BADGE_NOT_FOUND'
      );
    }

    if (badge.status !== 'ACTIF') {
      throw new AppError(
        'Impression impossible : Ce badge n est pas actif ou a été rejeté/suspendu.',
        400,
        'BADGE_NOT_ACTIVE'
      );
    }

    // Payment Gate: Badge only becomes valid and printable after the driver's payment has been confirmed
    if (badge.isPaymentConfirmed === false || badge.driver?.isPaymentConfirmed === false) {
      throw new AppError(
        'Impression impossible : Le badge ne peut être imprimé qu après confirmation officielle du paiement du chauffeur.',
        400,
        'PAYMENT_NOT_CONFIRMED'
      );
    }

    const pdfBuffer = await PdfBadgeService.generateDriverBadgePdf({
      badgeNumber: badge.badgeNumber,
      driverName: `${badge.driver.person.firstName} ${badge.driver.person.lastName}`,
      licenseNumber: badge.driver.drivingLicenseNumber,
      category: badge.driver.licenseCategory,
      expiresAt: badge.expiresAt,
      qrPayload: badge.qrPayload,
    });

    // Increment print count
    await prisma.driverBadge.update({
      where: { id: badge.id },
      data: {
        printedAt: new Date(),
        printCount: { increment: 1 },
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: actorUser.id,
        action: 'DRIVER_BADGE_PRINTED',
        targetModule: 'BADGES',
        targetRecordId: badge.driverId,
      },
    });

    return {
      pdfBuffer,
      fileName: `AOTUC_Badge_${badge.badgeNumber}.pdf`,
    };
  }

  /**
   * Verifies an Ed25519 QR payload and checks live revocation status.
   * Used by roadside inspector terminals.
   */
  static async verifyBadgeQr(qrPayload) {
    // 1. Asymmetric cryptographic verification (can run completely offline!)
    const cryptoResult = CryptoSignatureService.verifyQrPayload(qrPayload);
    if (!cryptoResult.isValid) {
      return {
        isAuthentic: false,
        isExpired: false,
        isRevoked: false,
        statusText: 'NON_AUTHENTIQUE',
        message: cryptoResult.reason,
      };
    }

    const { isExpired, payload } = cryptoResult;
    const credentialId = payload.credentialId;

    // 2. Check live/cached revocation database
    const revocation = await prisma.credentialRevocation.findFirst({
      where: {
        OR: [{ serialNumber: credentialId }, { credentialId }],
      },
    });

    if (revocation) {
      return {
        isAuthentic: true,
        isExpired,
        isRevoked: true,
        statusText: 'SUSPENDU_OU_REVOQUE',
        message: `Titre révoqué/suspendu le ${revocation.revokedAt.toLocaleDateString('fr-FR')} : « ${revocation.reason} »`,
        payload,
      };
    }

    if (isExpired) {
      return {
        isAuthentic: true,
        isExpired: true,
        isRevoked: false,
        statusText: 'EXPIRE',
        message: 'La date de validité réglementaire de cette carte est dépassée.',
        payload,
      };
    }

    return {
      isAuthentic: true,
      isExpired: false,
      isRevoked: false,
      statusText: 'VALIDE_ET_ACTIF',
      message: 'Badge officiel AOTUC authentique, valide et en règle.',
      payload,
    };
  }

  /**
   * Confirms payment for a driver and their badge (accepts either driverId or badgeId).
   */
  static async confirmDriverPayment(driverOrBadgeId, actorUser, { paymentReference = null } = {}) {
    return await prisma.$transaction(async (tx) => {
      let driver = await tx.driver.findUnique({
        where: { id: driverOrBadgeId },
        include: { badges: true, person: true },
      });

      if (!driver) {
        const badge = await tx.driverBadge.findUnique({
          where: { id: driverOrBadgeId },
          include: { driver: { include: { badges: true, person: true } } },
        });
        if (badge?.driver) {
          driver = badge.driver;
        }
      }

      if (!driver) throw new AppError('Chauffeur introuvable.', 404, 'DRIVER_NOT_FOUND');

      const updatedDriver = await tx.driver.update({
        where: { id: driver.id },
        data: { isPaymentConfirmed: true },
      });

      // Update all badges for driver
      await tx.driverBadge.updateMany({
        where: { driverId: driver.id },
        data: {
          isPaymentConfirmed: true,
          ...(paymentReference ? { paymentReference } : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actorUser.id,
          action: 'DRIVER_PAYMENT_CONFIRMED',
          targetModule: 'BADGES',
          targetRecordId: driver.id,
          reason: paymentReference ? `Référence paiement : ${paymentReference}` : 'Confirmation officielle du paiement chauffeur',
          newValues: { paymentReference, confirmedBy: actorUser.id },
        },
      });

      return updatedDriver;
    }, { maxWait: 10000, timeout: 25000 });
  }

  /**
   * Returns revocation list snapshot for mobile offline synchronisation.
   */
  static async getRevocationSnapshot() {
    const revocations = await prisma.credentialRevocation.findMany({
      orderBy: { revokedAt: 'desc' },
      take: 1000,
    });

    return {
      snapshotTimestamp: new Date().toISOString(),
      count: revocations.length,
      revocations: revocations.map((r) => ({
        serialNumber: r.serialNumber,
        type: r.credentialType,
        revokedAt: r.revokedAt,
        reason: r.reason,
      })),
    };
  }
}

export default BadgeService;
