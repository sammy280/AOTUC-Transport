import { Router } from 'express';
import TransportLinesController from './transport-lines.controller.js';
import { authenticateToken, requireRoles } from '../../middlewares/authMiddleware.js';

const router = Router();

// GeoJSON feeds for MapLibre GL
router.get('/geojson', TransportLinesController.getLinesGeoJson);
router.get('/stops/geojson', TransportLinesController.getStopsGeoJson);
router.get('/', TransportLinesController.listLines);

// Protected Management Endpoints
router.use(authenticateToken);

router.post(
  '/',
  requireRoles('DIRECTOR', 'SUPER_ADMIN'),
  TransportLinesController.createLine
);

router.post(
  '/stops',
  requireRoles('DIRECTOR', 'CHEF_SERVICE', 'SUPER_ADMIN'),
  TransportLinesController.createStop
);

router.post(
  '/assign-stops',
  requireRoles('DIRECTOR', 'CHEF_SERVICE', 'SUPER_ADMIN'),
  TransportLinesController.assignStops
);

export default router;
