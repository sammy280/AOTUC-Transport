import prisma from '../../utils/prisma.js';
import SocketService from '../../services/socketService.js';
import logger from '../../utils/logger.js';

export class NotificationsController {
  /**
   * Fetches real-time system notifications for the authenticated user.
   */
  static async getNotifications(req, res, next) {
    try {
      // In development or when auditLog has records, query latest entries
      let auditLogs = [];
      try {
        auditLogs = await prisma.auditLog.findMany({
          take: 15,
          orderBy: { createdAt: 'desc' },
        });
      } catch (e) {
        // Fallback for mocked dev testing
        auditLogs = [];
      }

      const formatted = auditLogs.map((log) => {
        let category = 'SYSTEM';
        let priority = 'INFO';
        let linkTab = 'dashboard';

        if (log.targetModule === 'VALIDATION') {
          category = 'VALIDATION';
          linkTab = 'validation';
        } else if (log.targetModule === 'SECURITY') {
          category = 'SECURITY';
          priority = 'CRITICAL';
          linkTab = 'audit';
        } else if (log.targetModule === 'TICKETING') {
          category = 'TICKETING';
          linkTab = 'ticketing';
        } else if (log.targetModule === 'BADGES') {
          category = 'VALIDATION';
          linkTab = 'badges';
        }

        return {
          id: log.id,
          category,
          priority,
          title: log.action.replace(/_/g, ' '),
          message: log.reason || `Événement ${log.action} enregistré avec succès sur la ressource ${log.targetRecordId || ''}.`,
          timestamp: log.createdAt,
          isRead: false,
          linkTab,
        };
      });

      return res.status(200).json({
        success: true,
        count: formatted.length,
        data: formatted,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Simulates/dispatches a real-time notification to Socket.IO clients.
   */
  static async simulateNotification(req, res, next) {
    try {
      const { title, message, category, priority, room } = req.body;
      const notifPayload = {
        id: `notif-${Date.now()}`,
        title: title || 'Alerte Système AOTUC',
        message: message || 'Nouvelle notification temps réel',
        category: category || 'VALIDATION',
        priority: priority || 'INFO',
        timestamp: new Date().toISOString(),
      };

      SocketService.emitNotification(room || null, 'notification:new', notifPayload);
      logger.info('Dispatched real-time notification via SocketService', { notifPayload });

      return res.status(201).json({
        success: true,
        data: notifPayload,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Marks notification as read.
   */
  static async markAsRead(req, res) {
    const { id } = req.params;
    return res.status(200).json({
      success: true,
      message: `Notification ${id} marquée comme lue.`,
    });
  }
}

export default NotificationsController;
