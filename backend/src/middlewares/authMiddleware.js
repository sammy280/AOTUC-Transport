import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { AppError } from './errorHandler.js';
import logger from '../utils/logger.js';

/**
 * Verifies JWT Access Token and injects user context into req.user
 */
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return next(new AppError('Authentification requise. Jeton d accès manquant.', 401, 'UNAUTHORIZED'));
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return next(new AppError('Format du jeton invalide. Utilisez "Bearer <token>".', 401, 'INVALID_TOKEN_FORMAT'));
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, config.JWT_ACCESS_SECRET);
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      phoneNumber: decoded.phoneNumber,
      roles: decoded.roles || [],
      communeId: decoded.communeId || null,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Votre session a expiré. Veuillez rafraîchir votre jeton.', 401, 'TOKEN_EXPIRED'));
    }
    return next(new AppError('Jeton d accès invalide ou altéré.', 401, 'INVALID_ACCESS_TOKEN'));
  }
}

// Convenient alias for authenticateToken
export const requireAuth = authenticateToken;

/**
 * Enforces Role-Based Access Control (RBAC)
 * @param  {...string} allowedRoles Roles authorized to access the route
 */
export function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.roles) {
      return next(new AppError('Accès non autorisé. Identité non vérifiée.', 401, 'UNAUTHORIZED'));
    }

    const flatRoles = allowedRoles.flat();
    const hasRole = req.user.roles.some((role) => flatRoles.includes(role));

    if (!hasRole) {
      logger.warn('Access denied by RBAC policy', {
        userId: req.user.id,
        userRoles: req.user.roles,
        requiredRoles: allowedRoles,
        path: req.originalUrl,
      });

      return next(
        new AppError(
          'Accès refusé. Vous ne disposez pas des permissions requises pour cette action.',
          403,
          'FORBIDDEN_ROLE'
        )
      );
    }

    next();
  };
}

/**
 * Enforces Organizational Territorial Scope (Commune)
 * - SUPER_ADMIN and DIRECTOR have global access across all communes.
 * - CHEF_SERVICE and AGENT_TERRAIN are strictly restricted to their assigned communeId.
 * @param {string} sourceLocation 'params', 'query', or 'body'
 * @param {string} fieldName Name of the field containing communeId
 */
export function requireCommuneScope(sourceLocation = 'params', fieldName = 'communeId') {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentification requise.', 401, 'UNAUTHORIZED'));
    }

    // Global roles can access any commune
    if (req.user.roles.includes('SUPER_ADMIN') || req.user.roles.includes('DIRECTOR')) {
      return next();
    }

    // Extract target communeId from request
    const targetCommuneId = req[sourceLocation]?.[fieldName];

    if (!targetCommuneId) {
      return next(
        new AppError(
          `Paramètre de commune manquant (${fieldName}).`,
          400,
          'MISSING_COMMUNE_PARAM'
        )
      );
    }

    // Verify user's assigned commune matches target
    if (req.user.communeId !== targetCommuneId) {
      logger.warn('Access denied by Territorial Scope policy', {
        userId: req.user.id,
        userCommune: req.user.communeId,
        targetCommune: targetCommuneId,
        path: req.originalUrl,
      });

      return next(
        new AppError(
          'Accès refusé. Vous n êtes pas autorisé à consulter ou modifier les données d une autre commune.',
          403,
          'FORBIDDEN_COMMUNE_SCOPE'
        )
      );
    }

    next();
  };
}
