import { Router } from 'express';
import multer from 'multer';
import DocumentController from './document.controller.js';
import { authenticateToken, requirePermissions } from '../../middlewares/authMiddleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
});

// All document operations require authentication
router.use(authenticateToken);

// Upload endpoint (Authorized to Field Agents and Chefs de Service with DOCUMENTS_UPLOAD)
router.post(
  '/upload',
  requirePermissions(PERMISSIONS.DOCUMENTS_UPLOAD),
  upload.single('file'),
  DocumentController.upload
);

// Secure streaming endpoint (Authorized reviewers and agents)
router.get(
  '/:id/stream',
  requirePermissions(
    PERMISSIONS.DOCUMENTS_VERIFY,
    PERMISSIONS.DOCUMENTS_UPLOAD,
    PERMISSIONS.DRIVERS_READ
  ),
  DocumentController.stream
);

export default router;
