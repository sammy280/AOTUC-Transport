import { Router } from 'express';
import FieldOperationsController from './field-operations.controller.js';
import { requireAuth, requirePermissions, requireRoles } from '../../middlewares/authMiddleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = Router();

// All field operations routes require authentication
router.use(requireAuth);

// 1. Field Operations Dashboard & Metrics
router.get(
  '/dashboard-summary',
  requirePermissions(PERMISSIONS.FIELD_PROGRESS_READ),
  FieldOperationsController.getDashboardSummary
);

// 2. Field Assignments CRUD & Status Management
router.get(
  '/assignments',
  requirePermissions(PERMISSIONS.FIELD_ASSIGNMENTS_READ),
  FieldOperationsController.listAssignments
);

router.post(
  '/assignments',
  requirePermissions(PERMISSIONS.FIELD_ASSIGNMENTS_MANAGE),
  FieldOperationsController.createAssignment
);

router.get(
  '/assignments/:id',
  requirePermissions(PERMISSIONS.FIELD_ASSIGNMENTS_READ),
  FieldOperationsController.getAssignmentById
);

router.put(
  '/assignments/:id',
  requirePermissions(PERMISSIONS.FIELD_ASSIGNMENTS_MANAGE),
  FieldOperationsController.updateAssignment
);

router.post(
  '/assignments/:id/reassign',
  requirePermissions(PERMISSIONS.FIELD_ASSIGNMENTS_MANAGE),
  FieldOperationsController.reassignAgent
);

router.patch(
  '/assignments/:id/status',
  requireRoles('AGENT_TERRAIN', 'CHEF_SERVICE', 'SUPER_ADMIN', 'DIRECTOR'),
  FieldOperationsController.updateStatus
);

// 3. Official Field Receipts (Proof of Work)
router.get(
  '/receipts',
  requirePermissions(PERMISSIONS.FIELD_RECEIPTS_READ),
  FieldOperationsController.listReceipts
);

router.post(
  '/receipts',
  requirePermissions(PERMISSIONS.FIELD_RECEIPTS_CREATE, PERMISSIONS.FIELD_ASSIGNMENTS_MANAGE),
  FieldOperationsController.createReceipt
);

router.get(
  '/receipts/:id',
  requirePermissions(PERMISSIONS.FIELD_RECEIPTS_READ),
  FieldOperationsController.getReceiptById
);

// 4. Field Teams Management
router.get(
  '/teams',
  requirePermissions(PERMISSIONS.FIELD_ASSIGNMENTS_READ),
  FieldOperationsController.listTeams
);

router.post(
  '/teams',
  requirePermissions(PERMISSIONS.FIELD_ASSIGNMENTS_MANAGE),
  FieldOperationsController.createTeam
);

export default router;
