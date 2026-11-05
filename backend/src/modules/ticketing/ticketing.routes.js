import { Router } from 'express';
import TicketingController from './ticketing.controller.js';
import { requireAuth, requirePermissions } from '../../middlewares/authMiddleware.js';
import { PERMISSIONS } from '../../config/permissions.js';
import { AppError } from '../../middlewares/errorHandler.js';

const router = Router();

// Protect all routes with JWT auth
router.use(requireAuth);

// 1. Tariffs
router.get('/tariffs', TicketingController.listTariffs);
router.post(
  '/tariffs',
  requirePermissions(PERMISSIONS.SYSTEM_SETTINGS_MANAGE, PERMISSIONS.FINANCIAL_REPORTS_READ),
  TicketingController.createTariff
);

// 2. Batches (Carnets de tickets)
router.get(
  '/batches',
  requirePermissions(
    PERMISSIONS.TICKETS_SELL,
    PERMISSIONS.FINANCIAL_REPORTS_READ,
    PERMISSIONS.TRANSACTIONS_READ_ALL
  ),
  TicketingController.listBatches
);
router.post(
  '/batches',
  requirePermissions(PERMISSIONS.FINANCIAL_REPORTS_READ, PERMISSIONS.SYSTEM_SETTINGS_MANAGE),
  TicketingController.createBatch
);
router.post(
  '/batches/allocate',
  requirePermissions(PERMISSIONS.FINANCIAL_REPORTS_READ, PERMISSIONS.SYSTEM_SETTINGS_MANAGE),
  TicketingController.allocateBatch
);

// 3. Sales Operations
router.get(
  '/sales',
  requirePermissions(PERMISSIONS.TRANSACTIONS_READ_OWN, PERMISSIONS.TRANSACTIONS_READ_ALL),
  TicketingController.listSales
);

router.post(
  '/sales',
  requirePermissions(PERMISSIONS.TRANSACTIONS_CREATE, PERMISSIONS.TICKETS_SELL),
  TicketingController.recordSale
);

router.post(
  '/sales/:id/reverse',
  requirePermissions(PERMISSIONS.TRANSACTIONS_REVERSE),
  TicketingController.reverseSale
);

router.get(
  '/sales/:id/pdf',
  requirePermissions(PERMISSIONS.TRANSACTIONS_READ_OWN, PERMISSIONS.TRANSACTIONS_READ_ALL, PERMISSIONS.TICKETS_SELL),
  TicketingController.downloadTicketPdf
);

// 4. Double-Entry Financial Ledger (Strictly Append-Only)
router.get(
  '/ledger/summary',
  requirePermissions(PERMISSIONS.FINANCIAL_REPORTS_READ, PERMISSIONS.TRANSACTIONS_READ_ALL),
  TicketingController.getLedgerSummary
);

router.post(
  '/ledger/entries',
  requirePermissions(PERMISSIONS.FINANCIAL_REPORTS_READ, PERMISSIONS.SYSTEM_SETTINGS_MANAGE),
  TicketingController.postLedgerEntry
);

// Strict Ledger Immutability: Block PUT, PATCH, DELETE operations on ledger
router.all('/ledger/entries*', (req, res, next) => {
  if (['PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next(
      new AppError(
        'Action interdite : les écritures du grand livre comptable sont strictement immuables et inaltérables.',
        405,
        'LEDGER_IMMUTABLE'
      )
    );
  }
  next();
});

export default router;
