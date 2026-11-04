import { Router } from 'express';
import SyncController from './sync.controller.js';
import { requireAuth, requireRoles } from '../../middlewares/authMiddleware.js';

const router = Router();

// Sync endpoints require authentication
router.use(requireAuth);

// PULL incremental updates for offline database
router.get(
  '/pull',
  requireRoles('AGENT_TERRAIN', 'CHEF_SERVICE', 'DIRECTOR', 'SUPER_ADMIN'),
  SyncController.pullUpdates
);

// PUSH batched offline captures from mobile devices
router.post(
  '/push',
  requireRoles('AGENT_TERRAIN', 'SUPER_ADMIN'),
  SyncController.pushBatchedDrafts
);

export default router;