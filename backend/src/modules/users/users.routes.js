import { Router } from 'express';
import UsersController from './users.controller.js';
import { authenticateToken, requirePermissions } from '../../middlewares/authMiddleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = Router();

// All user administration endpoints require authentication
router.use(authenticateToken);

// 1. List users (Super Admin only - DSI)
router.get(
  '/',
  requirePermissions(PERMISSIONS.USERS_READ),
  UsersController.listUsers
);

// 2. Create user
router.post(
  '/',
  requirePermissions(PERMISSIONS.USERS_CREATE),
  UsersController.createUser
);

// 3. Get user details
router.get(
  '/:id',
  requirePermissions(PERMISSIONS.USERS_READ),
  UsersController.getUserById
);

// 4. Update user
router.patch(
  '/:id',
  requirePermissions(PERMISSIONS.USERS_UPDATE),
  UsersController.updateUser
);

// 5. Deactivate user account
router.patch(
  '/:id/deactivate',
  requirePermissions(PERMISSIONS.USERS_DEACTIVATE),
  UsersController.deactivateUser
);

// 6. Reactivate user account
router.patch(
  '/:id/reactivate',
  requirePermissions(PERMISSIONS.USERS_DEACTIVATE),
  UsersController.reactivateUser
);

export default router;
