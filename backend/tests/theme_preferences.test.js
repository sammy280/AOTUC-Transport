import request from 'supertest';
import app from '../src/app.js';
import jwt from 'jsonwebtoken';
import config from '../src/config/index.js';

describe('AOTUC Theme & Appearance Preferences Suite', () => {
  // Helper to generate realistic Bearer tokens for different roles
  const makeToken = (user) => {
    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        roles: Array.isArray(user.roles) ? user.roles : [user.role],
        communeId: user.communeId || null,
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );
  };

  const directorUser = {
    id: 'usr-dir-001',
    email: 'directeur@aotuc.test',
    roles: ['DIRECTOR'],
  };

  const agentUser = {
    id: 'usr-agt-002',
    email: 'agent.matoto@aotuc.test',
    roles: ['AGENT_TERRAIN'],
    communeId: 'c-matoto',
  };

  const superAdminUser = {
    id: 'usr-dsi-003',
    email: 'superadmin@aotuc.test',
    roles: ['SUPER_ADMIN'],
  };

  const directorToken = makeToken(directorUser);
  const agentToken = makeToken(agentUser);
  const adminToken = makeToken(superAdminUser);

  describe('1. Authentication Gate Enforcement', () => {
    it('should reject unauthenticated GET /preferences/theme with 401', async () => {
      const res = await request(app).get('/api/v1/auth/preferences/theme');
      expect(res.statusCode).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('should reject unauthenticated PUT /preferences/theme with 401', async () => {
      const res = await request(app)
        .put('/api/v1/auth/preferences/theme')
        .send({ theme: 'dark' });
      expect(res.statusCode).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('should reject invalid Bearer token with 401', async () => {
      const res = await request(app)
        .get('/api/v1/auth/preferences/theme')
        .set('Authorization', 'Bearer invalid_bogus_token');
      expect(res.statusCode).toBe(401);
      expect(res.body.code).toBe('INVALID_ACCESS_TOKEN');
    });
  });

  describe('2. Validation & Input Sanitization', () => {
    it('should return default "system" when user has not saved any preference yet', async () => {
      const newUser = { id: `usr-fresh-${Date.now()}`, email: 'fresh@aotuc.test', roles: ['DISTRIBUTEUR'] };
      const freshToken = makeToken(newUser);

      const res = await request(app)
        .get('/api/v1/auth/preferences/theme')
        .set('Authorization', `Bearer ${freshToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.theme).toBe('system');
    });

    it('should reject invalid theme string values with 400', async () => {
      const res = await request(app)
        .put('/api/v1/auth/preferences/theme')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ theme: 'high-contrast-neon' });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Thème invalide');
    });

    it('should accept valid values: "light", "dark", "system"', async () => {
      for (const validTheme of ['light', 'dark', 'system']) {
        const res = await request(app)
          .put('/api/v1/auth/preferences/theme')
          .set('Authorization', `Bearer ${directorToken}`)
          .send({ theme: validTheme });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.theme).toBe(validTheme);
      }
    });
  });

  describe('3. Multi-User Theme Isolation & Persistence', () => {
    it('should persist distinct themes for different users without collision', async () => {
      // 1. Set Director to dark mode
      const dirSetRes = await request(app)
        .put('/api/v1/auth/preferences/theme')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ theme: 'dark' });
      expect(dirSetRes.statusCode).toBe(200);

      // 2. Set Agent to light mode
      const agtSetRes = await request(app)
        .put('/api/v1/auth/preferences/theme')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({ theme: 'light' });
      expect(agtSetRes.statusCode).toBe(200);

      // 3. Set SuperAdmin to system mode
      const dsiSetRes = await request(app)
        .put('/api/v1/auth/preferences/theme')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ theme: 'system' });
      expect(dsiSetRes.statusCode).toBe(200);

      // 4. Verify Director is still dark
      const dirCheck = await request(app)
        .get('/api/v1/auth/preferences/theme')
        .set('Authorization', `Bearer ${directorToken}`);
      expect(dirCheck.body.data.theme).toBe('dark');

      // 5. Verify Agent is still light
      const agtCheck = await request(app)
        .get('/api/v1/auth/preferences/theme')
        .set('Authorization', `Bearer ${agentToken}`);
      expect(agtCheck.body.data.theme).toBe('light');

      // 6. Verify SuperAdmin is still system
      const dsiCheck = await request(app)
        .get('/api/v1/auth/preferences/theme')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(dsiCheck.body.data.theme).toBe('system');
    });
  });

  describe('4. Security & Non-Elevation Guarantee', () => {
    it('changing theme preference must not modify RBAC roles or permissions', async () => {
      // Change Agent theme to dark
      await request(app)
        .put('/api/v1/auth/preferences/theme')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({ theme: 'dark' });

      // Verify identity endpoint /me returns unchanged AGENT_TERRAIN role and permissions
      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${agentToken}`);

      expect(meRes.statusCode).toBe(200);
      expect(meRes.body.data.user.roles).toContain('AGENT_TERRAIN');
      expect(meRes.body.data.user.roles).not.toContain('DIRECTOR');
      expect(meRes.body.data.user.roles).not.toContain('SUPER_ADMIN');
    });
  });
});
