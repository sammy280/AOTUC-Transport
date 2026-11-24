import { Router } from 'express';
import FieldOperationsController from './field-operations.controller.js';
import AgentManagementController from './agent-management.controller.js';
import InspectionsController from './inspections.controller.js';
import MissionReportsController from './mission-reports.controller.js';
import { requireAuth, requirePermissions, requireRoles } from '../../middlewares/authMiddleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = Router();

// All field operations routes require authentication
router.use(requireAuth);

// 1. AOTUC Agent Management (Stage 3)
router.get(
  '/agents',
  requirePermissions(PERMISSIONS.AGENTS_READ, PERMISSIONS.AGENTS_MANAGE),
  AgentManagementController.listAgents
);

router.post(
  '/agents',
  requirePermissions(PERMISSIONS.AGENTS_MANAGE),
  AgentManagementController.createAgent
);

router.get(
  '/agents/:id',
  requirePermissions(PERMISSIONS.AGENTS_READ, PERMISSIONS.AGENTS_MANAGE),
  AgentManagementController.getAgentById
);

router.patch(
  '/agents/:id',
  requirePermissions(PERMISSIONS.AGENTS_MANAGE),
  AgentManagementController.updateAgent
);

router.patch(
  '/agents/:id/status',
  requirePermissions(PERMISSIONS.AGENTS_MANAGE),
  AgentManagementController.updateAgentStatus
);

// 2. Field Operations Dashboard & Metrics
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

router.post(
  '/assignments/:id/cancel',
  requirePermissions(PERMISSIONS.FIELD_ASSIGNMENTS_MANAGE),
  requireRoles('CHEF_SERVICE', 'SUPER_ADMIN', 'DIRECTOR'),
  FieldOperationsController.cancelAssignment
);

// 3. Operational Field Inspections (Stage 5)
router.get(
  '/inspections',
  requirePermissions(PERMISSIONS.INSPECTIONS_READ),
  InspectionsController.listInspections
);

router.post(
  '/inspections',
  requirePermissions(PERMISSIONS.INSPECTIONS_CREATE),
  InspectionsController.createInspection
);

router.get(
  '/inspections/:id',
  requirePermissions(PERMISSIONS.INSPECTIONS_READ),
  InspectionsController.getInspectionById
);

// 4. Mission Reports & Review Workflow (Stage 6)
router.get(
  '/reports',
  requirePermissions(PERMISSIONS.MISSION_REPORTS_READ),
  MissionReportsController.listReports
);

router.get(
  '/reports/:id',
  requirePermissions(PERMISSIONS.MISSION_REPORTS_READ),
  MissionReportsController.getReportById
);

router.get(
  '/reports/:id/pdf',
  requirePermissions(PERMISSIONS.MISSION_REPORTS_READ),
  MissionReportsController.downloadReportPdf
);

router.get(
  '/assignments/:assignmentId/report',
  requirePermissions(PERMISSIONS.MISSION_REPORTS_READ),
  MissionReportsController.getReportByAssignmentId
);

router.post(
  '/reports/draft',
  requirePermissions(PERMISSIONS.MISSION_REPORTS_SUBMIT, PERMISSIONS.FIELD_ASSIGNMENTS_MANAGE),
  MissionReportsController.saveDraft
);

router.post(
  '/reports',
  requirePermissions(PERMISSIONS.MISSION_REPORTS_SUBMIT),
  MissionReportsController.submitReport
);

router.post(
  '/reports/:id/contribute',
  requirePermissions(PERMISSIONS.MISSION_REPORTS_SUBMIT, PERMISSIONS.INSPECTIONS_CREATE),
  MissionReportsController.contributeObservation
);

router.post(
  '/reports/:id/review',
  requirePermissions(PERMISSIONS.MISSION_REPORTS_REVIEW),
  requireRoles('CHEF_SERVICE', 'SUPER_ADMIN', 'DIRECTOR'),
  MissionReportsController.reviewReport
);

// 5. Official Field Receipts (Proof of Work)
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
