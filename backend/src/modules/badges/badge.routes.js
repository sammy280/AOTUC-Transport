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

// Issue new badge (Director General ONLY - Super Admin forbidden)
router.post(
  '/issue',
  requirePermissions(PERMISSIONS.CREDENTIALS_ISSUE),
  BadgeController.issueBadge
);

// Suspend badge (Director General authority)
router.post(
  '/:id/suspend',
  requirePermissions(PERMISSIONS.CREDENTIALS_ISSUE),
  BadgeController.suspendBadge
);

// Download printable CR80 PDF
router.get(
  '/:id/pdf',
  requirePermissions(PERMISSIONS.CREDENTIALS_READ, PERMISSIONS.CREDENTIALS_ISSUE),
  BadgeController.downloadPdf
);

export default router;
