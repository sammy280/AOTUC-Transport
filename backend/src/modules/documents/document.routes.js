import { Router } from 'express';
import multer from 'multer';
import DocumentController from './document.controller.js';
import { authenticateToken, requireRoles } from '../../middlewares/authMiddleware.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
});

// All document operations require authentication
router.use(authenticateToken);

// Upload endpoint (Authorized to Field Agents, Chefs de Service, and Admins)
router.post(
  '/upload',
  requireRoles('AGENT_TERRAIN', 'CHEF_SERVICE', 'SUPER_ADMIN', 'DIRECTOR'),
  upload.single('file'),
  DocumentController.upload
);

// Secure streaming endpoint
router.get(
  '/:id/stream',
  requireRoles('AGENT_TERRAIN', 'CHEF_SERVICE', 'SUPER_ADMIN', 'DIRECTOR', 'SYNDICAT'),
  DocumentController.stream
);

export default router;
