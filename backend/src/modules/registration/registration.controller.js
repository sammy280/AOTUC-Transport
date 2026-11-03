import RegistrationService from './registration.service.js';
import {
  registerDriverSchema,
  registerOwnerSchema,
  registerVehicleSchema,
} from './registration.schemas.js';

export class RegistrationController {
  static async registerDriver(req, res, next) {
    try {
      const validatedData = registerDriverSchema.parse(req.body);
      const driver = await RegistrationService.registerDriver(validatedData, req.user);

      return res.status(201).json({
        success: true,
        message: 'Chauffeur enregistré avec succès. Dossier soumis pour examen.',
        data: driver,
      });
    } catch (err) {
      next(err);
    }
  }

  static async registerOwner(req, res, next) {
    try {
      const validatedData = registerOwnerSchema.parse(req.body);
      const owner = await RegistrationService.registerOwner(validatedData, req.user);

      return res.status(201).json({
        success: true,
        message: 'Propriétaire enregistré avec succès.',
        data: owner,
      });
    } catch (err) {
      next(err);
    }
  }

  static async registerVehicle(req, res, next) {
    try {
      const validatedData = registerVehicleSchema.parse(req.body);
      const vehicle = await RegistrationService.registerVehicle(validatedData, req.user);

      return res.status(201).json({
        success: true,
        message: 'Véhicule enregistré avec succès. Dossier soumis pour examen.',
        data: vehicle,
      });
    } catch (err) {
      next(err);
    }
  }

  static async listDrivers(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const search = req.query.search || '';
      const communeId = req.query.communeId || null;

      const result = await RegistrationService.listDrivers(
        { page, limit, search, communeId },
        req.user
      );

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async listVehicles(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const search = req.query.search || '';
      const communeId = req.query.communeId || null;

      const result = await RegistrationService.listVehicles(
        { page, limit, search, communeId },
        req.user
      );

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

export default RegistrationController;
