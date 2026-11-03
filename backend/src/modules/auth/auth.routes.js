import { Router } from 'express';
import AuthController from './auth.controller.js';
import { authenticateToken, requireRoles, requireCommuneScope } from '../../middlewares/authMiddleware.js';

const router = Router();

// Public Authentication Endpoints
router.post('/login', AuthController.login);
router.post('/refresh', AuthController.refresh);
router.post('/logout', AuthController.logout);

// Protected Identity & Profile
router.get('/me', authenticateToken, AuthController.me);

// Verification Route: Test Role & Scope Authorization
router.get(
  '/test-scope/:communeId',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'DIRECTOR', 'CHEF_SERVICE', 'AGENT_TERRAIN'),
  requireCommuneScope('params', 'communeId'),
  (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Accès autorisé au périmètre territorial de la commune.',
      data: {
        user: req.user,
        requestedCommuneId: req.params.communeId,
      },
    });
  }
);

export default router;
