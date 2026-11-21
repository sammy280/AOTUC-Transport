import crypto from 'crypto';
import request from 'supertest';
import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import config from '../src/config/index.js';
import prisma from '../src/utils/prisma.js';

describe('Urgent Bug Regression Suite — SUPER_ADMIN Account Creation, Listing & Login', () => {
  jest.setTimeout(30000);

  let superAdminToken;
  let agentToken;

  // Isolated in-memory store so zero test accounts are written to live production PostgreSQL
  const communesStore = [
    { id: 'c0000000-0000-0000-0000-000000000001', code: 'KLM', name: 'Kaloum', description: 'Centre administratif' },
    { id: 'c0000000-0000-0000-0000-000000000005', code: 'MTT', name: 'Matoto', description: 'Grande commune urbaine' },
  ];

  const rolesStore = new Map([
    ['SUPER_ADMIN', { id: 'role-super-admin', name: 'SUPER_ADMIN', description: 'Super Administrateur DSI' }],
    ['DIRECTOR', { id: 'role-director', name: 'DIRECTOR', description: 'Directeur Général' }],
    ['CHEF_SERVICE', { id: 'role-chef-service', name: 'CHEF_SERVICE', description: 'Chef de Service Territorial' }],
    ['AGENT_TERRAIN', { id: 'role-agent-terrain', name: 'AGENT_TERRAIN', description: 'Agent de Recensement Terrain' }],
    ['DISTRIBUTEUR', { id: 'role-distributeur', name: 'DISTRIBUTEUR', description: 'Distributeur Billetterie' }],
    ['SYNDICAT', { id: 'role-syndicat', name: 'SYNDICAT', description: 'Représentant Syndical' }],
  ]);

  const usersStore = new Map();
  const userRolesStore = [];

  beforeAll(() => {
    // Seed existing SUPER_ADMIN in isolated store
    const superAdminId = '393163f3-9eea-4abf-a4b0-aa790d9ecdbe';
    usersStore.set(superAdminId, {
      id: superAdminId,
      firstName: 'Ibrahima',
      lastName: 'Diallo',
      email: 'superadmin@aotuc.test',
      phoneNumber: '+224620000001',
      jobTitle: 'Super Administrateur & Responsable DSI',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummy',
      communeId: null,
      unionId: null,
      isActive: true,
      createdAt: new Date('2026-11-17T15:13:01.425Z'),
    });
    userRolesStore.push({ userId: superAdminId, roleId: 'role-super-admin' });

    superAdminToken = jwt.sign(
      {
        sub: superAdminId,
        email: 'superadmin@aotuc.test',
        phoneNumber: '+224620000001',
        roles: ['SUPER_ADMIN'],
        communeId: null,
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    agentToken = jwt.sign(
      {
        sub: 'agent-001',
        roles: ['AGENT_TERRAIN'],
        communeId: communesStore[1].id,
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    const buildEnrichedUser = (u) => {
      if (!u) return null;
      const commune = communesStore.find((c) => c.id === u.communeId) || null;
      const roles = userRolesStore
        .filter((ur) => ur.userId === u.id)
        .map((ur) => {
          const r = Array.from(rolesStore.values()).find((role) => role.id === ur.roleId);
          return { userId: u.id, roleId: ur.roleId, role: r };
        });
      return {
        ...u,
        commune,
        union: null,
        roles,
      };
    };

    jest.spyOn(prisma.commune, 'findMany').mockImplementation(async () => communesStore);
    jest.spyOn(prisma.commune, 'findFirst').mockImplementation(async ({ where }) => {
      const orClauses = where?.OR || [];
      for (const c of communesStore) {
        for (const clause of orClauses) {
          if (clause.id && c.id === clause.id) return c;
          if (clause.code?.equals && c.code.toLowerCase() === clause.code.equals.toLowerCase()) return c;
          if (clause.name?.equals && c.name.toLowerCase() === clause.name.equals.toLowerCase()) return c;
        }
      }
      return null;
    });

    jest.spyOn(prisma.user, 'findFirst').mockImplementation(async ({ where }) => {
      const orClauses = where?.OR || [];
      for (const u of usersStore.values()) {
        for (const clause of orClauses) {
          if (clause.phoneNumber && u.phoneNumber === clause.phoneNumber) {
            return buildEnrichedUser(u);
          }
          if (clause.email && typeof clause.email === 'string' && u.email === clause.email) {
            return buildEnrichedUser(u);
          }
          if (clause.email?.equals && u.email?.toLowerCase() === clause.email.equals.toLowerCase()) {
            return buildEnrichedUser(u);
          }
        }
      }
      return null;
    });

    jest.spyOn(prisma.user, 'findUnique').mockImplementation(async ({ where }) => {
      if (where?.id) return buildEnrichedUser(usersStore.get(where.id) || null);
      if (where?.email) {
        const found = Array.from(usersStore.values()).find((u) => u.email === where.email);
        return buildEnrichedUser(found || null);
      }
      if (where?.phoneNumber) {
        const found = Array.from(usersStore.values()).find((u) => u.phoneNumber === where.phoneNumber);
        return buildEnrichedUser(found || null);
      }
      return null;
    });

    jest.spyOn(prisma.user, 'findMany').mockImplementation(async () => {
      return Array.from(usersStore.values())
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(buildEnrichedUser);
    });

    jest.spyOn(prisma.user, 'count').mockImplementation(async () => usersStore.size);

    jest.spyOn(prisma.user, 'create').mockImplementation(async ({ data }) => {
      const id = crypto.randomUUID();
      const created = {
        id,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phoneNumber: data.phoneNumber,
        jobTitle: data.jobTitle,
        passwordHash: data.passwordHash,
        communeId: data.communeId || null,
        unionId: null,
        isActive: data.isActive ?? true,
        createdAt: new Date(),
      };
      usersStore.set(id, created);
      return created;
    });

    jest.spyOn(prisma.user, 'update').mockImplementation(async ({ where, data }) => {
      const existing = usersStore.get(where.id);
      const updated = { ...existing, ...data };
      usersStore.set(where.id, updated);
      return updated;
    });

    jest.spyOn(prisma.role, 'findUnique').mockImplementation(async ({ where }) => {
      return rolesStore.get(where.name) || null;
    });

    jest.spyOn(prisma.role, 'upsert').mockImplementation(async ({ where, create }) => {
      if (!rolesStore.has(where.name)) {
        rolesStore.set(where.name, { id: `role-${where.name}`, ...create });
      }
      return rolesStore.get(where.name);
    });

    jest.spyOn(prisma.userRole, 'create').mockImplementation(async ({ data }) => {
      userRolesStore.push(data);
      return data;
    });

    jest.spyOn(prisma.userRole, 'deleteMany').mockImplementation(async ({ where }) => {
      const idxs = [];
      userRolesStore.forEach((ur, i) => {
        if (ur.userId === where.userId) idxs.unshift(i);
      });
      for (const idx of idxs) userRolesStore.splice(idx, 1);
      return { count: idxs.length };
    });

    jest.spyOn(prisma.refreshToken, 'create').mockImplementation(async ({ data }) => data);
    jest.spyOn(prisma.refreshToken, 'deleteMany').mockImplementation(async () => ({ count: 1 }));
    jest.spyOn(prisma.auditLog, 'create').mockImplementation(async ({ data }) => ({
      id: crypto.randomUUID(),
      ...data,
    }));

    jest.spyOn(prisma, '$transaction').mockImplementation(async (arg) => {
      if (typeof arg === 'function') {
        return await arg(prisma);
      }
      return Promise.all(arg);
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  let createdAccountId = null;
  let createdAccountPassword = null;
  const createdEmail = 'nouveau.chef.matoto@aotuc.gov.gn';
  const createdPhoneRaw = '625 44 55 66';
  const createdPhoneE164 = '+224625445566';

  it('1. should reject account creation when placeholder token "session-token" or unauthorized role is used', async () => {
    const badTokenRes = await request(app)
      .post('/api/v1/users')
      .set('Authorization', 'Bearer session-token')
      .send({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@aotuc.gov.gn',
        phoneNumber: '+224620998877',
        role: 'AGENT_TERRAIN',
      });

    expect(badTokenRes.statusCode).toBe(401);

    const forbiddenRes = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@aotuc.gov.gn',
        phoneNumber: '+224620998877',
        role: 'AGENT_TERRAIN',
      });

    expect(forbiddenRes.statusCode).toBe(403);
  });

  it('2. should create a new user account as SUPER_ADMIN (even when communeId is a slug like "comm-mtt") and persist Argon2id hash', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        firstName: 'Thierno',
        lastName: 'Soumah',
        email: createdEmail,
        phoneNumber: createdPhoneRaw,
        jobTitle: 'Chef de Brigade Territoriale Matoto',
        role: 'CHEF_SERVICE',
        communeId: 'comm-mtt', // Slug ID from INITIAL_COMMUNES resolved to real Matoto UUID
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.email).toBe(createdEmail);
    expect(res.body.data.phoneNumber).toBe(createdPhoneE164);
    expect(res.body.data.roles).toContain('CHEF_SERVICE');
    expect(res.body.data.commune.name).toBe('Matoto');
    expect(res.body.data.temporaryPassword).toBeDefined();
    expect(res.body.data.temporaryPassword.length).toBeGreaterThanOrEqual(8);

    createdAccountId = res.body.data.id;
    createdAccountPassword = res.body.data.temporaryPassword;
  });

  it('3. should immediately include the newly created account in GET /api/v1/users list', async () => {
    const listRes = await request(app)
      .get('/api/v1/users?limit=200')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(listRes.statusCode).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(Array.isArray(listRes.body.items)).toBe(true);

    const found = listRes.body.items.find((u) => u.id === createdAccountId);
    expect(found).toBeDefined();
    expect(found.email).toBe(createdEmail);
    expect(found.phoneNumber).toBe(createdPhoneE164);
    expect(found.roles).toContain('CHEF_SERVICE');
    expect(found.commune.name).toBe('Matoto');
    expect(found.isActive).toBe(true);
  });

  it('4. should allow the newly created account to log in using EMAIL and temporaryPassword', async () => {
    const loginEmailRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        identifier: createdEmail,
        password: createdAccountPassword,
      });

    expect(loginEmailRes.statusCode).toBe(200);
    expect(loginEmailRes.body.success).toBe(true);
    expect(loginEmailRes.body.data).toHaveProperty('accessToken');
    expect(loginEmailRes.body.data.user.id).toBe(createdAccountId);
    expect(loginEmailRes.body.data.user.roles).toContain('CHEF_SERVICE');
    expect(loginEmailRes.body.data.user.commune.name).toBe('Matoto');
  });

  it('5. should allow the newly created account to log in using PHONE NUMBER (formatted or E.164)', async () => {
    const loginPhoneRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        identifier: '625445566',
        password: createdAccountPassword,
      });

    expect(loginPhoneRes.statusCode).toBe(200);
    expect(loginPhoneRes.body.success).toBe(true);
    expect(loginPhoneRes.body.data.user.id).toBe(createdAccountId);
  });

  it('6. should reject duplicate email or phone number with 409 CONFLICT', async () => {
    const dupRes = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        firstName: 'Autre',
        lastName: 'Utilisateur',
        email: createdEmail,
        phoneNumber: '+224629112233',
        role: 'AGENT_TERRAIN',
      });

    expect(dupRes.statusCode).toBe(409);
    expect(dupRes.body.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('7. should normalize buildApiUrl so login, user creation, and user listing never duplicate /api/v1/api/v1 across any VITE_API_URL config', () => {
    const normalizeBaseOrigin = (rawBaseUrl) => {
      if (typeof rawBaseUrl !== 'string') return '';
      let cleaned = rawBaseUrl.trim().replace(/\/+$/, '');
      while (/\/api(\/v1)?$/i.test(cleaned)) {
        cleaned = cleaned.replace(/\/api(\/v1)?$/i, '').replace(/\/+$/, '');
      }
      return cleaned;
    };

    const buildApiUrl = (path, overrideEnvUrl) => {
      const base = normalizeBaseOrigin(overrideEnvUrl);
      let cleanPath = String(path || '').trim();
      if (!cleanPath.startsWith('/')) cleanPath = `/${cleanPath}`;
      cleanPath = cleanPath.replace(/^(\/api(\/v1)?)+(?=\/|$)/i, '/api/v1');
      if (!cleanPath.startsWith('/api/v1')) cleanPath = `/api/v1${cleanPath}`;
      return `${base}${cleanPath}`;
    };

    const relativeConfigs = ['', '/', '/api', '/api/v1', '/api/v1/'];
    for (const cfg of relativeConfigs) {
      const loginUrl = buildApiUrl('/api/v1/auth/login', cfg);
      const createUsersUrl = buildApiUrl('/api/v1/users', cfg);
      const listUsersUrl = buildApiUrl('/api/v1/users?limit=200', cfg);
      const meUrl = buildApiUrl('/api/v1/auth/me', cfg);

      expect(loginUrl).toBe('/api/v1/auth/login');
      expect(createUsersUrl).toBe('/api/v1/users');
      expect(listUsersUrl).toBe('/api/v1/users?limit=200');
      expect(meUrl).toBe('/api/v1/auth/me');
      expect(loginUrl).not.toContain('/api/v1/api/v1');
      expect(createUsersUrl).not.toContain('/api/v1/api/v1');
      expect(listUsersUrl).not.toContain('/api/v1/api/v1');
    }

    const hostedConfigs = [
      'https://aotuc-backend.onrender.com',
      'https://aotuc-backend.onrender.com/',
      'https://aotuc-backend.onrender.com/api',
      'https://aotuc-backend.onrender.com/api/v1',
      'https://aotuc-backend.onrender.com/api/v1/',
    ];
    for (const cfg of hostedConfigs) {
      const loginUrl = buildApiUrl('/api/v1/auth/login', cfg);
      const createUsersUrl = buildApiUrl('/api/v1/users', cfg);
      const listUsersUrl = buildApiUrl('/api/v1/users', cfg);

      expect(loginUrl).toBe('https://aotuc-backend.onrender.com/api/v1/auth/login');
      expect(createUsersUrl).toBe('https://aotuc-backend.onrender.com/api/v1/users');
      expect(listUsersUrl).toBe('https://aotuc-backend.onrender.com/api/v1/users');
      expect(loginUrl).not.toContain('/api/v1/api/v1');
      expect(createUsersUrl).not.toContain('/api/v1/api/v1');
      expect(listUsersUrl).not.toContain('/api/v1/api/v1');
    }
  });

  it('8. should also safely normalize accidental duplicate /api/v1/api/v1/auth/login on the backend without 404', async () => {
    const res = await request(app)
      .post('/api/v1/api/v1/auth/login')
      .send({
        identifier: createdEmail,
        password: createdAccountPassword,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.id).toBe(createdAccountId);
  });
});
