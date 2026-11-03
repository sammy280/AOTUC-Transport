import AuthService from './auth.service.js';
import { loginSchema, refreshTokenSchema } from './auth.schemas.js';

export class AuthController {
  static async login(req, res, next) {
    try {
      const validatedData = loginSchema.parse(req.body);
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await AuthService.login({
        identifier: validatedData.identifier,
        password: validatedData.password,
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

      const result = await AuthService.refreshTokens({
        rawRefreshToken: validatedData.refreshToken,
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

  static async me(req, res) {
    return res.status(200).json({
      success: true,
      message: 'Profil utilisateur actif.',
      data: {
        user: req.user,
      },
    });
  }
}

export default AuthController;
