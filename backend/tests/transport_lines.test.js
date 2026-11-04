import request from 'supertest';
import { jest } from '@jest/globals';
import app from '../src/app.js';
import jwt from 'jsonwebtoken';
import config from '../src/config/index.js';
import GisCalculationService from '../src/services/gisCalculationService.js';
import prisma from '../src/utils/prisma.js';

describe('Milestone 5 — Conakry Mapping & Transport Route Management (GIS)', () => {
  let directorToken;
  let agentToken;

  beforeAll(() => {
    // Mock prisma queries for GeoJSON test endpoints without requiring live DB
    jest.spyOn(prisma.transportLine, 'findMany').mockImplementation(async () => {
      return [
        {
          id: 'line-mock-01',
          code: 'L-01',
          name: 'Kaloum Port — Matoto Rond-point',
          colorHex: '#2563EB',
          originName: 'Kaloum Port',
          destinationName: 'Matoto',
          distanceKm: 15.4,
          estimatedMinutes: 42,
          isActive: true,
          pathCoordinates: [[-13.7122, 9.5092], [-13.6052, 9.5984]],
          stops: [],
        },
      ];
    });

    jest.spyOn(prisma.transportStop, 'findMany').mockImplementation(async () => {
      return [
        {
          id: 'stop-mock-01',
          code: 'ARR-01',
          name: 'Gare Centrale Kaloum',
          latitude: 9.5092,
          longitude: -13.7122,
          isSheltered: true,
          commune: { name: 'Kaloum' },
        },
      ];
    });

    directorToken = jwt.sign(
      { sub: 'director-001', roles: ['DIRECTOR'], communeId: null },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    agentToken = jwt.sign(
      { sub: 'agent-001', roles: ['AGENT_TERRAIN'], communeId: 'commune-matoto' },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );
  });

  describe('1. Geodesic Calculations & Conakry Urban Corridor Estimates', () => {
    it('should accurately compute distance between Kaloum and Matoto (~15 km)', () => {
      // Kaloum: 9.5092, -13.7122
      // Matoto: 9.5984, -13.6052
      const distance = GisCalculationService.calculateDistanceKm(9.5092, -13.7122, 9.5984, -13.6052);
      expect(distance).toBeGreaterThan(12);
      expect(distance).toBeLessThan(18);
    });

    it('should compute cumulative polyline distance along road network', () => {
      // 3 GPS points in Conakry along Autoroute Fidel Castro
      const polyline = [
        [-13.7122, 9.5092], // Kaloum
        [-13.6651, 9.5441], // Madina
        [-13.6052, 9.5984], // Matoto
      ];

      const totalDist = GisCalculationService.calculatePolylineDistanceKm(polyline);
      expect(totalDist).toBeGreaterThan(13);
      expect(totalDist).toBeLessThan(18);
    });

    it('should estimate urban travel time realistically for Conakry transit', () => {
      const dist15km = 15;
      const minutes = GisCalculationService.estimateTravelMinutes(dist15km, 22);
      // 15km at 22km/h ≈ 41 minutes
      expect(minutes).toBeGreaterThanOrEqual(35);
      expect(minutes).toBeLessThanOrEqual(45);
    });
  });

  describe('2. GeoJSON Feature Standardization (MapLibre GL)', () => {
    it('should serialize transport line into GeoJSON LineString Feature', () => {
      const mockLine = {
        id: 'line-uuid-001',
        code: 'L-01',
        name: 'Kaloum Port — Matoto Rond-point',
        colorHex: '#2563EB',
        originName: 'Kaloum Port',
        destinationName: 'Matoto',
        distanceKm: 15.4,
        estimatedMinutes: 42,
        isActive: true,
        pathCoordinates: [[-13.7122, 9.5092], [-13.6052, 9.5984]],
      };

      const feature = GisCalculationService.toGeoJsonFeature(mockLine);
      expect(feature.type).toBe('Feature');
      expect(feature.geometry.type).toBe('LineString');
      expect(feature.geometry.coordinates).toHaveLength(2);
      expect(feature.properties.code).toBe('L-01');
    });

    it('should serialize stops into GeoJSON FeatureCollection', () => {
      const mockStops = [
        { id: 's1', code: 'ARR-01', name: 'Gare Centrale', latitude: 9.5092, longitude: -13.7122, isSheltered: true },
        { id: 's2', code: 'ARR-02', name: 'Madina Marché', latitude: 9.5441, longitude: -13.6651, isSheltered: false },
      ];

      const collection = GisCalculationService.stopsToGeoJson(mockStops);
      expect(collection.type).toBe('FeatureCollection');
      expect(collection.features).toHaveLength(2);
      expect(collection.features[0].geometry.type).toBe('Point');
      expect(collection.features[0].geometry.coordinates).toEqual([-13.7122, 9.5092]);
    });
  });

  describe('3. GeoJSON API Endpoints & Role Boundaries', () => {
    it('should return 200 with FeatureCollection for lines GeoJSON feed', async () => {
      const res = await request(app).get('/api/v1/transport-lines/geojson');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('type', 'FeatureCollection');
      expect(res.body).toHaveProperty('features');
    });

    it('should return 200 with FeatureCollection for stops GeoJSON feed', async () => {
      const res = await request(app).get('/api/v1/transport-lines/stops/geojson');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('type', 'FeatureCollection');
      expect(res.body).toHaveProperty('features');
    });

    it('should REJECT stop creation outside Conakry coordinates bounding box', async () => {
      const res = await request(app)
        .post('/api/v1/transport-lines/stops')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({
          code: 'ARR-INVALID',
          name: 'Fake Paris Stop',
          latitude: 48.8566, // Paris, France (outside Guinea!)
          longitude: 2.3522,
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.errors.some((e) => e.field === 'latitude')).toBe(true);
    });

    it('should REJECT Field Agent attempting to create an official line (403)', async () => {
      const res = await request(app)
        .post('/api/v1/transport-lines')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          code: 'L-99',
          name: 'Unauthorized Line',
          originName: 'Point A',
          destinationName: 'Point B',
          pathCoordinates: [[-13.7, 9.5], [-13.6, 9.6]],
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN_ROLE');
    });
  });
});
