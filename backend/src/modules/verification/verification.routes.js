import { Router } from 'express';
import VerificationController from './verification.controller.js';

const router = Router();

// Public Verification Endpoints (No JWT required - open for public roadside inspections & smartphone checks)
router.post('/verify', VerificationController.verify);
router.get('/status/:code', VerificationController.getStatus);
router.get('/check', VerificationController.verify);

export default router;
