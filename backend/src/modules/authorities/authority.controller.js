import AuthorityService from './authority.service.js';
import {
  createAuthoritySchema,
  updateAuthoritySchema,
  queryAuthoritiesSchema,
} from './authority.schemas.js';

export class AuthorityController {
  static async createAuthority(req, res, next) {
    try {
      const validatedData = createAuthoritySchema.parse(req.body);
      const authority = await AuthorityService.createAuthority(req.user, validatedData);
      return res.status(201).json({
        success: true,
        message: 'Autorité administrative enregistrée avec succès.',
        data: authority,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getAuthorityById(req, res, next) {
    try {
      const authority = await AuthorityService.getAuthorityById(req.params.id);
      return res.status(200).json({
        success: true,
        data: authority,
      });
    } catch (err) {
      next(err);
    }
  }

  static async listAuthorities(req, res, next) {
    try {
      const query = queryAuthoritiesSchema.parse(req.query);
      const result = await AuthorityService.listAuthorities(query);
      return res.status(200).json({
        success: true,
        data: result.authorities,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateAuthority(req, res, next) {
    try {
      const validatedData = updateAuthoritySchema.parse(req.body);
      const updated = await AuthorityService.updateAuthority(
        req.params.id,
        req.user,
        validatedData
      );
      return res.status(200).json({
        success: true,
        message: 'Autorité administrative mise à jour avec succès.',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteAuthority(req, res, next) {
    try {
      const result = await AuthorityService.deleteAuthority(req.params.id, req.user);
      return res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getKpis(req, res, next) {
    try {
      const kpis = await AuthorityService.getAuthoritiesKpis();
      return res.status(200).json({
        success: true,
        data: kpis,
      });
    } catch (err) {
      next(err);
    }
  }
}

export default AuthorityController;
