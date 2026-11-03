import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import config from '../../config/index.js';
import prisma from '../../utils/prisma.js';
import logger from '../../utils/logger.js';
import { AppError } from '../../middlewares/errorHandler.js';

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export class AuthService {
  /**
   * Authenticate user by identifier (phone or email) and password.
   */
  static async login({ identifier, password, ipAddress, userAgent }) {
    // 1. Find user by phone number or email
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { phoneNumber: identifier },
          { email: identifier },
        ],
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        commune: true,
      },
    });

    if (!user) {
      logger.warn('Failed login attempt: user not found', { identifier, ipAddress });
      throw new AppError('Identifiants de connexion invalides.', 401, 'INVALID_CREDENTIALS');
    }

    if (!user.isActive) {
      logger.warn('Failed login attempt: account inactive', { userId: user.id });
      throw new AppError('Ce compte utilisateur a été désactivé par un administrateur.', 403, 'ACCOUNT_INACTIVE');
    }

    // 2. Verify password with Argon2
    const isPasswordValid = await argon2.verify(user.passwordHash, password);
    if (!isPasswordValid) {
      logger.warn('Failed login attempt: incorrect password', { userId: user.id, ipAddress });
      throw new AppError('Identifiants de connexion invalides.', 401, 'INVALID_CREDENTIALS');
    }

    // 3. Extract roles and scope
    const roleNames = user.roles.map((ur) => ur.role.name);

    // 4. Generate token pair
    const tokenFamily = crypto.randomUUID();
    const { accessToken, refreshToken, expiresAt } = this.generateTokenPair(user, roleNames, tokenFamily);

    // 5. Store hashed refresh token in database
    await prisma.refreshToken.create({
      data: {
        tokenHash: hashToken(refreshToken),
        userId: user.id,
        family: tokenFamily,
        expiresAt,
      },
    });

    // 6. Record Audit Log
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'USER_LOGIN_SUCCESS',
        targetModule: 'AUTH',
        targetRecordId: user.id,
        ipAddress,
        userAgent,
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: roleNames,
        commune: user.commune ? { id: user.commune.id, code: user.commune.code, name: user.commune.name } : null,
      },
      accessToken,
      refreshToken,
    };
  }

  /**
   * Rotate refresh token with reuse detection (Token Family protection).
   */
  static async refreshTokens({ rawRefreshToken, ipAddress, userAgent }) {
    // 1. Verify JWT signature of the refresh token
    let decoded;
    try {
      decoded = jwt.verify(rawRefreshToken, config.JWT_REFRESH_SECRET);
    } catch (err) {
      throw new AppError('Jeton de rafraîchissement invalide ou expiré.', 401, 'INVALID_REFRESH_TOKEN');
    }

    const tokenHashed = hashToken(rawRefreshToken);

    // 2. Lookup token in database
    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { tokenHash: tokenHashed },
      include: {
        user: {
          include: {
            roles: { include: { role: true } },
            commune: true,
          },
        },
      },
    });

    // 3. Reuse detection: If token does not exist or is marked revoked, revoke all tokens in the same family!
    if (!tokenRecord || tokenRecord.isRevoked) {
      if (tokenRecord) {
        logger.error('CRITICAL: Refresh token reuse detected! Invalidating token family.', {
          family: tokenRecord.family,
          userId: tokenRecord.userId,
          ipAddress,
        });

        // Revoke entire family to stop compromised tokens
        await prisma.refreshToken.updateMany({
          where: { family: tokenRecord.family },
          data: { isRevoked: true },
        });

        await prisma.auditLog.create({
          data: {
            actorId: tokenRecord.userId,
            action: 'TOKEN_REUSE_BREACH_SUSPECTED',
            targetModule: 'AUTH',
            ipAddress,
            userAgent,
            reason: `Detected reuse of revoked token family: ${tokenRecord.family}`,
          },
        });
      }

      throw new AppError('Jeton de session compromis ou invalide. Veuillez vous reconnecter.', 401, 'TOKEN_COMPROMISED');
    }

    // 4. Verify token expiry
    if (new Date() > tokenRecord.expiresAt) {
      await prisma.refreshToken.update({
        where: { id: tokenRecord.id },
        data: { isRevoked: true },
      });
      throw new AppError('Session expirée. Veuillez vous reconnecter.', 401, 'SESSION_EXPIRED');
    }

    const user = tokenRecord.user;
    if (!user.isActive) {
      throw new AppError('Compte utilisateur désactivé.', 403, 'ACCOUNT_INACTIVE');
    }

    const roleNames = user.roles.map((ur) => ur.role.name);

    // 5. Generate new token pair preserving the existing family
    const { accessToken, refreshToken: newRefreshToken, expiresAt } = this.generateTokenPair(
      user,
      roleNames,
      tokenRecord.family
    );

    // 6. Invalidate old token and store new one atomically
    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { id: tokenRecord.id },
        data: {
          isRevoked: true,
          replacedByToken: hashToken(newRefreshToken),
        },
      }),
      prisma.refreshToken.create({
        data: {
          tokenHash: hashToken(newRefreshToken),
          userId: user.id,
          family: tokenRecord.family,
          expiresAt,
        },
      }),
    ]);

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Revoke session on logout.
   */
  static async logout({ rawRefreshToken, userId, ipAddress, userAgent }) {
    if (rawRefreshToken) {
      const tokenHashed = hashToken(rawRefreshToken);
      await prisma.refreshToken.updateMany({
        where: { tokenHash: tokenHashed },
        data: { isRevoked: true },
      });
    }

    if (userId) {
      await prisma.auditLog.create({
        data: {
          actorId: userId,
          action: 'USER_LOGOUT',
          targetModule: 'AUTH',
          targetRecordId: userId,
          ipAddress,
          userAgent,
        },
      });
    }

    return { success: true };
  }

  /**
   * Helper: Generate access and refresh token pair.
   */
  static generateTokenPair(user, roles, family) {
    const accessPayload = {
      sub: user.id,
      email: user.email,
      phoneNumber: user.phoneNumber,
      roles,
      communeId: user.communeId,
    };

    const accessToken = jwt.sign(accessPayload, config.JWT_ACCESS_SECRET, {
      expiresIn: config.JWT_ACCESS_EXPIRATION,
    });

    const refreshPayload = {
      sub: user.id,
      family,
    };

    const refreshToken = jwt.sign(refreshPayload, config.JWT_REFRESH_SECRET, {
      expiresIn: config.JWT_REFRESH_EXPIRATION,
    });

    // 7 days expiration default
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    return { accessToken, refreshToken, expiresAt };
  }
}

export default AuthService;
