import { Router } from 'express';
import AuditController from './audit.controller.js';
import { authenticateToken, requirePermissions } from '../../middlewares/authMiddleware.js';
import { PERMISSIONS } from '../../config/permissions.js';
import { AppError } from '../../middlewares/errorHandler.js';

const router = Router();

router.use(authenticateToken);

// 1. View audit logs (Authorized to Super Admin and Director General)
router.get(
  '/logs',
  requirePermissions(PERMISSIONS.AUDIT_READ),
  AuditController.listLogs
);

// 2. Cryptographic audit verification (Super Admin only - DSI)
router.get(
  '/verify-integrity',
  requirePermissions(PERMISSIONS.AUDIT_VERIFY),
  AuditController.verifyIntegrity
);

// 3. Strict Audit Immutability: Block all modifications and deletions!
router.all('/logs*', (req, res, next) => {
  if (['DELETE', 'PUT', 'PATCH'].includes(req.method)) {
    return next(
      new AppError(
        'Action interdite : les journaux d audit de sécurité sont strictement inaltérables et ne peuvent être ni modifiés ni supprimés.',
        405,
        'AUDIT_LOG_IMMUTABLE'
      )
    );
  }
  next();
});

export default router;
