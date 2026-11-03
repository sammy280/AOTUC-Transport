import ValidationService from './validation.service.js';
import {
  createValidationRequestSchema,
  transitionValidationSchema,
} from './validation.schemas.js';

export class ValidationController {
  static async createRequest(req, res, next) {
    try {
      const validatedData = createValidationRequestSchema.parse(req.body);
      const request = await ValidationService.createRequest(validatedData, req.user);

      return res.status(201).json({
        success: true,
        message: 'Dossier d examen créé avec succès.',
        data: request,
      });
    } catch (err) {
      next(err);
    }
  }

  static async executeTransition(req, res, next) {
    try {
      const { id } = req.params;
      const validatedData = transitionValidationSchema.parse(req.body);

      const updatedRequest = await ValidationService.executeTransition(
        id,
        validatedData,
        req.user
      );

      return res.status(200).json({
        success: true,
        message: `Décision de validation enregistrée avec succès (${validatedData.action}).`,
        data: updatedRequest,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getRequestById(req, res, next) {
    try {
      const { id } = req.params;
      const request = await ValidationService.getRequestById(id, req.user);

      return res.status(200).json({
        success: true,
        data: request,
      });
    } catch (err) {
      next(err);
    }
  }

  static async listRequests(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const status = req.query.status || null;
      const level = req.query.level ? parseInt(req.query.level) : null;
      const communeId = req.query.communeId || null;

      const result = await ValidationService.listRequests(
        { page, limit, status, level, communeId },
        req.user
      );

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

export default ValidationController;
