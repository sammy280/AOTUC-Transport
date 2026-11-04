import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { AppError } from './errorHandler.js';
import logger from '../utils/logger.js';
import prisma from '../utils/prisma.js';
import { getPermissionsForRoles, PERMISSIONS } from '../config/permissions.js';

/**
 * In-memory Revocation & Deactivation Registry
 * Provides instantaneous session invalidation when a user account is deactivated,
 * without waiting for the 15-minute JWT access token to expire.
 */
class RevocationRegistry {
  static #deactivatedUserIds = new Set();
  static #revokedTokenSignatures = new Set();

  static deactivateUser(userId) {
    if (userId) this.#deactivatedUserIds.add(String(userId));
  }

  static reactivateUser(userId) {
    if (userId) this.#deactivatedUserIds.delete(String(userId));
  }

  static isDeactivated(userId) {
    if (!userId) return false;
    return this.#deactivatedUserIds.has(String(userId));
  }

  static revokeToken(signatureOrHash) {
    if (signatureOrHash) this.#revokedTokenSignatures.add(String(signatureOrHash));
  }

  static isTokenRevoked(signatureOrHash) {
    if (!signatureOrHash) return false;
    return this.#revokedTokenSignatures.has(String(signatureOrHash));
  }

  static clear() {
    this.#deactivatedUserIds.clear();
    this.#revokedTokenSignatures.clear();
  }
}

export { RevocationRegistry };

/**
 * Verifies JWT Access Token, checks revocation and deactivation state,
 * and injects authenticated user context with resolved granular permissions into req.user.
 */
export async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return next(new AppError('Authentification requise. Jeton d accès manquant.', 401, 'UNAUTHORIZED'));
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return next(new AppError('Format du jeton invalide. Utilisez "Bearer <token>".', 401, 'INVALID_TOKEN_FORMAT'));
  }

  const token = parts[1];

  let decoded;
  try {
    decoded = jwt.verify(token, config.JWT_ACCESS_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Votre session a expiré. Veuillez rafraîchir votre jeton.', 401, 'TOKEN_EXPIRED'));
    }
    return next(new AppError('Jeton d accès invalide ou altéré.', 401, 'INVALID_ACCESS_TOKEN'));
  }

  // 1. Immediate In-Memory Revocation & Deactivation Check
  if (decoded.isActive === false || RevocationRegistry.isDeactivated(decoded.sub)) {
    logger.warn('Access attempt by deactivated account (in-memory gate)', { userId: decoded.sub });
    return next(
      new AppError(
        'Ce compte utilisateur a été désactivé par un administrateur.',
        401,
        'ACCOUNT_DEACTIVATED'
      )
    );
  }

  // 2. Database Active Status Check (if database is connected and record exists)
  try {
    if (prisma && prisma.user) {
      const dbUser = await prisma.user.findUnique({
        where: { id: decoded.sub },
        select: { id: true, isActive: true },
      });

      if (dbUser && dbUser.isActive === false) {
        RevocationRegistry.deactivateUser(dbUser.id);
        logger.warn('Access attempt by deactivated account (database gate)', { userId: dbUser.id });
        return next(
          new AppError(
            'Ce compte utilisateur a été désactivé par un administrateur.',
            401,
            'ACCOUNT_DEACTIVATED'
          )
        );
      }
    }
  } catch (dbErr) {
    // If DB is unreachable during testing or offline run, log trace and rely on JWT claims & memory registry
    logger.debug('Prisma user lookup skipped in auth middleware', { error: dbErr.message });
  }

  // 3. Resolve permissions server-side from roles
  const userRoles = decoded.roles || [];
  const permissions = getPermissionsForRoles(userRoles);

  req.user = {
    id: decoded.sub,
    email: decoded.email,
    phoneNumber: decoded.phoneNumber,
    roles: userRoles,
    communeId: decoded.communeId || null,
    permissions,
  };

  next();
}

// Convenient alias for authenticateToken
export const requireAuth = authenticateToken;

/**
 * Enforces Granular Permission-Based Access Control
 * Requires at least one of the specified permissions to succeed.
 * @param  {...string} requiredPermissions Permissions authorized to access the route
 */
export function requirePermissions(...requiredPermissions) {
  const flatPerms = requiredPermissions.flat();
  return (req, res, next) => {
    if (!req.user || !req.user.permissions) {
      return next(new AppError('Accès non autorisé. Identité non vérifiée.', 401, 'UNAUTHORIZED'));
    }

    const hasPerm = flatPerms.some((perm) => req.user.permissions.includes(perm));

    if (!hasPerm) {
      logger.warn('Access denied by Permission policy', {
        userId: req.user.id,
        userRoles: req.user.roles,
        userPermissions: req.user.permissions,
        requiredPermissions: flatPerms,
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
 * - DIRECTOR has national scope for operational dossiers.
 * - CHEF_SERVICE and AGENT_TERRAIN are strictly restricted to their assigned communeId.
 * @param {string} sourceLocation 'params', 'query', or 'body'
 * @param {string} fieldName Name of the field containing communeId
 */
export function requireCommuneScope(sourceLocation = 'params', fieldName = 'communeId') {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentification requise.', 401, 'UNAUTHORIZED'));
    }

    // Director has national scope across all communes
    if (req.user.roles.includes('DIRECTOR')) {
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

    // Super Admin has system scope, but if accessing a commune-specific endpoint, check
    if (req.user.roles.includes('SUPER_ADMIN')) {
      return next();
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

export default {
  authenticateToken,
  requireAuth,
  requireRoles,
  requirePermissions,
  requireCommuneScope,
  RevocationRegistry,
};
