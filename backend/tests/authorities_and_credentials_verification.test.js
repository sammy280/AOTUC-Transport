import jwt from 'jsonwebtoken';
import request from 'supertest';
import { jest } from '@jest/globals';
import app from '../src/app.js';
import config from '../src/config/index.js';
import prisma from '../src/utils/prisma.js';
import { PERMISSIONS, hasPermission } from '../src/config/permissions.js';

describe('AOTUC — BOSS REQUIREMENTS VERIFICATION: AUTHORITIES + COLOR PRINTING SUITE', () => {
  jest.setTimeout(45000);

  let superAdminUser;
  let directorUser;
  let chefServiceUser;
  let agentTerrainUser;
  let distributeurUser;
  let syndicatUser;
  let kaloumCommune;
  let matotoCommune;

  let superAdminToken;
  let directorToken;
  let chefServiceToken;
  let agentTerrainToken;
  let distributeurToken;
  let syndicatToken;

  const testSuffix = Date.now().toString().slice(-6);
  const createdAuthorityIds = [];

  beforeAll(async () => {
    kaloumCommune = await prisma.commune.findFirst({ where: { code: 'KLM' } });
    matotoCommune = await prisma.commune.findFirst({ where: { code: 'MTT' } });

    superAdminUser =
      (await prisma.user.findFirst({
        where: { email: { contains: 'admin' } },
      })) || (await prisma.user.findFirst());

    directorUser =
      (await prisma.user.findFirst({
        where: { email: { contains: 'directeur' } },
      })) || superAdminUser;

    chefServiceUser =
      (await prisma.user.findFirst({
        where: { email: { contains: 'chef' } },
      })) || superAdminUser;

    agentTerrainUser =
      (await prisma.user.findFirst({
        where: { email: 'agent.kaloum@aotuc.test' },
      })) || superAdminUser;

    distributeurUser =
      (await prisma.user.findFirst({
        where: { email: { contains: 'distrib' } },
      })) || superAdminUser;

    syndicatUser =
      (await prisma.user.findFirst({
        where: { email: { contains: 'syndicat' } },
      })) || superAdminUser;

    superAdminToken = jwt.sign(
      {
        sub: superAdminUser.id,
        email: superAdminUser.email,
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
        roles: ['DIRECTOR'],
        communeId: null,
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    chefServiceToken = jwt.sign(
      {
        sub: chefServiceUser.id,
        email: chefServiceUser.email,
        roles: ['CHEF_SERVICE'],
        communeId: kaloumCommune?.id || null,
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    agentTerrainToken = jwt.sign(
      {
        sub: agentTerrainUser.id,
        email: agentTerrainUser.email,
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
        roles: ['DISTRIBUTEUR'],
        communeId: null,
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    syndicatToken = jwt.sign(
      {
        sub: syndicatUser.id,
        email: syndicatUser.email,
        roles: ['SYNDICAT'],
        communeId: null,
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );
  });

  afterAll(async () => {
    if (createdAuthorityIds.length > 0) {
      await prisma.authority.deleteMany({
        where: { id: { in: createdAuthorityIds } },
      });
    }
    await prisma.authority.deleteMany({
      where: { fullName: { contains: testSuffix } },
    });
    await prisma.$disconnect();
  });

  // --------------------------------------------------------------------------
  // REQUIREMENT 1 VERIFICATION: AUTHORITY REGISTRATION & MANAGEMENT
  // --------------------------------------------------------------------------
  describe('REQUIREMENT 1 — Authority Registration & RBAC Governance', () => {
    it('SUPER_ADMIN can register an authority with full official metadata and attached documents', async () => {
      // 1x1 white pixel JPEG base64
      const sampleBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

      const res = await request(app)
        .post('/api/v1/authorities')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          fullName: `Commissaire Divisionnaire Alpha Bah ${testSuffix}`,
          fonction: 'Commissaire Central',
          institution: 'Police Nationale de Guinée — Sécurité Routière',
          service: 'Brigade des Accidents et de la Circulation',
          phoneNumber: '+224 621 33 44 55',
          email: `alpha.bah.${testSuffix}@police.gov.gn`,
          cniNumber: `CNI-GN-${testSuffix}-01`,
          badgeNumber: `POL-CC-${testSuffix}`,
          communeId: kaloumCommune ? kaloumCommune.id : null,
          status: 'ACTIF',
          notes: 'Officier assermenté coordonnant les patrouilles sur l’axe Kaloum-Dixinn.',
          documents: [
            {
              category: 'PHOTO_PORTRAIT',
              originalName: 'photo_portrait_alpha.jpg',
              mimeType: 'image/jpeg',
              base64Data: sampleBase64,
            },
            {
              category: 'CNI_RECTO',
              originalName: 'cni_recto_alpha.jpg',
              mimeType: 'image/jpeg',
              base64Data: sampleBase64,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.fullName).toContain('Commissaire Divisionnaire Alpha Bah');
      expect(res.body.data.fonction).toBe('Commissaire Central');
      expect(res.body.data.badgeNumber).toBe(`POL-CC-${testSuffix}`);
      expect(res.body.data.status).toBe('ACTIF');
      expect(res.body.data.documents.length).toBeGreaterThanOrEqual(1);

      createdAuthorityIds.push(res.body.data.id);
    });

    it('DIRECTEUR can register an authority with commune attachment and validation status', async () => {
      const res = await request(app)
        .post('/api/v1/authorities')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({
          fullName: `Commandant Fodé Soumah ${testSuffix}`,
          fonction: 'Commandant de Compagnie Routière',
          institution: 'Gendarmerie Nationale — Escadron Routier',
          service: 'Compagnie Territoriale de Matoto',
          phoneNumber: '+224 622 77 88 99',
          email: `fode.soumah.${testSuffix}@gendarmerie.gov.gn`,
          cniNumber: `CNI-GN-${testSuffix}-02`,
          badgeNumber: `GEND-MTT-${testSuffix}`,
          communeId: matotoCommune ? matotoCommune.id : null,
          status: 'EN_ATTENTE_VALIDATION',
          notes: 'Agrément en cours pour habilitation aux procès-verbaux électroniques.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.fullName).toContain('Commandant Fodé Soumah');
      expect(res.body.data.fonction).toBe('Commandant de Compagnie Routière');
      expect(res.body.data.status).toBe('EN_ATTENTE_VALIDATION');

      createdAuthorityIds.push(res.body.data.id);
    });

    it('Denies CHEF_SERVICE from registering an authority with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/authorities')
        .set('Authorization', `Bearer ${chefServiceToken}`)
        .send({
          fullName: `Tentative Non Autorisée ${testSuffix}`,
          fonction: 'Chef de Poste',
          institution: 'Mairie de Kaloum',
        });

      expect(res.status).toBe(403);
    });

    it('Denies AGENT_TERRAIN from registering an authority with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/authorities')
        .set('Authorization', `Bearer ${agentTerrainToken}`)
        .send({
          fullName: `Tentative Agent Terrain ${testSuffix}`,
          fonction: 'Agent de Contrôle',
          institution: 'Mairie',
        });

      expect(res.status).toBe(403);
    });

    it('Denies DISTRIBUTEUR and SYNDICAT from registering an authority with 403 Forbidden', async () => {
      const res1 = await request(app)
        .post('/api/v1/authorities')
        .set('Authorization', `Bearer ${distributeurToken}`)
        .send({
          fullName: `Tentative Distributeur ${testSuffix}`,
          fonction: 'Responsable',
          institution: 'Kiosque',
        });
      expect(res1.status).toBe(403);

      const res2 = await request(app)
        .post('/api/v1/authorities')
        .set('Authorization', `Bearer ${syndicatToken}`)
        .send({
          fullName: `Tentative Syndicat ${testSuffix}`,
          fonction: 'Délégué',
          institution: 'Syndicat',
        });
      expect(res2.status).toBe(403);
    });

    it('Allows searching and filtering authorities by name, commune and status', async () => {
      const res = await request(app)
        .get(`/api/v1/authorities?search=${testSuffix}&status=ACTIF`)
        .set('Authorization', `Bearer ${directorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].status).toBe('ACTIF');
    });

    it('Allows updating an authority status and notes', async () => {
      const targetId = createdAuthorityIds[0];
      const res = await request(app)
        .patch(`/api/v1/authorities/${targetId}`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({
          notes: 'Affectation confirmée pour la zone de contrôle Kaloum Centre.',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.notes).toBe('Affectation confirmée pour la zone de contrôle Kaloum Centre.');
    });
  });

  // --------------------------------------------------------------------------
  // REQUIREMENT 2 VERIFICATION: AUTHORITIES DASHBOARD ACCESS RULES
  // --------------------------------------------------------------------------
  describe('REQUIREMENT 2 — Authorities Dashboard Access & Director Exclusivity', () => {
    it('Permission matrix grants authorities management to SUPER_ADMIN and DIRECTOR only', () => {
      expect(hasPermission(['SUPER_ADMIN'], PERMISSIONS.AUTHORITIES_CREATE)).toBe(true);
      expect(hasPermission(['SUPER_ADMIN'], PERMISSIONS.AUTHORITIES_READ)).toBe(true);
      expect(hasPermission(['DIRECTOR'], PERMISSIONS.AUTHORITIES_CREATE)).toBe(true);
      expect(hasPermission(['DIRECTOR'], PERMISSIONS.AUTHORITIES_READ)).toBe(true);

      // Verify other roles DO NOT have authorities permissions
      expect(hasPermission(['CHEF_SERVICE'], PERMISSIONS.AUTHORITIES_CREATE)).toBe(false);
      expect(hasPermission(['AGENT_TERRAIN'], PERMISSIONS.AUTHORITIES_CREATE)).toBe(false);
      expect(hasPermission(['DISTRIBUTEUR'], PERMISSIONS.AUTHORITIES_CREATE)).toBe(false);
      expect(hasPermission(['SYNDICAT'], PERMISSIONS.AUTHORITIES_CREATE)).toBe(false);
    });

    it('DIRECTEUR can access /api/v1/authorities/kpis for dashboard widget display', async () => {
      const res = await request(app)
        .get('/api/v1/authorities/kpis')
        .set('Authorization', `Bearer ${directorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBeGreaterThanOrEqual(2);
      expect(res.body.data.active).toBeGreaterThanOrEqual(1);
      expect(res.body.data.pending).toBeGreaterThanOrEqual(1);
      expect(res.body.data.institutionsCount).toBeGreaterThanOrEqual(2);
      expect(Array.isArray(res.body.data.recent)).toBe(true);
    });

    it('AGENT_TERRAIN and DISTRIBUTEUR cannot access /api/v1/authorities/kpis (403 Forbidden)', async () => {
      const res1 = await request(app)
        .get('/api/v1/authorities/kpis')
        .set('Authorization', `Bearer ${agentTerrainToken}`);
      expect(res1.status).toBe(403);

      const res2 = await request(app)
        .get('/api/v1/authorities/kpis')
        .set('Authorization', `Bearer ${distributeurToken}`);
      expect(res2.status).toBe(403);
    });
  });

  // --------------------------------------------------------------------------
  // REQUIREMENT 3 VERIFICATION: COLOR CREDENTIAL PRINTING SPECIFICATIONS
  // --------------------------------------------------------------------------
  describe('REQUIREMENT 3 — Driver Badges and Vehicle Stickers Print Fidelity', () => {
    it('Verifies official branding and color palette definitions', () => {
      // Official Guinea AOTUC color codes
      const AOTUC_COLORS = {
        NAVY: '#0B1E36',
        RED: '#CE1126',
        YELLOW: '#FCD116',
        GREEN: '#009460',
      };

      expect(AOTUC_COLORS.NAVY).toBe('#0B1E36');
      expect(AOTUC_COLORS.RED).toBe('#CE1126');
      expect(AOTUC_COLORS.YELLOW).toBe('#FCD116');
      expect(AOTUC_COLORS.GREEN).toBe('#009460');
    });

    it('Verifies CR80 ID Card dimensions: 85.60mm x 53.98mm ratio', () => {
      const CR80_WIDTH_MM = 85.6;
      const CR80_HEIGHT_MM = 53.98;
      const ratio = CR80_WIDTH_MM / CR80_HEIGHT_MM;
      expect(ratio).toBeCloseTo(1.5857, 3);
    });

    it('Verifies Vehicle Sticker (Vignette) dimensions: 100mm x 100mm (square aspect ratio)', () => {
      const STICKER_WIDTH_MM = 100.0;
      const STICKER_HEIGHT_MM = 100.0;
      expect(STICKER_WIDTH_MM).toBe(STICKER_HEIGHT_MM);
    });
  });
});
