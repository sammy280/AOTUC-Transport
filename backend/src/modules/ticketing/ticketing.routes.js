import { Router } from 'express';
import TicketingController from './ticketing.controller.js';
import { requireAuth, requireRoles } from '../../middlewares/authMiddleware.js';

const router = Router();

// Protect all routes with JWT auth
router.use(requireAuth);

// Tariffs
router.get('/tariffs', TicketingController.listTariffs);
router.post(
  '/tariffs',
  requireRoles(['DIRECTOR', 'SUPER_ADMIN']),
  TicketingController.createTariff
);

// Batches (Carnets de tickets)
router.get(
  '/batches',
  requireRoles(['DIRECTOR', 'SUPER_ADMIN', 'CHEF_SERVICE', 'DISTRIBUTEUR']),
  TicketingController.listBatches
);
router.post(
  '/batches',
  requireRoles(['DIRECTOR', 'SUPER_ADMIN']),
  TicketingController.createBatch
);
router.post(
  '/batches/allocate',
  requireRoles(['DIRECTOR', 'SUPER_ADMIN', 'CHEF_SERVICE']),
  TicketingController.allocateBatch
);

// Sales
router.post(
  '/sales',
  requireRoles(['DISTRIBUTEUR', 'AGENT_TERRAIN', 'SUPER_ADMIN']),
  TicketingController.recordSale
);

// Double-Entry Financial Ledger
router.get(
  '/ledger/summary',
  requireRoles(['DIRECTOR', 'SUPER_ADMIN', 'CHEF_SERVICE']),
  TicketingController.getLedgerSummary
);
router.post(
  '/ledger/entries',
  requireRoles(['DIRECTOR', 'SUPER_ADMIN']),
  TicketingController.postLedgerEntry
);

export default router;