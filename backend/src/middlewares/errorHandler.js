import logger from '../utils/logger.js';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_SERVER_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(err, req, res, next) {
  // Check if it's a Zod validation error
  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    return res.status(400).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Les données fournies sont invalides ou incomplètes.',
      errors: formattedErrors,
    });
  }

  // Check if it's an operational application error
  if (err.isOperational) {
    logger.warn(`Operational Error: ${err.message}`, {
      code: err.code,
      statusCode: err.statusCode,
      path: req.originalUrl,
      method: req.method,
    });

    return res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  // Unhandled / Unexpected server error
  logger.error(`Unhandled Error: ${err.message}`, {
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
  });

  return res.status(500).json({
    success: false,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Une erreur interne est survenue sur le serveur. Veuillez réessayer plus tard.',
  });
}
