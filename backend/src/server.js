import app from './app.js';
import config from './config/index.js';
import logger from './utils/logger.js';
import prisma from './utils/prisma.js';
import SocketService from './services/socketService.js';

const server = app.listen(config.PORT, config.HOST, () => {
  logger.info(`🚀 AOTUC-TRANSPORT API Server started on http://${config.HOST}:${config.PORT}`);
  logger.info(`Environment: ${config.NODE_ENV} | Health endpoint: http://${config.HOST}:${config.PORT}/api/v1/health`);
});

// Initialize real-time WebSocket Hub
SocketService.init(server);

// Graceful Shutdown Handling
const shutdown = async (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  server.close(async () => {
    logger.info('HTTP server closed.');
    try {
      await prisma.$disconnect();
      logger.info('Database client disconnected.');
      process.exit(0);
    } catch (err) {
      logger.error('Error during database disconnect', { error: err.message });
      process.exit(1);
    }
  });

  // Force close after 10s if graceful fails
  setTimeout(() => {
    logger.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
