/**
 * Structured Logger for AOTUC-TRANSPORT
 * Standardized logging with UTC ISO timestamps and log levels.
 * Prevents accidental logging of passwords, tokens, or PII.
 */

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const currentLevel = process.env.LOG_LEVEL || 'debug';

function shouldLog(level) {
  return levels[level] <= levels[currentLevel];
}

function formatMessage(level, message, meta = {}) {
  // Sanitize meta to prevent sensitive data leakage
  const safeMeta = { ...meta };
  const sensitiveKeys = ['password', 'token', 'refreshToken', 'secret', 'authorization', 'pin', 'nin'];
  
  for (const key of Object.keys(safeMeta)) {
    if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
      safeMeta[key] = '[REDACTED]';
    }
  }

  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    message,
    ...(Object.keys(safeMeta).length > 0 ? { meta: safeMeta } : {}),
  });
}

export const logger = {
  error: (msg, meta) => {
    if (shouldLog('error')) console.error(formatMessage('error', msg, meta));
  },
  warn: (msg, meta) => {
    if (shouldLog('warn')) console.warn(formatMessage('warn', msg, meta));
  },
  info: (msg, meta) => {
    if (shouldLog('info')) console.log(formatMessage('info', msg, meta));
  },
  http: (msg, meta) => {
    if (shouldLog('http')) console.log(formatMessage('http', msg, meta));
  },
  debug: (msg, meta) => {
    if (shouldLog('debug')) console.debug(formatMessage('debug', msg, meta));
  },
};

export default logger;
