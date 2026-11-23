import crypto from 'crypto';
import prisma from '../../utils/prisma.js';
import logger from '../../utils/logger.js';
import { AppError } from '../../middlewares/errorHandler.js';
import CryptoSignatureService from '../../services/cryptoSignatureService.js';
import PdfBadgeService from '../../services/pdfBadgeService.js';

export class LicenceService {
  /**
   * Issues a signed Windshield Transport Licence Sticker for an approved vehicle.
   */
  static async issueVehicleLicence({ vehicleId, transportLineCode = null }, actorUser) {
    // 1. Verify vehicle eligibility
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        owner: { include: { person: true } },
        inspections: {
          orderBy: { expirationDate: 'desc' },
          take: 1,
        },
        licences: {
          where: { status: 'ACTIF' },
        },
      },
    });

    if (!vehicle) {
      throw new AppError('Véhicule introuvable.', 404, 'VEHICLE_NOT_FOUND');
    }

    if (vehicle.status !== 'ACTIF') {
      throw new AppError(
        'Délivrance de licence impossible : le véhicule doit avoir été validé par la Direction Générale (statut ACTIF).',
        400,
        'VEHICLE_NOT_ELIGIBLE'
      );
    }

    // Payment Gate: Vehicle sticker requires registration and confirmation of payment by the Super Admin
    if (vehicle.isPaymentConfirmed === false || vehicle.superAdminConfirmed === false) {
      throw new AppError(
        'Délivrance impossible : La vignette pare-brise exige l enregistrement du véhicule et la confirmation préalable du paiement par le Super Administrateur.',
        400,
        'SUPER_ADMIN_PAYMENT_CONFIRMATION_REQUIRED'
      );
    }

    // Check inspection validity
    const latestInspection = vehicle.inspections[0];
    if (!latestInspection || new Date() > latestInspection.expirationDate || !latestInspection.isConform) {
      throw new AppError(
        'Délivrance impossible : le véhicule ne dispose pas d un certificat de contrôle technique valide et conforme.',
        400,
        'INSPECTION_INVALID'
      );
    }

    // 2. Compute 1-year validity period
    const issuedAt = new Date();
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    // 3. Unique Licence number: LIC-YYYY-HEX
    const licenceNumber = `LIC-${issuedAt.getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // 4. Cryptographic Ed25519 signature
    const { keyId, signature, qrPayload } = CryptoSignatureService.signCredential({
      credentialId: licenceNumber,
      type: 'TRANSPORT_LICENCE',
      targetId: vehicle.id,
      issuedAt,
      expiresAt,
    });

    return await prisma.$transaction(async (tx) => {
      let replacesLicenceId = null;

      // Invalidate previous active licence
      if (vehicle.licences && vehicle.licences.length > 0) {
        const previousLicence = vehicle.licences[0];
        replacesLicenceId = previousLicence.id;

        await tx.transportLicence.update({
          where: { id: previousLicence.id },
          data: { status: 'REMPLACE' },
        });

        await tx.credentialRevocation.create({
          data: {
            credentialType: 'TRANSPORT_LICENCE',
            credentialId: previousLicence.id,
            serialNumber: previousLicence.licenceNumber,
            revokedByUserId: actorUser.id,
            reason: `Remplacée par la nouvelle licence ${licenceNumber}`,
          },
        });
      }

      // Create new licence
      const newLicence = await tx.transportLicence.create({
        data: {
          vehicleId: vehicle.id,
          transportLineCode,
          licenceNumber,
          qrPayload,
          signature,
          keyId,
          issuedAt,
          expiresAt,
          status: 'ACTIF',
          replacesLicenceId,
        },
        include: {
          vehicle: { include: { owner: { include: { person: true } } } },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actorUser.id,
          action: 'TRANSPORT_LICENCE_ISSUED',
          targetModule: 'LICENCES',
          targetRecordId: newLicence.id,
          newValues: { licenceNumber, vehicleId: vehicle.id, plateNumber: vehicle.plateNumber },
        },
      });

      return newLicence;
    });
  }

  /**
   * Generates printable Windshield Sticker PDF (100mm x 100mm).
   */
  static async generateStickerPdf(licenceId, actorUser) {
    const licence = await prisma.transportLicence.findUnique({
      where: { id: licenceId },
      include: { vehicle: true },
    });

    if (!licence) throw new AppError('Licence introuvable.', 404, 'LICENCE_NOT_FOUND');

    // Payment Gate: Vehicle sticker only becomes printable after vehicle registration and confirmation of payment by Super Admin
    if (licence.isPaymentConfirmed === false || licence.vehicle?.isPaymentConfirmed === false || licence.vehicle?.superAdminConfirmed === false) {
      throw new AppError(
        'Impression de la vignette pare-brise impossible : Le paiement doit être préalablement confirmé par le Super Administrateur.',
        400,
        'SUPER_ADMIN_PAYMENT_CONFIRMATION_REQUIRED'
      );
    }

    const pdfBuffer = await PdfBadgeService.generateLicenceStickerPdf({
      licenceNumber: licence.licenceNumber,
      plateNumber: licence.vehicle.plateNumber,
      lineCode: licence.transportLineCode,
      vehicleType: licence.vehicle.vehicleType,
      expiresAt: licence.expiresAt,
      qrPayload: licence.qrPayload,
    });

    await prisma.transportLicence.update({
      where: { id: licence.id },
      data: {
        printedAt: new Date(),
        printCount: { increment: 1 },
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: actorUser.id,
        action: 'TRANSPORT_LICENCE_PRINTED',
        targetModule: 'LICENCES',
        targetRecordId: licence.id,
      },
    });

    return {
      pdfBuffer,
      fileName: `AOTUC_Sticker_${licence.licenceNumber}.pdf`,
    };
  }

  /**
   * Confirms vehicle registration payment by Super Admin.
   */
  static async confirmSuperAdminPayment(vehicleId, actorUser, { paymentReference = null } = {}) {
    const isSuperAdmin = actorUser?.roles?.includes('SUPER_ADMIN');
    if (!isSuperAdmin) {
      throw new AppError(
        'Action réservée : Seul le Super Administrateur est habilité à confirmer le paiement de la vignette véhicule.',
        403,
        'FORBIDDEN_SUPER_ADMIN_ONLY'
      );
    }

    return await prisma.$transaction(async (tx) => {
      const vehicle = await tx.vehicle.findUnique({
        where: { id: vehicleId },
        include: { licences: true },
      });
      if (!vehicle) throw new AppError('Véhicule introuvable.', 404, 'VEHICLE_NOT_FOUND');

      const updatedVehicle = await tx.vehicle.update({
        where: { id: vehicleId },
        data: {
          isPaymentConfirmed: true,
          superAdminConfirmed: true,
        },
      });

      await tx.transportLicence.updateMany({
        where: { vehicleId },
        data: {
          isPaymentConfirmed: true,
          superAdminConfirmedAt: new Date(),
          superAdminUserId: actorUser.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actorUser.id,
          action: 'VEHICLE_PAYMENT_CONFIRMED_SUPER_ADMIN',
          targetModule: 'LICENCES',
          targetRecordId: vehicleId,
          newValues: { paymentReference, superAdminId: actorUser.id },
        },
      });

      return updatedVehicle;
    });
  }
}

export default LicenceService;
