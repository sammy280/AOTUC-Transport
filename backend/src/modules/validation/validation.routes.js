import { Router } from 'express';
import ValidationController from './validation.controller.js';
import { authenticateToken, requirePermissions } from '../../middlewares/authMiddleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = Router();

// All validation operations require authentication
router.use(authenticateToken);

// 1. Create a validation request dossier (Level 1 field agents & Chefs)
router.post(
  '/requests',
  requirePermissions(PERMISSIONS.APPLICATIONS_SUBMIT),
  ValidationController.createRequest
);

// 2. Execute a state transition (Submit, Forward to L3, Return, Final Approve, Reject)
// Super Admin is strictly excluded from transport business approvals
router.post(
  '/requests/:id/transition',
  requirePermissions(
    PERMISSIONS.APPLICATIONS_SUBMIT,
    PERMISSIONS.APPLICATIONS_APPROVE_L2,
    PERMISSIONS.APPLICATIONS_APPROVE_L3,
    PERMISSIONS.APPLICATIONS_RETURN,
    PERMISSIONS.APPLICATIONS_REJECT
  ),
  ValidationController.executeTransition
);

// 3. Get single dossier with complete historical validation steps
router.get(
  '/requests/:id',
  requirePermissions(
    PERMISSIONS.APPLICATIONS_REVIEW_L2,
    PERMISSIONS.APPLICATIONS_APPROVE_L3,
    PERMISSIONS.APPLICATIONS_SUBMIT,
    PERMISSIONS.DRIVERS_READ
  ),
  ValidationController.getRequestById
);

// 4. List dossiers with scope filtering
router.get(
  '/requests',
  requirePermissions(
    PERMISSIONS.APPLICATIONS_REVIEW_L2,
    PERMISSIONS.APPLICATIONS_APPROVE_L3,
    PERMISSIONS.APPLICATIONS_SUBMIT,
    PERMISSIONS.DRIVERS_READ
  ),
  ValidationController.listRequests
);

export default router;
