import ITService from './it.service.js';

export class ITController {
  static async getOverview(req, res, next) {
    try {
      const data = await ITService.getOverview();
      return res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  static async getTables(req, res, next) {
    try {
      const data = await ITService.getTablesList();
      return res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  static async getTableSchema(req, res, next) {
    try {
      const { tableName } = req.params;
      const data = await ITService.getTableSchema(tableName);
      return res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  static async getTableRecords(req, res, next) {
    try {
      const { tableName } = req.params;
      const { page, limit, search, sortBy, sortOrder } = req.query;
      const data = await ITService.getTableRecords(tableName, {
        page,
        limit,
        search,
        sortBy,
        sortOrder,
      });
      return res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  static async executeSQL(req, res, next) {
    try {
      const { query, reason, requireConfirmation } = req.body;
      const actorId = req.user?.id;
      const ipAddress = req.ip || req.connection?.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const data = await ITService.executeSQLQuery({
        query,
        reason,
        requireConfirmation,
        actorId,
        ipAddress,
        userAgent,
      });

      return res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  static async listBackups(req, res, next) {
    try {
      const data = await ITService.listBackups();
      return res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  static async createBackup(req, res, next) {
    try {
      const { reason } = req.body;
      const actorId = req.user?.id;
      const ipAddress = req.ip || req.connection?.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const data = await ITService.createBackup({
        reason,
        actorId,
        ipAddress,
        userAgent,
      });

      return res.status(201).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  static async restoreTargeted(req, res, next) {
    try {
      const { backupFileName, entityType, reason } = req.body;
      const actorId = req.user?.id;
      const ipAddress = req.ip || req.connection?.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const data = await ITService.restoreTargeted({
        backupFileName,
        entityType,
        reason,
        actorId,
        ipAddress,
        userAgent,
      });

      return res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  static async getMigrations(req, res, next) {
    try {
      const data = await ITService.getMigrationHistory();
      return res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  static async getDiagnostics(req, res, next) {
    try {
      const data = await ITService.getDiagnostics();
      return res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  static async deleteUser(req, res, next) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const actorId = req.user?.id;
      const ipAddress = req.ip || req.connection?.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const data = await ITService.deleteUserSafely({
        userId: id,
        reason,
        actorId,
        ipAddress,
        userAgent,
      });

      return res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  static async deleteRecord(req, res, next) {
    try {
      const { entityType, id } = req.params;
      const { reason } = req.body;
      const actorId = req.user?.id;
      const ipAddress = req.ip || req.connection?.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const data = await ITService.deleteOperationalRecord({
        entityType,
        recordId: id,
        reason,
        actorId,
        ipAddress,
        userAgent,
      });

      return res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }
}

export default ITController;
