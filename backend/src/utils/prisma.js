import { PrismaClient } from '@prisma/client';
import logger from './logger.js';

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.__db__) {
    global.__db__ = new PrismaClient({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
      ],
    });

    global.__db__.$on('error', (e) => {
      logger.error('Prisma Error', { message: e.message, target: e.target });
    });
  }
  prisma = global.__db__;
}

export { prisma };
export default prisma;
