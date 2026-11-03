import { Router } from 'express';
import RegistrationController from './registration.controller.js';
import { authenticateToken, requireRoles } from '../../middlewares/authMiddleware.js';

const router = Router();

// All registration operations require authentication
router.use(authenticateToken);

// 1. Enrolment Endpoints (Field Agents, Chefs de Service, Admins)
router.post(
  '/drivers',
  requireRoles('AGENT_TERRAIN', 'CHEF_SERVICE', 'SUPER_ADMIN'),
  RegistrationController.registerDriver
);

router.post(
  '/owners',
  requireRoles('AGENT_TERRAIN', 'CHEF_SERVICE', 'SUPER_ADMIN'),
  RegistrationController.registerOwner
);

router.post(
  '/vehicles',
  requireRoles('AGENT_TERRAIN', 'CHEF_SERVICE', 'SUPER_ADMIN'),
  RegistrationController.registerVehicle
);

// 2. Listing & Lookup Endpoints (All staff + Syndicats for drivers)
router.get(
  '/drivers',
  requireRoles('AGENT_TERRAIN', 'CHEF_SERVICE', 'DIRECTOR', 'SUPER_ADMIN', 'SYNDICAT'),
  RegistrationController.listDrivers
);

router.get(
  '/vehicles',
  requireRoles('AGENT_TERRAIN', 'CHEF_SERVICE', 'DIRECTOR', 'SUPER_ADMIN', 'SYNDICAT'),
  RegistrationController.listVehicles
);

export default router;
