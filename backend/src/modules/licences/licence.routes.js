import { Router } from 'express';
import LicenceController from './licence.controller.js';
import { authenticateToken, requirePermissions } from '../../middlewares/authMiddleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = Router();

router.use(authenticateToken);

// Issue transport licence sticker (Director General ONLY - Super Admin forbidden)
router.post(
  '/issue',
  requirePermissions(PERMISSIONS.CREDENTIALS_ISSUE),
  LicenceController.issueLicence
);

// Download printable sticker PDF
router.get(
  '/:id/sticker-pdf',
  requirePermissions(PERMISSIONS.CREDENTIALS_READ, PERMISSIONS.CREDENTIALS_ISSUE),
  LicenceController.downloadStickerPdf
);

// Confirm vehicle payment by Super Admin
router.post(
  '/vehicles/:id/confirm-payment',
  requirePermissions(PERMISSIONS.SYSTEM_SETTINGS_MANAGE, PERMISSIONS.ROLES_MANAGE, PERMISSIONS.USERS_UPDATE),
  LicenceController.confirmPayment
);

router.post(
  '/:id/confirm-payment',
  requirePermissions(PERMISSIONS.SYSTEM_SETTINGS_MANAGE, PERMISSIONS.ROLES_MANAGE, PERMISSIONS.USERS_UPDATE),
  LicenceController.confirmPayment
);

export default router;
