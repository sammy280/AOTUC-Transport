import crypto from 'crypto';
import prisma from '../../utils/prisma.js';
import logger from '../../utils/logger.js';
import { AppError } from '../../middlewares/errorHandler.js';
import CryptoSignatureService from '../../services/cryptoSignatureService.js';
import PdfBadgeService from '../../services/pdfBadgeService.js';

export class BadgeService {
  /**
   * Issues a signed CR80 professional badge for an approved driver.
   */
  static async issueDriverBadge(driverId, actorUser) {
    // 1. Verify driver exists and is Level 3 approved (ACTIF)
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      include: {
        person: true,
        union: true,
        badges: {
          where: { status: 'ACTIF' },
        },
      },
    });

    if (!driver) {
      throw new AppError('Chauffeur introuvable.', 404, 'DRIVER_NOT_FOUND');
    }

    if (driver.status !== 'ACTIF') {
      throw new AppError(
        'Délivrance impossible : le chauffeur doit impérativement avoir été validé par la Direction Générale (statut ACTIF).',
        400,
        'DRIVER_NOT_ELIGIBLE'
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

    // 5. Atomic database execution: replace existing active badge if renewal/replacement
    return await prisma.$transaction(async (tx) => {
      let replacesBadgeId = null;

      if (driver.badges && driver.badges.length > 0) {
        const previousBadge = driver.badges[0];
        replacesBadgeId = previousBadge.id;

        // Invalidate previous badge
        await tx.driverBadge.update({
          where: { id: previousBadge.id },
          data: { status: 'REMPLACE' },
        });

        // Register in revocations
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

      // Create new badge
      const newBadge = await tx.driverBadge.create({
        data: {
          driverId: driver.id,
          badgeNumber,
          qrPayload,
          signature,
          keyId,
          issuedAt,
          expiresAt,
          status: 'ACTIF',
          replacesBadgeId,
        },
        include: {
          driver: {
            include: { person: true, union: true },
          },
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          actorId: actorUser.id,
          action: 'DRIVER_BADGE_ISSUED',
          targetModule: 'BADGES',
          targetRecordId: newBadge.id,
          newValues: { badgeNumber, driverId: driver.id, keyId, expiresAt },
        },
      });

      logger.info('Driver badge issued and signed', {
        badgeNumber,
        driverId: driver.id,
        keyId,
        actorId: actorUser.id,
      });

      return newBadge;
    });
  }

  /**
   * Suspends a badge with mandatory justification (Director/Admin only).
   */
  static async suspendBadge(badgeId, reason, actorUser) {
    if (!reason || reason.trim().length < 5) {
      throw new AppError('Un motif de suspension officiel est obligatoire (au moins 5 caractères).', 400, 'REASON_REQUIRED');
    }

    return await prisma.$transaction(async (tx) => {
      const badge = await tx.driverBadge.findUnique({ where: { id: badgeId } });
      if (!badge) throw new AppError('Badge introuvable.', 404, 'BADGE_NOT_FOUND');

      const updatedBadge = await tx.driverBadge.update({
        where: { id: badgeId },
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
          targetRecordId: badge.id,
          reason: reason.trim(),
        },
      });

      return updatedBadge;
    });
  }

  /**
   * Generates printable CR80 PDF for a badge.
   */
  static async generateBadgePdf(badgeId, actorUser) {
    const badge = await prisma.driverBadge.findUnique({
      where: { id: badgeId },
      include: {
        driver: { include: { person: true } },
      },
    });

    if (!badge) throw new AppError('Badge introuvable.', 404, 'BADGE_NOT_FOUND');

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
        targetRecordId: badge.id,
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

    const { credentialId, isExpired, payload } = cryptoResult;

    // 2. Check live/cached revocation database
    const revocation = await prisma.credentialRevocation.findFirst({
      where: { serialNumber: credentialId },
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
