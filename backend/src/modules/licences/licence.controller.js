import LicenceService from './licence.service.js';
import { AppError } from '../../middlewares/errorHandler.js';

export class LicenceController {
  static async issueLicence(req, res, next) {
    try {
      const { vehicleId, transportLineCode } = req.body;
      if (!vehicleId) throw new AppError('L identifiant du véhicule est obligatoire.', 400, 'VEHICLE_ID_REQUIRED');

      const licence = await LicenceService.issueVehicleLicence({ vehicleId, transportLineCode }, req.user);

      return res.status(201).json({
        success: true,
        message: 'Licence d exploitation urbaine émise et signée avec succès.',
        data: licence,
      });
    } catch (err) {
      next(err);
    }
  }

  static async downloadStickerPdf(req, res, next) {
    try {
      const { id } = req.params;
      const { pdfBuffer, fileName } = await LicenceService.generateStickerPdf(id, req.user);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', pdfBuffer.length);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      return res.send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  }
}

export default LicenceController;
