import { Router } from 'express';
import LicenceController from './licence.controller.js';
import { authenticateToken, requireRoles } from '../../middlewares/authMiddleware.js';

const router = Router();

router.use(authenticateToken);

// Issue transport licence sticker (Director or Admin only)
router.post(
  '/issue',
  requireRoles('DIRECTOR', 'SUPER_ADMIN'),
  LicenceController.issueLicence
);

// Download printable sticker PDF
router.get(
  '/:id/sticker-pdf',
  requireRoles('DIRECTOR', 'CHEF_SERVICE', 'SUPER_ADMIN'),
  LicenceController.downloadStickerPdf
);

export default router;
