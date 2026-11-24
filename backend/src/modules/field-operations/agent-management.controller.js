import AgentManagementService from './agent-management.service.js';
import {
  createAgentSchema,
  updateAgentSchema,
  updateAgentStatusSchema,
  queryAgentsSchema,
} from './field-operations.schemas.js';

export class AgentManagementController {
  static async listAgents(req, res, next) {
    try {
      const validatedQuery = queryAgentsSchema.parse(req.query);
      const result = await AgentManagementService.listAgents(req.user, validatedQuery);
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  static async getAgentById(req, res, next) {
    try {
      const agent = await AgentManagementService.getAgentById(req.user, req.params.id);
      return res.status(200).json({ success: true, data: agent });
    } catch (err) {
      next(err);
    }
  }

  static async createAgent(req, res, next) {
    try {
      const validatedBody = createAgentSchema.parse(req.body);
      const result = await AgentManagementService.createAgent(req.user, validatedBody);
      return res.status(201).json({
        success: true,
        message: 'Agent de terrain créé avec succès.',
        data: result.agent,
        agent: result.agent,
        temporaryPassword: result.temporaryPassword,
        ...result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateAgent(req, res, next) {
    try {
      const validatedBody = updateAgentSchema.parse(req.body);
      const agent = await AgentManagementService.updateAgent(req.user, req.params.id, validatedBody);
      return res.status(200).json({
        success: true,
        message: 'Profil agent mis à jour avec succès.',
        data: agent,
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateAgentStatus(req, res, next) {
    try {
      const validatedBody = updateAgentStatusSchema.parse(req.body);
      const agent = await AgentManagementService.updateAgentStatus(req.user, req.params.id, validatedBody);
      return res.status(200).json({
        success: true,
        message: `Statut de l agent mis à jour : ${agent.accountStatus}.`,
        data: agent,
      });
    } catch (err) {
      next(err);
    }
  }
}

export default AgentManagementController;
