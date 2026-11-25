import { Router } from 'express';
import UsersController from './users.controller.js';
import { authenticateToken, requirePermissions } from '../../middlewares/authMiddleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = Router();

// All user administration endpoints require authentication
router.use(authenticateToken);

// 1. Reference: List official communes for territorial scope assignment
router.get('/communes', UsersController.listCommunes);

// 2. List users (Super Admin / DSI, Director)
router.get(
  '/',
  (req, res, next) => {
    if (req.user?.roles?.includes('SUPER_ADMIN') || req.user?.roles?.includes('DIRECTOR') || req.user?.roles?.includes('IT') || req.user?.permissions?.includes(PERMISSIONS.USERS_READ)) {
      return next();
    }
    return requirePermissions(PERMISSIONS.USERS_READ)(req, res, next);
  },
  UsersController.listUsers
);

// 3. Create user (Super Admin and Director can both register Authority accounts)
router.post(
  '/',
  (req, res, next) => {
    if (req.user?.roles?.includes('SUPER_ADMIN') || req.user?.roles?.includes('DIRECTOR') || req.user?.roles?.includes('IT') || req.user?.permissions?.includes(PERMISSIONS.USERS_CREATE)) {
      return next();
    }
    return requirePermissions(PERMISSIONS.USERS_CREATE)(req, res, next);
  },
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
