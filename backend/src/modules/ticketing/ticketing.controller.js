import TicketingService from './ticketing.service.js';
import {
  createTariffSchema,
  createBatchSchema,
  allocateBatchSchema,
  recordSaleSchema,
  ledgerEntrySchema,
} from './ticketing.schemas.js';

export class TicketingController {
  static async createTariff(req, res, next) {
    try {
      const validated = createTariffSchema.parse(req.body);
      const tariff = await TicketingService.createTariff(validated, req.user);
      return res.status(201).json({ success: true, data: tariff });
    } catch (err) {
      next(err);
    }
  }

  static async listTariffs(req, res, next) {
    try {
      const tariffs = await TicketingService.listTariffs();
      return res.status(200).json({ success: true, count: tariffs.length, data: tariffs });
    } catch (err) {
      next(err);
    }
  }

  static async createBatch(req, res, next) {
    try {
      const validated = createBatchSchema.parse(req.body);
      const batch = await TicketingService.createBatch(validated, req.user);
      return res.status(201).json({ success: true, data: batch });
    } catch (err) {
      next(err);
    }
  }

  static async listBatches(req, res, next) {
    try {
      const batches = await TicketingService.listBatches();
      return res.status(200).json({ success: true, count: batches.length, data: batches });
    } catch (err) {
      next(err);
    }
  }

  static async allocateBatch(req, res, next) {
    try {
      const validated = allocateBatchSchema.parse(req.body);
      const allocated = await TicketingService.allocateBatch(validated, req.user);
      return res.status(200).json({ success: true, data: allocated });
    } catch (err) {
      next(err);
    }
  }

  static async recordSale(req, res, next) {
    try {
      const validated = recordSaleSchema.parse(req.body);
      const sale = await TicketingService.recordSale(validated, req.user);
      return res.status(201).json({ success: true, data: sale });
    } catch (err) {
      next(err);
    }
  }

  static async postLedgerEntry(req, res, next) {
    try {
      const validated = ledgerEntrySchema.parse(req.body);
      const entry = await TicketingService.postLedgerEntry(validated, req.user);
      return res.status(201).json({ success: true, data: entry });
    } catch (err) {
      next(err);
    }
  }

  static async getLedgerSummary(req, res, next) {
    try {
      const summary = await TicketingService.getLedgerSummary();
      return res.status(200).json({ success: true, data: summary });
    } catch (err) {
      next(err);
    }
  }

  static async listSales(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const sellerUserId = req.query.sellerUserId || null;

      const result = await TicketingService.listSales(
        { page, limit, sellerUserId },
        req.user
      );

      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  static async reverseSale(req, res, next) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const result = await TicketingService.reverseSale(id, { reason }, req.user);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

export default TicketingController;