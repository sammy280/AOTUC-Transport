import UsersService from './users.service.js';

export class UsersController {
  static async listUsers(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
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
      const user = await UsersService.createUser(req.body, req.user);
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
      const user = await UsersService.updateUser(id, req.body, req.user);
      return res.status(200).json({
        success: true,
        message: 'Utilisateur mis à jour avec succès.',
        data: user,
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
}

export default UsersController;
