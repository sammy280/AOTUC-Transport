import TransportLinesService from './transport-lines.service.js';
import {
  createTransportLineSchema,
  createTransportStopSchema,
  assignStopsToLineSchema,
} from './transport-lines.schemas.js';

export class TransportLinesController {
  static async createLine(req, res, next) {
    try {
      const validatedData = createTransportLineSchema.parse(req.body);
      const line = await TransportLinesService.createLine(validatedData, req.user);

      return res.status(201).json({
        success: true,
        message: 'Ligne de transport créée avec succès.',
        data: line,
      });
    } catch (err) {
      next(err);
    }
  }

  static async createStop(req, res, next) {
    try {
      const validatedData = createTransportStopSchema.parse(req.body);
      const stop = await TransportLinesService.createStop(validatedData, req.user);

      return res.status(201).json({
        success: true,
        message: 'Arrêt de transport créé avec succès.',
        data: stop,
      });
    } catch (err) {
      next(err);
    }
  }

  static async assignStops(req, res, next) {
    try {
      const validatedData = assignStopsToLineSchema.parse(req.body);
      const result = await TransportLinesService.assignStopsToLine(validatedData, req.user);

      return res.status(200).json({
        success: true,
        message: 'Arrêts assignés à la ligne avec succès.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getLinesGeoJson(req, res, next) {
    try {
      const geoJson = await TransportLinesService.getLinesGeoJson();
      return res.status(200).json(geoJson);
    } catch (err) {
      next(err);
    }
  }

  static async getStopsGeoJson(req, res, next) {
    try {
      const geoJson = await TransportLinesService.getStopsGeoJson();
      return res.status(200).json(geoJson);
    } catch (err) {
      next(err);
    }
  }

  static async listLines(req, res, next) {
    try {
      const lines = await TransportLinesService.listLines();
      return res.status(200).json({
        success: true,
        data: lines,
      });
    } catch (err) {
      next(err);
    }
  }
}

export default TransportLinesController;
