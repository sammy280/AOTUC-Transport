import request from 'supertest';
import app from '../src/app.js';
import jwt from 'jsonwebtoken';
import config from '../src/config/index.js';

describe('Milestone 1 — Backend Foundation & Security Gates', () => {
  describe('1. Health Check Endpoint', () => {
    it('should return a valid health check payload structure', async () => {
      const res = await request(app).get('/api/v1/health');
      
      expect(res.statusCode).toBeOneOf ? expect(res.statusCode).toBeOneOf([200, 503]) : expect([200, 503]).toContain(res.statusCode);
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

      // Attempting to access Kaloum commune with Matoto credentials
      const res = await request(app)
        .get('/api/v1/auth/test-scope/commune-kaloum-uuid')
        .set('Authorization', `Bearer ${chefMatotoToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN_COMMUNE_SCOPE');
      expect(res.body.message).toContain('Vous n êtes pas autorisé à consulter ou modifier les données d une autre commune');
    });
  });
});
