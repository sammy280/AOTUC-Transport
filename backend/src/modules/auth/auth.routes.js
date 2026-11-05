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

// User Theme & Appearance Preferences Synchronization (Device Independent)
const userThemePreferences = new Map();

router.get('/preferences/theme', authenticateToken, (req, res) => {
  const theme = userThemePreferences.get(req.user.id) || 'system';
  res.status(200).json({ success: true, data: { theme } });
});

router.put('/preferences/theme', authenticateToken, (req, res) => {
  const { theme } = req.body;
  if (!['light', 'dark', 'system'].includes(theme)) {
    return res.status(400).json({
      success: false,
      message: 'Thème invalide. Valeurs autorisées: light, dark, system.',
    });
  }
  userThemePreferences.set(req.user.id, theme);
  res.status(200).json({
    success: true,
    message: 'Préférence d apparence synchronisée avec succès sur votre compte.',
    data: { theme },
  });
});

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
