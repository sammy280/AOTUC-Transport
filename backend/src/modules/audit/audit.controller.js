import AuditService from './audit.service.js';

export class AuditController {
  static async listLogs(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const targetModule = req.query.targetModule || null;
      const action = req.query.action || null;

      const result = await AuditService.listLogs({ page, limit, targetModule, action });
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  static async verifyIntegrity(req, res, next) {
    try {
      const result = await AuditService.verifyIntegrity();
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

export default AuditController;
