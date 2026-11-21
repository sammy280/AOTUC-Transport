import UsersService from './users.service.js';
import { createUserSchema, updateUserSchema, resetPasswordSchema } from './users.schemas.js';

export class UsersController {
  static async listUsers(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const search = req.query.search || '';

      const result = await UsersService.listUsers({ page, limit, search });
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  static async getUserById(req, res, next) {
    try {
      const { id } = req.params;
      const user = await UsersService.getUserById(id);
      return res.status(200).json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  }

  static async createUser(req, res, next) {
    try {
      const validatedData = createUserSchema.parse(req.body);
      const user = await UsersService.createUser(validatedData, req.user);
      return res.status(201).json({
        success: true,
        message: 'Utilisateur créé avec succès.',
        data: user,
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateUser(req, res, next) {
    try {
      const { id } = req.params;
      const validatedData = updateUserSchema.parse(req.body);
      const user = await UsersService.updateUser(id, validatedData, req.user);
      return res.status(200).json({
        success: true,
        message: 'Utilisateur mis à jour avec succès.',
        data: user,
      });
    } catch (err) {
      next(err);
    }
  }

  static async resetPassword(req, res, next) {
    try {
      const { id } = req.params;
      const validatedData = resetPasswordSchema.parse(req.body || {});
      const result = await UsersService.resetUserPassword(id, validatedData.password, req.user);
      return res.status(200).json({
        success: true,
        message: result.message,
        data: {
          userId: result.userId,
          temporaryPassword: result.temporaryPassword,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async deactivateUser(req, res, next) {
    try {
      const { id } = req.params;
      const result = await UsersService.setUserStatus(id, false, req.user);
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  static async reactivateUser(req, res, next) {
    try {
      const { id } = req.params;
      const result = await UsersService.setUserStatus(id, true, req.user);
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  static async listCommunes(req, res, next) {
    try {
      const communes = await UsersService.listCommunes();
      return res.status(200).json({
        success: true,
        data: communes,
      });
    } catch (err) {
      next(err);
    }
  }
}

export default UsersController;
