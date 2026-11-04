import { Router } from 'express';
import BadgeController from './badge.controller.js';
import { authenticateToken, requireRoles } from '../../middlewares/authMiddleware.js';

const router = Router();

// Public Key & Verification Endpoints (Accessible for mobile app synchronization)
router.get('/public-keys', BadgeController.getPublicKeys);
router.get('/revocations', BadgeController.getRevocations);
router.post('/verify', BadgeController.verifyQr);

// Protected Management Endpoints
router.use(authenticateToken);

// Issue new badge (Director or Admin only)
router.post(
  '/issue',
  requireRoles('DIRECTOR', 'SUPER_ADMIN'),
  BadgeController.issueBadge
);

// Suspend badge
router.post(
  '/:id/suspend',
  requireRoles('DIRECTOR', 'SUPER_ADMIN'),
  BadgeController.suspendBadge
);

// Download printable CR80 PDF
router.get(
  '/:id/pdf',
  requireRoles('DIRECTOR', 'CHEF_SERVICE', 'SUPER_ADMIN'),
  BadgeController.downloadPdf
);

export default router;
