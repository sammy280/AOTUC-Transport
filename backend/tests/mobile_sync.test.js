import request from 'supertest';
import { jest } from '@jest/globals';
import app from '../src/app.js';
import jwt from 'jsonwebtoken';
import config from '../src/config/index.js';
import prisma from '../src/utils/prisma.js';

describe('Milestone 6 — Mobile Application Offline Synchronization & Inspector Engine', () => {
  let agentToken;
  let syndicatToken;

  const mockPublicKeys = [
    {
      keyId: 'ed25519_2026_01',
      algorithm: 'Ed25519',
      publicKeyHex: 'b94e803d2745cfc1d9b33a598c4f9cf95b8d2981d3928a5a54b38bfd24021703',
      validFrom: '2026-01-01T00:00:00.000Z',
      validTo: '2028-12-31T23:59:59.000Z',
      isPrimary: true,
    },
  ];

  beforeAll(() => {
    agentToken = jwt.sign(
      { sub: 'agt-001', roles: ['AGENT_TERRAIN'], communeId: 'cm-matoto' },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    syndicatToken = jwt.sign(
      { sub: 'syn-001', roles: ['SYNDICAT'], communeId: null },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    // Mock prisma queries for sync tests
    jest.spyOn(prisma.credentialRevocation, 'findMany').mockResolvedValue([
      {
        credentialId: 'bdg-revoked-001',
        credentialType: 'DRIVER_BADGE',
        revocationReason: 'Suspension judiciaire',
        revokedAt: new Date(),
      },
    ]);

    jest.spyOn(prisma.transportLine, 'findMany').mockResolvedValue([
      {
        id: 'line-01',
        code: 'L-01',
        name: 'Kaloum - Matoto',
        colorHex: '#2563EB',
        originName: 'Kaloum Port',
        destinationName: 'Matoto Marché',
        distanceKm: 16.2,
        estimatedMinutes: 45,
      },
    ]);

    jest.spyOn(prisma.commune, 'findMany').mockResolvedValue([
      { id: 'cm-kaloum', code: 'KLM', name: 'Kaloum' },
      { id: 'cm-matoto', code: 'MTT', name: 'Matoto' },
    ]);

    jest.spyOn(prisma.person, 'findFirst').mockResolvedValue(null);
    jest.spyOn(prisma.person, 'create').mockImplementation(async ({ data }) => ({
      id: 'person-created-uuid',
      ...data,
    }));

    jest.spyOn(prisma.driver, 'create').mockImplementation(async ({ data }) => ({
      id: 'driver-created-uuid',
      ...data,
    }));

    let processedSyncIds = new Set();
    jest.spyOn(prisma.auditLog, 'findFirst').mockImplementation(async ({ where }) => {
      if (where.targetRecordId && processedSyncIds.has(where.targetRecordId)) {
        return { id: 'audit-existing-id' };
      }
      return null;
    });

    jest.spyOn(prisma.auditLog, 'create').mockImplementation(async ({ data }) => {
      if (data.targetRecordId) {
        processedSyncIds.add(data.targetRecordId);
      }
      return { id: 'audit-new-id' };
    });
  });

  describe('1. Pull Updates Endpoint (Offline Database Seeding & Cache Refresh)', () => {
    it('should allow Field Agent to pull offline public keys and revocations', async () => {
      const res = await request(app)
        .get('/api/v1/sync/pull')
        .set('Authorization', `Bearer ${agentToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('publicKeys');
      expect(res.body.data.publicKeys.length).toBeGreaterThan(0);
      expect(res.body.data).toHaveProperty('revocations');
      expect(res.body.data).toHaveProperty('lines');
      expect(res.body.data).toHaveProperty('serverTimestamp');
    });

    it('should REJECT unauthenticated pull request with 401', async () => {
      const res = await request(app).get('/api/v1/sync/pull');
      expect(res.statusCode).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });
  });

  describe('2. Push Offline Batches & Idempotency Guarantee', () => {
    const testClientId = '99999999-9999-9999-9999-999999999999';

    it('should accept valid offline driver draft from Field Agent tablet', async () => {
      const res = await request(app)
        .post('/api/v1/sync/push')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          deviceId: 'TABLET-CONAKRY-MATOTO-04',
          items: [
            {
              clientGeneratedId: testClientId,
              entityType: 'DRIVER',
              payload: {
                firstName: 'Oumar',
                lastName: 'Barry',
                phoneNumber: '+224622112233',
                nationalIdNumber: '1990031500412',
                licenseNumber: 'PC-GN-2016-9912',
                licenseCategories: ['B'],
              },
              createdOfflineAt: '2026-11-04T10:30:00.000Z',
            },
          ],
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accepted).toBe(1);
      expect(res.body.data.results[0].status).toBe('SUCCESS');
    });

    it('should guarantee idempotency when same client draft is re-pushed (ALREADY_SYNCED)', async () => {
      const res = await request(app)
        .post('/api/v1/sync/push')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          deviceId: 'TABLET-CONAKRY-MATOTO-04',
          items: [
            {
              clientGeneratedId: testClientId, // Same UUID
              entityType: 'DRIVER',
              payload: { firstName: 'Oumar', lastName: 'Barry' },
              createdOfflineAt: '2026-11-04T10:30:00.000Z',
            },
          ],
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.duplicates).toBe(1);
      expect(res.body.data.results[0].status).toBe('ALREADY_SYNCED');
    });

    it('should REJECT unauthorized role attempting to push sync queue (403)', async () => {
      const res = await request(app)
        .post('/api/v1/sync/push')
        .set('Authorization', `Bearer ${syndicatToken}`)
        .send({
          deviceId: 'HACKER-PHONE',
          items: [
            {
              clientGeneratedId: '88888888-8888-8888-8888-888888888888',
              entityType: 'DRIVER',
              payload: {},
              createdOfflineAt: '2026-11-04T10:30:00.000Z',
            },
          ],
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN_ROLE');
    });
  });
});