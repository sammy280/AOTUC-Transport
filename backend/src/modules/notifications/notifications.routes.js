import { Router } from 'express';
import { NotificationsController } from './notifications.controller.js';
import { authenticateToken } from '../../middlewares/authMiddleware.js';

const router = Router();

// All notification routes require authentication
router.use(authenticateToken);

router.get('/', NotificationsController.getNotifications);
router.post('/simulate', NotificationsController.simulateNotification);
router.post('/:id/read', NotificationsController.markAsRead);

export default router;
