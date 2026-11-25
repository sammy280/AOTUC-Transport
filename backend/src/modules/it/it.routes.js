import { Router } from 'express';
import ITController from './it.controller.js';
import { authenticateToken, requireRoles } from '../../middlewares/authMiddleware.js';

const router = Router();

// All IT endpoints strictly require authentication and the IT role
router.use(authenticateToken);
router.use(requireRoles('IT'));

// 1. Overview & Database Physical Status
router.get('/overview', ITController.getOverview);

// 2. Public Tables & Metadata
router.get('/tables', ITController.getTables);
router.get('/tables/:tableName/schema', ITController.getTableSchema);
router.get('/tables/:tableName/records', ITController.getTableRecords);

// 3. Guarded SQL Console
router.post('/query', ITController.executeSQL);

// 4. Backup & Targeted Recovery
router.get('/backups', ITController.listBackups);
router.post('/backups/create', ITController.createBackup);
router.post('/backups/restore-targeted', ITController.restoreTargeted);

// 5. Migrations & Schema Versioning
router.get('/migrations', ITController.getMigrations);

// 6. Diagnostics & System Health
router.get('/diagnostics', ITController.getDiagnostics);

// 7. Safe User Deletion with Attribution Preservation
router.delete('/users/:id', ITController.deleteUser);

// 8. Safe Operational Record Deletion with Audit Trail
router.delete('/records/:entityType/:id', ITController.deleteRecord);

export default router;
