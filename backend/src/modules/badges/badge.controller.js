import BadgeService from './badge.service.js';
import CryptoSignatureService from '../../services/cryptoSignatureService.js';
import { AppError } from '../../middlewares/errorHandler.js';

export class BadgeController {
  static async issueBadge(req, res, next) {
    try {
      const { driverId } = req.body;
      if (!driverId) throw new AppError('L identifiant du chauffeur est obligatoire.', 400, 'DRIVER_ID_REQUIRED');

      const badge = await BadgeService.issueDriverBadge(driverId, req.user);

      return res.status(201).json({
        success: true,
        message: 'Badge professionnel CR80 émis et signé avec succès.',
        data: badge,
      });
    } catch (err) {
      next(err);
    }
  }

  static async downloadPdf(req, res, next) {
    try {
      const { id } = req.params;
      const { pdfBuffer, fileName } = await BadgeService.generateBadgePdf(id, req.user);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', pdfBuffer.length);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      return res.send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  }

  static async suspendBadge(req, res, next) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const badge = await BadgeService.suspendBadge(id, reason, req.user);

      return res.status(200).json({
        success: true,
        message: 'Badge suspendu avec succès.',
        data: badge,
      });
    } catch (err) {
      next(err);
    }
  }

  static async verifyQr(req, res, next) {
    try {
      const { qrPayload } = req.body;
      if (!qrPayload) throw new AppError('Le contenu du QR code est obligatoire.', 400, 'QR_PAYLOAD_REQUIRED');

      const result = await BadgeService.verifyBadgeQr(qrPayload);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getPublicKeys(req, res) {
    const keys = CryptoSignatureService.getPublicKeys();
    return res.status(200).json({
      success: true,
      data: keys,
    });
  }

  static async getRevocations(req, res, next) {
    try {
      const snapshot = await BadgeService.getRevocationSnapshot();
      return res.status(200).json({
        success: true,
        data: snapshot,
      });
    } catch (err) {
      next(err);
    }
  }
}

export default BadgeController;
