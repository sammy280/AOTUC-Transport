import { Router } from 'express';
import AuthorityController from './authority.controller.js';
import { authenticateToken, requirePermissions } from '../../middlewares/authMiddleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = Router();

// All authority routes require authentication
router.use(authenticateToken);

// 1. KPIs for Director Dashboard & Overview
router.get(
  '/kpis',
  requirePermissions(PERMISSIONS.AUTHORITIES_READ),
  AuthorityController.getKpis
);

// 2. List & Search Authorities (SUPER_ADMIN, DIRECTOR)
router.get(
  '/',
  requirePermissions(PERMISSIONS.AUTHORITIES_READ),
  AuthorityController.listAuthorities
);

// 3. Authority Details by ID
router.get(
  '/:id',
  requirePermissions(PERMISSIONS.AUTHORITIES_READ),
  AuthorityController.getAuthorityById
);

// 4. Register New Authority (SUPER_ADMIN, DIRECTOR)
router.post(
  '/',
  requirePermissions(PERMISSIONS.AUTHORITIES_CREATE),
  AuthorityController.createAuthority
);

// 5. Update Authority
router.put(
  '/:id',
  requirePermissions(PERMISSIONS.AUTHORITIES_UPDATE),
  AuthorityController.updateAuthority
);

router.patch(
  '/:id',
  requirePermissions(PERMISSIONS.AUTHORITIES_UPDATE),
  AuthorityController.updateAuthority
);

// 6. Delete Authority
router.delete(
  '/:id',
  requirePermissions(PERMISSIONS.AUTHORITIES_DELETE),
  AuthorityController.deleteAuthority
);

export default router;
