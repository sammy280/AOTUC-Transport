import request from 'supertest';
import app from '../src/app.js';
import jwt from 'jsonwebtoken';
import config from '../src/config/index.js';
import prisma from '../src/utils/prisma.js';
import fs from 'fs';
import path from 'path';

describe('AOTUC — Dashboard Conakry Map Verification Audit (Admin & Distributor)', () => {
  let superAdminToken;
  let directorToken;
  let distributorToken;
  let chefMatotoToken;
  let agentGbessiaToken;

  const EXPECTED_13_COMMUNES = [
    'Kaloum',
    'Dixinn',
    'Matam',
    'Ratoma',
    'Matoto',
    'Kassa',
    'Gbessia',
    'Tombolia',
    'Lambanyi',
    'Sonfonia',
    'Kagbélen',
    'Sanoyah',
    'Manéah',
  ];

  beforeAll(async () => {
    // Generate valid test JWT tokens
    superAdminToken = jwt.sign(
      { sub: 'usr-super-admin', roles: ['SUPER_ADMIN'], communeId: null },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '30m' }
    );

    directorToken = jwt.sign(
      { sub: 'usr-director', roles: ['DIRECTOR'], communeId: null },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '30m' }
    );

    distributorToken = jwt.sign(
      { sub: 'usr-distributor', roles: ['DISTRIBUTEUR'], communeId: null },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '30m' }
    );

    chefMatotoToken = jwt.sign(
      { sub: 'usr-chef-matoto', roles: ['CHEF_SERVICE'], communeId: 'commune-matoto-uuid' },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '30m' }
    );

    agentGbessiaToken = jwt.sign(
      { sub: 'usr-agent-gbessia', roles: ['AGENT_TERRAIN'], communeId: 'commune-gbessia-uuid' },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '30m' }
    );
  });

  describe('1. 13-Commune Reference Integrity & GIS Data Standardization', () => {
    it('should verify that all 13 official communes exist in PostgreSQL without omissions', async () => {
      const dbCommunes = await prisma.commune.findMany({ select: { name: true } });
      const dbNames = dbCommunes.map((c) => c.name);

      for (const expected of EXPECTED_13_COMMUNES) {
        expect(dbNames).toContain(expected);
      }
      expect(dbNames.length).toBeGreaterThanOrEqual(13);
    });

    it('should verify that gisData.ts in web-admin contains all 13 communes and stops coverage', () => {
      const gisDataPath = path.resolve(process.cwd(), '../web-admin/src/features/mapping/gisData.ts');
      expect(fs.existsSync(gisDataPath)).toBe(true);

      const content = fs.readFileSync(gisDataPath, 'utf8');
      expect(content).toContain('INITIAL_CONAKRY_LINES');
      expect(content).toContain('INITIAL_CONAKRY_STOPS');

      // Verify all 13 communes are represented in stops
      for (const comm of EXPECTED_13_COMMUNES) {
        expect(content).toContain(comm);
      }
    });
  });

  describe('2. Backend GeoJSON Network Feeds for Conakry Map', () => {
    it('should return 200 with FeatureCollection for lines GeoJSON feed', async () => {
      const res = await request(app).get('/api/v1/transport-lines/geojson');
      expect(res.statusCode).toBe(200);
      expect(res.body.type).toBe('FeatureCollection');
      expect(Array.isArray(res.body.features)).toBe(true);
      expect(res.body.features.length).toBeGreaterThan(0);

      // Check LineString coordinates format
      const firstLine = res.body.features[0];
      expect(firstLine.geometry.type).toBe('LineString');
      expect(Array.isArray(firstLine.geometry.coordinates)).toBe(true);
    });

    it('should return 200 with FeatureCollection for stops GeoJSON feed', async () => {
      const res = await request(app).get('/api/v1/transport-lines/stops/geojson');
      expect(res.statusCode).toBe(200);
      expect(res.body.type).toBe('FeatureCollection');
      expect(Array.isArray(res.body.features)).toBe(true);
      expect(res.body.features.length).toBeGreaterThan(0);

      // Check Point geometry coordinates format
      const firstStop = res.body.features[0];
      expect(firstStop.geometry.type).toBe('Point');
      expect(firstStop.geometry.coordinates.length).toBe(2);
    });
  });

  describe('3. Dashboard Conakry Map Component Integration in Web-Admin', () => {
    it('should verify ConakryMapWidget exists and includes interactive Leaflet controls', () => {
      const widgetPath = path.resolve(process.cwd(), '../web-admin/src/features/mapping/ConakryMapWidget.tsx');
      expect(fs.existsSync(widgetPath)).toBe(true);

      const content = fs.readFileSync(widgetPath, 'utf8');
      // Leaflet and controls checks
      expect(content).toContain('L.map');
      expect(content).toContain('L.tileLayer');
      expect(content).toContain('L.polyline');
      expect(content).toContain('L.circleMarker');
      expect(content).toContain('handleZoomIn');
      expect(content).toContain('handleZoomOut');
      expect(content).toContain('handleRecenter');
      expect(content).toContain('CONAKRY_COMMUNES');
      expect(content).toContain('onOpenFullMap');
    });

    it('should verify DashboardOverview embeds ConakryMapWidget for Admin (SUPER_ADMIN & DIRECTOR)', () => {
      const dashboardPath = path.resolve(process.cwd(), '../web-admin/src/features/dashboard/DashboardOverview.tsx');
      const content = fs.readFileSync(dashboardPath, 'utf8');

      expect(content).toContain("import ConakryMapWidget from '../mapping/ConakryMapWidget';");

      // Verify SUPER_ADMIN dashboard section contains ConakryMapWidget
      const superAdminSection = content.slice(content.indexOf("currentUser.role === 'SUPER_ADMIN'"), content.indexOf("currentUser.role === 'CHEF_SERVICE'"));
      expect(superAdminSection).toContain('<ConakryMapWidget');
      expect(superAdminSection).toContain("navigateTo('mapping')");

      // Verify DIRECTOR dashboard section contains ConakryMapWidget
      const directorSection = content.slice(content.indexOf('Tableau de Bord Stratégique — Direction Générale AOTUC'));
      expect(directorSection).toContain('<ConakryMapWidget');
    });

    it('should verify DashboardOverview embeds ConakryMapWidget for DISTRIBUTEUR', () => {
      const dashboardPath = path.resolve(process.cwd(), '../web-admin/src/features/dashboard/DashboardOverview.tsx');
      const content = fs.readFileSync(dashboardPath, 'utf8');

      // Verify DISTRIBUTEUR dashboard section contains ConakryMapWidget
      const distributorSection = content.slice(content.indexOf("currentUser.role === 'DISTRIBUTEUR'"), content.indexOf('Tableau de Bord Stratégique'));
      expect(distributorSection).toContain('<ConakryMapWidget');
      expect(distributorSection).toContain('Réseau Urbain de Conakry & Points de Desserte Billetterie');
      expect(distributorSection).toContain("navigateTo('mapping')");
    });

    it('should verify DashboardOverview preserves all existing KPI statistics for all roles', () => {
      const dashboardPath = path.resolve(process.cwd(), '../web-admin/src/features/dashboard/DashboardOverview.tsx');
      const content = fs.readFileSync(dashboardPath, 'utf8');

      // DSI stats
      expect(content).toContain('Comptes Utilisateurs Actifs');
      expect(content).toContain('Santé des Composants API');
      expect(content).toContain('Intégrité Cryptographique');

      // Distributor stats
      expect(content).toContain('Tickets Vendus Aujourd hui');
      expect(content).toContain('Recettes Totales du Jour');
      expect(content).toContain('Paiements Mobile Money');
      expect(content).toContain('Carnets en Stock de Vente');

      // Director stats
      expect(content).toContain('Chauffeurs Enrôlés (National)');
      expect(content).toContain('Véhicules Régulés');
      expect(content).toContain('Badges CR80 Délivrés');
    });
  });

  describe('4. RBAC, Privacy & Commune Isolation on Map Feeds', () => {
    it('should verify NetworkMapView reuses shared gisData without duplicating tables or schemas', () => {
      const networkMapPath = path.resolve(process.cwd(), '../web-admin/src/features/mapping/NetworkMapView.tsx');
      const content = fs.readFileSync(networkMapPath, 'utf8');

      expect(content).toContain("from './gisData';");
      expect(content).toContain('INITIAL_CONAKRY_LINES');
      expect(content).toContain('INITIAL_CONAKRY_STOPS');
    });

    it('should verify permissions.ts allows DISTRIBUTEUR to open full mapping tab', () => {
      const permissionsPath = path.resolve(process.cwd(), '../web-admin/src/utils/permissions.ts');
      const content = fs.readFileSync(permissionsPath, 'utf8');

      // Verify mapping is included in DISTRIBUTEUR allowed navigation tabs
      const distMatch = content.match(/ROLE_ALLOWED_TABS[\s\S]*?DISTRIBUTEUR:\s*\[([\s\S]*?)\]/);
      expect(distMatch).not.toBeNull();
      expect(distMatch[1]).toContain("'mapping'");
    });

    it('should ensure map markers and GIS feeds do NOT expose driver CNI or private PII', async () => {
      const linesRes = await request(app).get('/api/v1/transport-lines/geojson');
      const stopsRes = await request(app).get('/api/v1/transport-lines/stops/geojson');

      const linesStr = JSON.stringify(linesRes.body);
      const stopsStr = JSON.stringify(stopsRes.body);

      // Verify NO sensitive PII or CNI fields are present in public/shared GIS payloads
      expect(linesStr).not.toContain('cniNumber');
      expect(linesStr).not.toContain('cni_number');
      expect(linesStr).not.toContain('licenseNumber');
      expect(linesStr).not.toContain('password');

      expect(stopsStr).not.toContain('cniNumber');
      expect(stopsStr).not.toContain('cni_number');
      expect(stopsStr).not.toContain('licenseNumber');
      expect(stopsStr).not.toContain('password');
    });

    it('should verify non-super-admin is blocked from creating lines (403)', async () => {
      const res = await request(app)
        .post('/api/v1/transport-lines')
        .set('Authorization', `Bearer ${distributorToken}`)
        .send({
          code: 'L-HACK',
          name: 'Unauthorized Line',
          originName: 'A',
          destinationName: 'B',
          pathCoordinates: [[-13.7, 9.5], [-13.6, 9.6]],
        });

      expect(res.statusCode).toBe(403);
    });
  });
});
