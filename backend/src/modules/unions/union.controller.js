import UnionService from './union.service.js';
import {
  createUnionSchema,
  updateUnionSchema,
  updateUnionStatusSchema,
  queryUnionsSchema,
} from './union.schemas.js';

export class UnionController {
  static async listUnions(req, res, next) {
    try {
      const validatedQuery = queryUnionsSchema.parse(req.query);
      const result = await UnionService.listUnions(req.user, validatedQuery);
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  static async getUnionById(req, res, next) {
    try {
      const union = await UnionService.getUnionById(req.user, req.params.id);
      return res.status(200).json({ success: true, data: union });
    } catch (err) {
      next(err);
    }
  }

  static async createUnion(req, res, next) {
    try {
      const validatedBody = createUnionSchema.parse(req.body);
      const union = await UnionService.createUnion(req.user, validatedBody);
      return res.status(201).json({
        success: true,
        message: 'Syndicat ou organisation professionnelle enregistré(e) avec succès.',
        data: union,
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateUnion(req, res, next) {
    try {
      const validatedBody = updateUnionSchema.parse(req.body);
      const union = await UnionService.updateUnion(req.user, req.params.id, validatedBody);
      return res.status(200).json({
        success: true,
        message: 'Informations du syndicat mises à jour avec succès.',
        data: union,
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateUnionStatus(req, res, next) {
    try {
      const validatedBody = updateUnionStatusSchema.parse(req.body);
      const union = await UnionService.updateUnionStatus(req.user, req.params.id, validatedBody);
      return res.status(200).json({
        success: true,
        message: `Statut du syndicat actualisé : ${union.status}.`,
        data: union,
      });
    } catch (err) {
      next(err);
    }
  }
}

export default UnionController;
