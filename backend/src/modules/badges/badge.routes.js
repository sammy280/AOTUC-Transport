import { Router } from 'express';
import BadgeController from './badge.controller.js';
import { authenticateToken, requirePermissions } from '../../middlewares/authMiddleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = Router();

// Public Key & Verification Endpoints (Accessible for mobile app synchronization)
router.get('/public-keys', BadgeController.getPublicKeys);
router.get('/revocations', BadgeController.getRevocations);
router.post('/verify', BadgeController.verifyQr);

// Protected Management Endpoints
router.use(authenticateToken);

// List all enrolled drivers with their badge eligibility, status, and validation history
router.get(
  '/',
  requirePermissions(
    PERMISSIONS.CREDENTIALS_READ,
    PERMISSIONS.CREDENTIALS_ISSUE,
    PERMISSIONS.CREDENTIALS_VERIFY,
    PERMISSIONS.DRIVERS_READ
  ),
  BadgeController.listDriverBadges
);

router.get(
  '/drivers',
  requirePermissions(
    PERMISSIONS.CREDENTIALS_READ,
    PERMISSIONS.CREDENTIALS_ISSUE,
    PERMISSIONS.CREDENTIALS_VERIFY,
    PERMISSIONS.DRIVERS_READ
  ),
  BadgeController.listDriverBadges
);

router.get(
  '/statistics',
  requirePermissions(
    PERMISSIONS.CREDENTIALS_READ,
    PERMISSIONS.CREDENTIALS_ISSUE,
    PERMISSIONS.CREDENTIALS_VERIFY,
    PERMISSIONS.DRIVERS_READ
  ),
  BadgeController.getBadgeStatistics
);

router.get(
  '/drivers/:id',
  requirePermissions(
    PERMISSIONS.CREDENTIALS_READ,
    PERMISSIONS.CREDENTIALS_ISSUE,
    PERMISSIONS.CREDENTIALS_VERIFY,
    PERMISSIONS.DRIVERS_READ
  ),
  BadgeController.getDriverBadgeDetails
);

// Issue / Validate new badge (Director General & Chef des Agents within commune)
router.post(
  '/issue',
  requirePermissions(PERMISSIONS.CREDENTIALS_ISSUE, PERMISSIONS.APPLICATIONS_APPROVE_L2),
  BadgeController.issueBadge
);

router.post(
  '/drivers/:id/validate',
  requirePermissions(PERMISSIONS.CREDENTIALS_ISSUE, PERMISSIONS.APPLICATIONS_APPROVE_L2),
  BadgeController.validateDriverBadge
);

// Reject / Revoke a driver's badge with mandatory explanation
router.post(
  '/drivers/:id/reject',
  requirePermissions(PERMISSIONS.CREDENTIALS_ISSUE, PERMISSIONS.APPLICATIONS_APPROVE_L2),
  BadgeController.rejectDriverBadge
);

// Confirm driver payment (Required before badge can be printed / issued)
router.post(
  '/drivers/:id/confirm-payment',
  requirePermissions(
    PERMISSIONS.CREDENTIALS_ISSUE,
    PERMISSIONS.TRANSACTIONS_CREATE,
    PERMISSIONS.USERS_UPDATE,
    PERMISSIONS.APPLICATIONS_APPROVE_L2
  ),
  BadgeController.confirmPayment
);

router.post(
  '/:id/confirm-payment',
  requirePermissions(
    PERMISSIONS.CREDENTIALS_ISSUE,
    PERMISSIONS.TRANSACTIONS_CREATE,
    PERMISSIONS.USERS_UPDATE,
    PERMISSIONS.APPLICATIONS_APPROVE_L2
  ),
  BadgeController.confirmPayment
);

// Suspend badge with mandatory reason
router.post(
  '/:id/suspend',
  requirePermissions(PERMISSIONS.CREDENTIALS_ISSUE, PERMISSIONS.APPLICATIONS_APPROVE_L2),
  BadgeController.suspendBadge
);

// Download printable CR80 PDF
router.get(
  '/:id/pdf',
  requirePermissions(PERMISSIONS.CREDENTIALS_READ, PERMISSIONS.CREDENTIALS_ISSUE, PERMISSIONS.DRIVERS_READ),
  BadgeController.downloadPdf
);

export default router;
