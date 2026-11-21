import AuthService from './auth.service.js';
import { loginSchema, refreshTokenSchema } from './auth.schemas.js';
import { RevocationRegistry } from '../../middlewares/authMiddleware.js';
import prisma from '../../utils/prisma.js';

export class AuthController {
  static async login(req, res, next) {
    try {
      const validatedData = loginSchema.parse(req.body);
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const headerDeviceId = req.headers['x-device-id'];

      const result = await AuthService.login({
        identifier: validatedData.identifier,
        password: validatedData.password,
        deviceId: validatedData.deviceId || headerDeviceId || null,
        deviceName: validatedData.deviceName || null,
        ipAddress,
        userAgent,
      });

      return res.status(200).json({
        success: true,
        message: 'Connexion réussie.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async refresh(req, res, next) {
    try {
      const validatedData = refreshTokenSchema.parse(req.body);
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const headerDeviceId = req.headers['x-device-id'];

      const result = await AuthService.refreshTokens({
        rawRefreshToken: validatedData.refreshToken,
        deviceId: validatedData.deviceId || headerDeviceId || null,
        ipAddress,
        userAgent,
      });

      return res.status(200).json({
        success: true,
        message: 'Jeton actualisé avec succès.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async logout(req, res, next) {
    try {
      const { refreshToken } = req.body;
      const userId = req.user ? req.user.id : null;
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      await AuthService.logout({
        rawRefreshToken: refreshToken,
        userId,
        ipAddress,
        userAgent,
      });

      return res.status(200).json({
        success: true,
        message: 'Déconnexion effectuée avec succès.',
      });
    } catch (err) {
      next(err);
    }
  }

  static async me(req, res, next) {
    try {
      const profile = await AuthService.getProfile(req.user);
      return res.status(200).json({
        success: true,
        message: 'Profil utilisateur actif.',
        data: {
          user: profile,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async listDevices(req, res) {
    const devices = RevocationRegistry.listDevices();
    return res.status(200).json({
      success: true,
      data: { devices },
    });
  }

  static async revokeDevice(req, res, next) {
    try {
      const { deviceId } = req.params;
      const { reason } = req.body || {};

      RevocationRegistry.revokeDevice(deviceId, reason || 'Appareil signalé perdu ou volé');

      try {
        await prisma.auditLog.create({
          data: {
            actorId: req.user?.id || null,
            action: 'MOBILE_DEVICE_REVOKED',
            targetModule: 'AUTH',
            targetRecordId: deviceId,
            reason: reason || 'Appareil signalé perdu ou volé',
          },
        });
      } catch (_) {
        // non-blocking if DB offline in mocked test
      }

      return res.status(200).json({
        success: true,
        message: `Accès de l'appareil "${deviceId}" révoqué avec succès.`,
        data: {
          deviceId,
          isRevoked: true,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async restoreDevice(req, res, next) {
    try {
      const { deviceId } = req.params;
      RevocationRegistry.restoreDevice(deviceId);

      try {
        await prisma.auditLog.create({
          data: {
            actorId: req.user?.id || null,
            action: 'MOBILE_DEVICE_RESTORED',
            targetModule: 'AUTH',
            targetRecordId: deviceId,
          },
        });
      } catch (_) {
        // non-blocking
      }

      return res.status(200).json({
        success: true,
        message: `Accès de l'appareil "${deviceId}" rétabli avec succès.`,
        data: {
          deviceId,
          isRevoked: false,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

export default AuthController;
