import { Router } from 'express';
import UnionController from './union.controller.js';
import { authenticateToken, requirePermissions } from '../../middlewares/authMiddleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = Router();

// All union routes require authentication
router.use(authenticateToken);

// 1. List & Lookup (Authorized roles: SUPER_ADMIN, DIRECTOR, CHEF_SERVICE, AGENT_TERRAIN, SYNDICAT)
router.get(
  '/',
  requirePermissions(PERMISSIONS.UNIONS_READ),
  UnionController.listUnions
);

router.get(
  '/:id',
  requirePermissions(PERMISSIONS.UNIONS_READ),
  UnionController.getUnionById
);

// 2. Union Registration & Administration (SUPER_ADMIN only via UNIONS_MANAGE)
router.post(
  '/',
  requirePermissions(PERMISSIONS.UNIONS_MANAGE),
  UnionController.createUnion
);

router.put(
  '/:id',
  requirePermissions(PERMISSIONS.UNIONS_MANAGE),
  UnionController.updateUnion
);

router.patch(
  '/:id',
  requirePermissions(PERMISSIONS.UNIONS_MANAGE),
  UnionController.updateUnion
);

router.patch(
  '/:id/status',
  requirePermissions(PERMISSIONS.UNIONS_MANAGE),
  UnionController.updateUnionStatus
);

export default router;
