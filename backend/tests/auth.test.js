import request from 'supertest';
import { jest } from '@jest/globals';
import app from '../src/app.js';
import jwt from 'jsonwebtoken';
import config from '../src/config/index.js';
import { RevocationRegistry } from '../src/middlewares/authMiddleware.js';

describe('Milestone 1 & Phase 2 — Backend Authentication, Session Rotation & Mobile Device Security', () => {
  jest.setTimeout(30000);

  describe('1. Health Check Endpoint', () => {
    it('should return a valid health check payload structure', async () => {
      const res = await request(app).get('/api/v1/health');

      expect([200, 503]).toContain(res.statusCode);
      expect(res.body).toHaveProperty('service', 'AOTUC-TRANSPORT-API');
      expect(res.body).toHaveProperty('version', '2.0.0');
      expect(res.body).toHaveProperty('components');
      expect(res.body.components).toHaveProperty('database');
    });
  });

  describe('2. Security Headers & 404 Handling', () => {
    it('should include Helmet security headers', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.headers).toHaveProperty('x-dns-prefetch-control');
      expect(res.headers).toHaveProperty('x-frame-options');
    });

    it('should return 404 in French for undefined routes', async () => {
      const res = await request(app).get('/api/v1/non-existent-route');
      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('NOT_FOUND');
      expect(res.body.message).toContain('Ressource non trouvée');
    });
  });

  describe('3. Protected Routes & RBAC Middleware Gates', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.statusCode).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
      expect(res.body.message).toContain('Authentification requise');
    });

    it('should reject invalid Bearer token with 401', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid_garbage_token');
      expect(res.statusCode).toBe(401);
      expect(res.body.code).toBe('INVALID_ACCESS_TOKEN');
    });

    it('should reject expired JWT access token with 401 TOKEN_EXPIRED', async () => {
      const expiredToken = jwt.sign(
        { sub: 'user-uuid-1234', roles: ['AGENT_TERRAIN'] },
        config.JWT_ACCESS_SECRET,
        { expiresIn: '-10s' }
      );

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.statusCode).toBe(401);
      expect(res.body.code).toBe('TOKEN_EXPIRED');
    });

    it('should allow authenticated user to view /me', async () => {
      const mockPayload = {
        sub: 'user-uuid-1234',
        email: 'test@aotuc.test',
        phoneNumber: '+224620000001',
        roles: ['AGENT_TERRAIN'],
        communeId: 'commune-matoto-uuid',
      };

      const validToken = jwt.sign(mockPayload, config.JWT_ACCESS_SECRET, { expiresIn: '15m' });

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBe('user-uuid-1234');
      expect(res.body.data.user.roles).toContain('AGENT_TERRAIN');
    });
  });

  describe('4. Territorial Scope Gates (Commune isolation)', () => {
    it('should permit SUPER_ADMIN to access any commune', async () => {
      const adminToken = jwt.sign(
        { sub: 'admin-1', roles: ['SUPER_ADMIN'], communeId: null },
        config.JWT_ACCESS_SECRET,
        { expiresIn: '15m' }
      );

      const res = await request(app)
        .get('/api/v1/auth/test-scope/any-commune-id-999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should permit CHEF_SERVICE to access their OWN assigned commune', async () => {
      const chefToken = jwt.sign(
        { sub: 'chef-matoto', roles: ['CHEF_SERVICE'], communeId: 'commune-matoto-uuid' },
        config.JWT_ACCESS_SECRET,
        { expiresIn: '15m' }
      );

      const res = await request(app)
        .get('/api/v1/auth/test-scope/commune-matoto-uuid')
        .set('Authorization', `Bearer ${chefToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.requestedCommuneId).toBe('commune-matoto-uuid');
    });

    it('should STRICTLY FORBID CHEF_SERVICE from accessing another commune (403)', async () => {
      const chefMatotoToken = jwt.sign(
        { sub: 'chef-matoto', roles: ['CHEF_SERVICE'], communeId: 'commune-matoto-uuid' },
        config.JWT_ACCESS_SECRET,
        { expiresIn: '15m' }
      );

      const res = await request(app)
        .get('/api/v1/auth/test-scope/commune-kaloum-uuid')
        .set('Authorization', `Bearer ${chefMatotoToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN_COMMUNE_SCOPE');
      expect(res.body.message).toContain(
        'Vous n êtes pas autorisé à consulter ou modifier les données d une autre commune'
      );
    });
  });

  describe('5. Phase 2 — Real Login, Refresh Rotation, Logout & Mobile Device Revocation', () => {
    const testDeviceId = 'AOTUC-MOB-TEST0001';
    let issuedAccessToken = null;
    let issuedRefreshToken = null;
    let agentUserId = null;

    const superAdminToken = jwt.sign(
      { sub: 'admin-device-mgr', roles: ['SUPER_ADMIN'], communeId: null },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    afterAll(() => {
      RevocationRegistry.restoreDevice(testDeviceId);
      if (agentUserId) {
        RevocationRegistry.reactivateUser(agentUserId);
      }
    });

    it('should authenticate field agent with email/phone, register deviceId, and return commune + permissions', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('X-Device-Id', testDeviceId)
        .send({
          identifier: 'agent.matoto@aotuc.test',
          password: 'DevAotuc2026!',
          deviceId: testDeviceId,
          deviceName: 'Tablette Recensement Matoto #1',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
      expect(res.body.data.user.roles).toContain('AGENT_TERRAIN');
      expect(res.body.data.user.permissions).toContain('drivers.create');
      expect(res.body.data.user.commune).not.toBeNull();
      expect(res.body.data.user.commune.name).toBe('Matoto');

      issuedAccessToken = res.body.data.accessToken;
      issuedRefreshToken = res.body.data.refreshToken;
      agentUserId = res.body.data.user.id;
    });

    it('should reject login with incorrect password (401 INVALID_CREDENTIALS)', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        identifier: 'agent.matoto@aotuc.test',
        password: 'WrongPassword999!',
      });

      expect(res.statusCode).toBe(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login for unknown user (401 INVALID_CREDENTIALS)', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        identifier: 'inconnu.fantome@aotuc.gov.gn',
        password: 'DevAotuc2026!',
      });

      expect(res.statusCode).toBe(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('should rotate tokens via POST /api/v1/auth/refresh', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('X-Device-Id', testDeviceId)
        .send({
          refreshToken: issuedRefreshToken,
          deviceId: testDeviceId,
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');

      issuedAccessToken = res.body.data.accessToken;
      issuedRefreshToken = res.body.data.refreshToken;
    });

    it('should allow administrator to revoke a lost/stolen mobile device and block its session (401 DEVICE_REVOKED)', async () => {
      // 1. Admin revokes the device
      const revRes = await request(app)
        .post(`/api/v1/auth/devices/${testDeviceId}/revoke`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ reason: 'Tablette perdue sur le terrain à Sangoyah' });

      expect(revRes.statusCode).toBe(200);
      expect(revRes.body.data.isRevoked).toBe(true);

      // 2. Any API call from the revoked device is immediately blocked with 401 DEVICE_REVOKED
      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${issuedAccessToken}`)
        .set('X-Device-Id', testDeviceId);

      expect(meRes.statusCode).toBe(401);
      expect(meRes.body.code).toBe('DEVICE_REVOKED');

      // 3. Login from the revoked device is also blocked (403 DEVICE_REVOKED)
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        identifier: 'agent.matoto@aotuc.test',
        password: 'DevAotuc2026!',
        deviceId: testDeviceId,
      });

      expect(loginRes.statusCode).toBe(403);
      expect(loginRes.body.code).toBe('DEVICE_REVOKED');

      // 4. Admin restores the device
      const restoreRes = await request(app)
        .post(`/api/v1/auth/devices/${testDeviceId}/restore`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(restoreRes.statusCode).toBe(200);
      expect(restoreRes.body.data.isRevoked).toBe(false);
    });

    it('should revoke refresh token on POST /api/v1/auth/logout', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${issuedAccessToken}`)
        .send({ refreshToken: issuedRefreshToken });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
