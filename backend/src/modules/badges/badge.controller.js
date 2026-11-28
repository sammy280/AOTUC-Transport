import BadgeService from './badge.service.js';
import CryptoSignatureService from '../../services/cryptoSignatureService.js';
import { AppError } from '../../middlewares/errorHandler.js';

export class BadgeController {
  static async listDriverBadges(req, res, next) {
    try {
      const { search = '', status = 'ALL', communeId = null, page = 1, limit = 100 } = req.query;
      const result = await BadgeService.listDriverBadges(req.user, {
        search,
        status,
        communeId,
        page: Number(page) || 1,
        limit: Number(limit) || 100,
      });

      return res.status(200).json({
        success: true,
        data: result.items,
        items: result.items,
        counts: result.counts,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getBadgeStatistics(req, res, next) {
    try {
      const result = await BadgeService.listDriverBadges(req.user, { limit: 500 });
      return res.status(200).json({
        success: true,
        data: result.counts,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getDriverBadgeDetails(req, res, next) {
    try {
      const { id } = req.params;
      const record = await BadgeService.getDriverBadgeDetails(id, req.user);
      return res.status(200).json({
        success: true,
        data: record,
      });
    } catch (err) {
      next(err);
    }
  }

  static async issueBadge(req, res, next) {
    try {
      const { driverId, comment } = req.body;
      if (!driverId) {
        throw new AppError('L identifiant du chauffeur est obligatoire.', 400, 'DRIVER_ID_REQUIRED');
      }

      const badge = await BadgeService.issueDriverBadge(driverId, req.user, { comment });
      const record = await BadgeService.getDriverBadgeDetails(driverId, req.user);

      return res.status(201).json({
        success: true,
        message: 'Badge professionnel CR80 validé, émis et signé avec succès.',
        data: badge,
        record,
      });
    } catch (err) {
      next(err);
    }
  }

  static async validateDriverBadge(req, res, next) {
    try {
      const { id } = req.params;
      const { comment } = req.body || {};

      const badge = await BadgeService.issueDriverBadge(id, req.user, { comment });
      const record = await BadgeService.getDriverBadgeDetails(id, req.user);

      return res.status(200).json({
        success: true,
        message: 'Badge professionnel CR80 validé, émis et signé avec succès.',
        data: record,
        badge,
      });
    } catch (err) {
      next(err);
    }
  }

  static async rejectDriverBadge(req, res, next) {
    try {
      const { id } = req.params;
      const { reason, comment } = req.body || {};

      const record = await BadgeService.rejectDriverBadge(id, reason || comment, req.user);

      return res.status(200).json({
        success: true,
        message: 'Badge chauffeur rejeté avec enregistrement du motif officiel.',
        data: record,
      });
    } catch (err) {
      next(err);
    }
  }

  static async uploadDriverPortrait(req, res, next) {
    try {
      const { id } = req.params;
      const { base64Data, mimeType, originalName } = req.body || {};

      const record = await BadgeService.uploadDriverPortrait(
        id,
        { base64Data, mimeType, originalName },
        req.user
      );

      return res.status(200).json({
        success: true,
        message: 'Photo portrait du chauffeur enregistrée et rattachée au badge CR80 avec succès.',
        data: record,
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

  static async confirmPayment(req, res, next) {
    try {
      const { id } = req.params; // driverId or badgeId
      const { paymentReference } = req.body || {};

      const result = await BadgeService.confirmDriverPayment(id, req.user, { paymentReference });
      const record = await BadgeService.getDriverBadgeDetails(result.id, req.user);

      return res.status(200).json({
        success: true,
        message:
          'Paiement du chauffeur confirmé avec succès. Le badge est désormais éligible à la délivrance et l impression.',
        data: result,
        record,
      });
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
      if (!qrPayload) {
        throw new AppError('Le contenu du QR code est obligatoire.', 400, 'QR_PAYLOAD_REQUIRED');
      }

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
