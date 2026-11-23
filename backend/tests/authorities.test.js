import jwt from 'jsonwebtoken';
import request from 'supertest';
import { jest } from '@jest/globals';
import app from '../src/app.js';
import config from '../src/config/index.js';
import prisma from '../src/utils/prisma.js';

describe('AOTUC Administrative Authorities Management & Role Access Test Suite', () => {
  jest.setTimeout(35000);

  let superAdminUser;
  let directorUser;
  let agentTerrainUser;
  let distributeurUser;
  let kaloumCommune;

  let superAdminToken;
  let directorToken;
  let agentTerrainToken;
  let distributeurToken;

  const testSuffix = Date.now().toString().slice(-6);
  let createdAuthorityId = null;

  beforeAll(async () => {
    kaloumCommune = await prisma.commune.findFirst({ where: { code: 'KLM' } });

    superAdminUser =
      (await prisma.user.findFirst({
        where: { email: { contains: 'admin' } },
      })) || (await prisma.user.findFirst());

    directorUser =
      (await prisma.user.findFirst({
        where: { email: { contains: 'directeur' } },
      })) || superAdminUser;

    agentTerrainUser =
      (await prisma.user.findFirst({
        where: { email: 'agent.kaloum@aotuc.test' },
      })) || superAdminUser;

    distributeurUser =
      (await prisma.user.findFirst({
        where: { email: { contains: 'distrib' } },
      })) || superAdminUser;

    superAdminToken = jwt.sign(
      {
        sub: superAdminUser.id,
        email: superAdminUser.email,
        phoneNumber: superAdminUser.phoneNumber,
        roles: ['SUPER_ADMIN'],
        communeId: null,
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    directorToken = jwt.sign(
      {
        sub: directorUser.id,
        email: directorUser.email,
        phoneNumber: directorUser.phoneNumber,
        roles: ['DIRECTOR'],
        communeId: null,
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    agentTerrainToken = jwt.sign(
      {
        sub: agentTerrainUser.id,
        email: agentTerrainUser.email,
        phoneNumber: agentTerrainUser.phoneNumber,
        roles: ['AGENT_TERRAIN'],
        communeId: kaloumCommune?.id || null,
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    distributeurToken = jwt.sign(
      {
        sub: distributeurUser.id,
        email: distributeurUser.email,
        phoneNumber: distributeurUser.phoneNumber,
        roles: ['DISTRIBUTEUR'],
        communeId: null,
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );
  });

  afterAll(async () => {
    if (createdAuthorityId) {
      await prisma.authority.deleteMany({
        where: { id: createdAuthorityId },
      });
    }
    // Clean up any other test authorities created with testSuffix
    await prisma.authority.deleteMany({
      where: { fullName: { contains: testSuffix } },
    });
    await prisma.$disconnect();
  });

  describe('1. Role Authorization & Least Privilege Enforcing', () => {
    it('Denies unauthenticated access to authorities endpoint with 401', async () => {
      const res = await request(app).get('/api/v1/authorities');
      expect(res.status).toBe(401);
    });

    it('Denies AGENT_TERRAIN role from listing authorities with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/authorities')
        .set('Authorization', `Bearer ${agentTerrainToken}`);
      expect(res.status).toBe(403);
    });

    it('Denies DISTRIBUTEUR role from creating authorities with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/authorities')
        .set('Authorization', `Bearer ${distributeurToken}`)
        .send({
          fullName: `Commandant Test ${testSuffix}`,
          fonction: 'Commandant',
          institution: 'Police Routière',
        });
      expect(res.status).toBe(403);
    });
  });

  describe('2. Registration by SUPER_ADMIN and DIRECTEUR', () => {
    it('Allows SUPER_ADMIN to register a new authority', async () => {
      const payload = {
        fullName: `Général Ibrahima Diallo ${testSuffix}`,
        fonction: 'Directeur National de la Sécurité Routière',
        institution: 'Police Nationale de Guinée',
        service: 'Direction de la Circulation et Régulation',
        phoneNumber: '+224 621 11 22 33',
        email: `diallo.${testSuffix}@police.gov.gn`,
        cniNumber: `CNI-GN-${testSuffix}`,
        badgeNumber: `POL-DNSR-${testSuffix}`,
        communeId: kaloumCommune ? kaloumCommune.id : null,
        status: 'ACTIF',
        notes: 'Enregistré pour protocole de contrôle routier interurbain',
      };

      const res = await request(app)
        .post('/api/v1/authorities')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.fullName).toBe(payload.fullName);
      expect(res.body.data.institution).toBe(payload.institution);
      expect(res.body.data.fonction).toBe(payload.fonction);
      expect(res.body.data.badgeNumber).toBe(payload.badgeNumber);

      createdAuthorityId = res.body.data.id;
    });

    it('Allows DIRECTEUR to register a new authority', async () => {
      const payload = {
        fullName: `Maire Ousmane Camara ${testSuffix}`,
        fonction: 'Maire de la Commune',
        institution: 'Mairie de Kaloum',
        service: 'Cabinet du Maire',
        phoneNumber: '+224 622 44 55 66',
        email: `maire.kaloum.${testSuffix}@conakry.gov.gn`,
        cniNumber: `CNI-MK-${testSuffix}`,
        badgeNumber: `ADM-KLM-${testSuffix}`,
        communeId: kaloumCommune ? kaloumCommune.id : null,
        status: 'ACTIF',
      };

      const res = await request(app)
        .post('/api/v1/authorities')
        .set('Authorization', `Bearer ${directorToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.fullName).toBe(payload.fullName);
      expect(res.body.data.institution).toBe('Mairie de Kaloum');

      // Cleanup this second authority
      if (res.body.data.id) {
        await prisma.authority.delete({ where: { id: res.body.data.id } });
      }
    });

    it('Rejects invalid registration data with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/v1/authorities')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          fullName: 'A', // too short
          // missing fonction and institution
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('3. Listing, Search, Details and KPIs', () => {
    it('Allows SUPER_ADMIN and DIRECTOR to list authorities', async () => {
      const res = await request(app)
        .get('/api/v1/authorities')
        .set('Authorization', `Bearer ${directorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toBeDefined();
    });

    it('Supports search filtering by name or institution', async () => {
      const res = await request(app)
        .get(`/api/v1/authorities?search=${testSuffix}`)
        .set('Authorization', `Bearer ${directorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].id).toBe(createdAuthorityId);
    });

    it('Retrieves authority details by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/authorities/${createdAuthorityId}`)
        .set('Authorization', `Bearer ${directorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(createdAuthorityId);
      expect(res.body.data.registeredByUser).toBeDefined();
      if (kaloumCommune) {
        expect(res.body.data.commune).toBeDefined();
        expect(res.body.data.commune.name).toBe('Kaloum');
      }
    });

    it('Provides Director dashboard KPIs endpoint', async () => {
      const res = await request(app)
        .get('/api/v1/authorities/kpis')
        .set('Authorization', `Bearer ${directorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBeGreaterThanOrEqual(1);
      expect(res.body.data.active).toBeGreaterThanOrEqual(1);
      expect(res.body.data.institutionsCount).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(res.body.data.recent)).toBe(true);
    });
  });

  describe('4. Update and Delete Authorities', () => {
    it('Allows updating authority status and information', async () => {
      const res = await request(app)
        .put(`/api/v1/authorities/${createdAuthorityId}`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({
          status: 'SUSPENDU',
          notes: 'Mise à jour suite à affectation de service.',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('SUSPENDU');
      expect(res.body.data.notes).toBe('Mise à jour suite à affectation de service.');
    });

    it('Allows deleting an authority', async () => {
      const res = await request(app)
        .delete(`/api/v1/authorities/${createdAuthorityId}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const check = await prisma.authority.findUnique({
        where: { id: createdAuthorityId },
      });
      expect(check).toBeNull();
      createdAuthorityId = null;
    });
  });
});
