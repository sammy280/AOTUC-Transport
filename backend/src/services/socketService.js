import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import logger from '../utils/logger.js';

let ioInstance = null;

export class SocketService {
  /**
   * Initializes the Socket.IO server with JWT authentication.
   */
  static init(httpServer) {
    if (ioInstance) return ioInstance;

    ioInstance = new Server(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    // JWT Authentication Middleware for WebSockets
    ioInstance.use((socket, next) => {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentification WebSocket requise. Jeton absent.'));
      }

      try {
        const decoded = jwt.verify(token, config.JWT_ACCESS_SECRET);
        socket.user = {
          id: decoded.sub,
          roles: decoded.roles || [],
          communeId: decoded.communeId || null,
        };
        next();
      } catch (err) {
        return next(new Error('Jeton WebSocket invalide.'));
      }
    });

    ioInstance.on('connection', (socket) => {
      const user = socket.user;
      logger.info('WebSocket client connected', { userId: user.id, roles: user.roles });

      // Join rooms by role
      user.roles.forEach((role) => {
        socket.join(`role:${role}`);
      });

      // Join room by commune
      if (user.communeId) {
        socket.join(`commune:${user.communeId}`);
      }

      // Handle internal chat messaging
      socket.on('chat:send_message', (data) => {
        const chatPayload = {
          senderId: user.id,
          message: data.message,
          timestamp: new Date().toISOString(),
          targetRoom: data.targetRoom || 'all',
        };

        if (data.targetRoom) {
          ioInstance.to(data.targetRoom).emit('chat:new_message', chatPayload);
        } else {
          ioInstance.emit('chat:new_message', chatPayload);
        }
      });

      socket.on('disconnect', () => {
        logger.info('WebSocket client disconnected', { userId: user.id });
      });
    });

    return ioInstance;
  }

  /**
   * Emits an event to a specific room or to all connected clients.
   */
  static emitNotification(room, event, data) {
    if (!ioInstance) return;
    if (room) {
      ioInstance.to(room).emit(event, data);
    } else {
      ioInstance.emit(event, data);
    }
  }

  static getIO() {
    return ioInstance;
  }
}

export default SocketService;