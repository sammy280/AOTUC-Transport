import FieldOperationsService from './field-operations.service.js';
import {
  createAssignmentSchema,
  updateAssignmentSchema,
  reassignAgentSchema,
  updateStatusSchema,
  cancelMissionSchema,
  createReceiptSchema,
  createTeamSchema,
  queryAssignmentsSchema,
} from './field-operations.schemas.js';

export class FieldOperationsController {
  static async listAssignments(req, res, next) {
    try {
      const validatedQuery = queryAssignmentsSchema.parse(req.query);
      const result = await FieldOperationsService.listAssignments(req.user, validatedQuery);
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  static async getAssignmentById(req, res, next) {
    try {
      const assignment = await FieldOperationsService.getAssignmentById(req.user, req.params.id);
      return res.status(200).json({ success: true, data: assignment });
    } catch (err) {
      next(err);
    }
  }

  static async createAssignment(req, res, next) {
    try {
      const validatedBody = createAssignmentSchema.parse(req.body);
      const assignment = await FieldOperationsService.createAssignment(req.user, validatedBody);
      return res.status(201).json({
        success: true,
        message: 'Mission de terrain créée avec succès.',
        data: assignment,
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateAssignment(req, res, next) {
    try {
      const validatedBody = updateAssignmentSchema.parse(req.body);
      const assignment = await FieldOperationsService.updateAssignment(req.user, req.params.id, validatedBody);
      return res.status(200).json({
        success: true,
        message: 'Mission de terrain mise à jour avec succès.',
        data: assignment,
      });
    } catch (err) {
      next(err);
    }
  }

  static async reassignAgent(req, res, next) {
    try {
      const validatedBody = reassignAgentSchema.parse(req.body);
      const assignment = await FieldOperationsService.reassignAgent(req.user, req.params.id, validatedBody);
      return res.status(200).json({
        success: true,
        message: 'Agent de terrain réassigné avec succès.',
        data: assignment,
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateStatus(req, res, next) {
    try {
      const validatedBody = updateStatusSchema.parse(req.body);
      const assignment = await FieldOperationsService.updateStatus(req.user, req.params.id, validatedBody);
      return res.status(200).json({
        success: true,
        message: `Statut de mission mis à jour : ${assignment.status}.`,
        data: assignment,
      });
    } catch (err) {
      next(err);
    }
  }

  static async cancelAssignment(req, res, next) {
    try {
      const validatedBody = cancelMissionSchema.parse(req.body);
      const assignment = await FieldOperationsService.cancelAssignment(req.user, req.params.id, validatedBody);
      return res.status(200).json({
        success: true,
        message: 'Mission de terrain annulée avec succès.',
        data: assignment,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getDashboardSummary(req, res, next) {
    try {
      const summary = await FieldOperationsService.getDashboardSummary(req.user, req.query);
      return res.status(200).json({ success: true, data: summary });
    } catch (err) {
      next(err);
    }
  }

  static async createReceipt(req, res, next) {
    try {
      const validatedBody = createReceiptSchema.parse(req.body);
      const receipt = await FieldOperationsService.createReceipt(req.user, validatedBody);
      const statusCode = receipt.isExisting ? 200 : 201;
      return res.status(statusCode).json({
        success: true,
        message: receipt.isExisting
          ? 'Récépissé existant récupéré.'
          : 'Récépissé officiel de terrain généré avec succès.',
        data: receipt,
      });
    } catch (err) {
      next(err);
    }
  }

  static async listReceipts(req, res, next) {
    try {
      const result = await FieldOperationsService.listReceipts(req.user, req.query);
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  static async getReceiptById(req, res, next) {
    try {
      const receipt = await FieldOperationsService.getReceiptById(req.user, req.params.id);
      return res.status(200).json({ success: true, data: receipt });
    } catch (err) {
      next(err);
    }
  }

  static async listTeams(req, res, next) {
    try {
      const teams = await FieldOperationsService.listTeams(req.user);
      return res.status(200).json({ success: true, data: teams });
    } catch (err) {
      next(err);
    }
  }

  static async createTeam(req, res, next) {
    try {
      const validatedBody = createTeamSchema.parse(req.body);
      const team = await FieldOperationsService.createTeam(req.user, validatedBody);
      return res.status(201).json({
        success: true,
        message: 'Équipe de terrain créée avec succès.',
        data: team,
      });
    } catch (err) {
      next(err);
    }
  }
}

export default FieldOperationsController;
