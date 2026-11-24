import InspectionsService from './inspections.service.js';
import {
  createInspectionSchema,
  queryInspectionsSchema,
} from './field-operations.schemas.js';

export class InspectionsController {
  static async listInspections(req, res, next) {
    try {
      const validatedQuery = queryInspectionsSchema.parse(req.query);
      const result = await InspectionsService.listInspections(req.user, validatedQuery);
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  static async getInspectionById(req, res, next) {
    try {
      const inspection = await InspectionsService.getInspectionById(req.user, req.params.id);
      return res.status(200).json({ success: true, data: inspection });
    } catch (err) {
      next(err);
    }
  }

  static async createInspection(req, res, next) {
    try {
      const validatedBody = createInspectionSchema.parse(req.body);
      const inspection = await InspectionsService.createInspection(req.user, validatedBody);
      return res.status(201).json({
        success: true,
        message: 'Contrôle de terrain enregistré avec succès.',
        data: inspection,
      });
    } catch (err) {
      next(err);
    }
  }
}

export default InspectionsController;
