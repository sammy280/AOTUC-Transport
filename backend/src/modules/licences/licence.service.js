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
}

export default LicenceService;
