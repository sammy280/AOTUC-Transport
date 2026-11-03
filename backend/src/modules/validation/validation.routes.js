import { Router } from 'express';
import ValidationController from './validation.controller.js';
import { authenticateToken, requireRoles } from '../../middlewares/authMiddleware.js';

const router = Router();

// All validation operations require authentication
router.use(authenticateToken);

// 1. Create a validation request dossier (Level 1 agents & admins)
router.post(
  '/requests',
  requireRoles('AGENT_TERRAIN', 'CHEF_SERVICE', 'SUPER_ADMIN'),
  ValidationController.createRequest
);

// 2. Execute a state transition (Submit, Forward to L3, Return, Final Approve, Reject)
router.post(
  '/requests/:id/transition',
  requireRoles('AGENT_TERRAIN', 'CHEF_SERVICE', 'DIRECTOR', 'SUPER_ADMIN'),
  ValidationController.executeTransition
);

// 3. Get single dossier with complete historical validation steps
router.get(
  '/requests/:id',
  requireRoles('AGENT_TERRAIN', 'CHEF_SERVICE', 'DIRECTOR', 'SUPER_ADMIN', 'SYNDICAT'),
  ValidationController.getRequestById
);

// 4. List dossiers with scope filtering
router.get(
  '/requests',
  requireRoles('AGENT_TERRAIN', 'CHEF_SERVICE', 'DIRECTOR', 'SUPER_ADMIN', 'SYNDICAT'),
  ValidationController.listRequests
);

export default router;
