import { Router } from 'express';
import UsersController from './users.controller.js';
import { authenticateToken, requirePermissions } from '../../middlewares/authMiddleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = Router();

// All user administration endpoints require authentication
router.use(authenticateToken);

// 1. Reference: List official communes for territorial scope assignment
router.get('/communes', UsersController.listCommunes);

// 2. List users (Super Admin / DSI)
router.get(
  '/',
  requirePermissions(PERMISSIONS.USERS_READ),
  UsersController.listUsers
);

// 3. Create user
router.post(
  '/',
  requirePermissions(PERMISSIONS.USERS_CREATE),
  UsersController.createUser
);

// 4. Get user details
router.get(
  '/:id',
  requirePermissions(PERMISSIONS.USERS_READ),
  UsersController.getUserById
);

// 5. Update user details
router.patch(
  '/:id',
  requirePermissions(PERMISSIONS.USERS_UPDATE),
  UsersController.updateUser
);

// 6. Reset user password (generates or sets custom secure password)
router.patch(
  '/:id/password',
  requirePermissions(PERMISSIONS.USERS_UPDATE),
  UsersController.resetPassword
);

router.post(
  '/:id/reset-password',
  requirePermissions(PERMISSIONS.USERS_UPDATE),
  UsersController.resetPassword
);

// 7. Deactivate user account
router.patch(
  '/:id/deactivate',
  requirePermissions(PERMISSIONS.USERS_DEACTIVATE),
  UsersController.deactivateUser
);

// 8. Reactivate user account
router.patch(
  '/:id/reactivate',
  requirePermissions(PERMISSIONS.USERS_DEACTIVATE),
  UsersController.reactivateUser
);

export default router;
