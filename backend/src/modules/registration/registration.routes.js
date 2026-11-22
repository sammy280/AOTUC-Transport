import { Router } from 'express';
import RegistrationController from './registration.controller.js';
import { authenticateToken, requirePermissions } from '../../middlewares/authMiddleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = Router();

// All registration operations require authentication
router.use(authenticateToken);

// 1. Enrolment Endpoints (Field Agents & Chefs de Service with DRIVERS_CREATE)
router.post(
  '/drivers',
  requirePermissions(PERMISSIONS.DRIVERS_CREATE),
  RegistrationController.registerDriver
);

router.post(
  '/owners',
  requirePermissions(PERMISSIONS.DRIVERS_CREATE),
  RegistrationController.registerOwner
);

router.post(
  '/vehicles',
  requirePermissions(PERMISSIONS.DRIVERS_CREATE),
  RegistrationController.registerVehicle
);

// 2. Listing & Lookup Endpoints (Agents, Chefs, Director, Syndicat with DRIVERS_READ)
// Distributeurs and unpermitted accounts are strictly forbidden (403)
router.patch(
  '/drivers/:id',
  requirePermissions(PERMISSIONS.DRIVERS_UPDATE),
  RegistrationController.updateDriver
);

router.patch(
  '/owners/:id',
  requirePermissions(PERMISSIONS.DRIVERS_UPDATE),
  RegistrationController.updateOwner
);

router.get(
  '/check-duplicate',
  requirePermissions(PERMISSIONS.DRIVERS_READ, PERMISSIONS.DRIVERS_CREATE),
  RegistrationController.checkDuplicates
);

router.get(
  '/drivers',
  requirePermissions(PERMISSIONS.DRIVERS_READ),
  RegistrationController.listDrivers
);

router.get(
  '/owners',
  requirePermissions(PERMISSIONS.DRIVERS_READ),
  RegistrationController.listOwners
);

router.get(
  '/vehicles',
  requirePermissions(PERMISSIONS.DRIVERS_READ),
  RegistrationController.listVehicles
);

export default router;
