import jwt from 'jsonwebtoken';
import request from 'supertest';
import crypto from 'crypto';
import { jest } from '@jest/globals';
import app from '../src/app.js';
import config from '../src/config/index.js';
import prisma from '../src/utils/prisma.js';

describe('AOTUC Transport Unions / Syndicats Management & Affiliation Suite', () => {
  jest.setTimeout(35000);

  let superAdminUser;
  let agentTerrainUser;
  let distributeurUser;
  let kaloumCommune;

  let superAdminToken;
  let agentTerrainToken;
  let distributeurToken;

  const testSuffix = Date.now().toString().slice(-6);
  let createdUnionId = null;
  let createdDriverId = null;
  let createdOwnerId = null;

  beforeAll(async () => {
    kaloumCommune = await prisma.commune.findFirst({ where: { code: 'KLM' } });

    superAdminUser =
      (await prisma.user.findFirst({
        where: { email: { contains: 'admin' } },
      })) || (await prisma.user.findFirst());

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

    agentTerrainToken = jwt.sign(
      {
        sub: agentTerrainUser.id,
        email: agentTerrainUser.email,
        phoneNumber: agentTerrainUser.phoneNumber,
        roles: ['AGENT_TERRAIN'],
        communeId: kaloumCommune?.id,
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
    // Clean up created test entities in safe reverse order without touching other DB records
    if (createdDriverId) {
      await prisma.driver.delete({ where: { id: createdDriverId } }).catch(() => {});
    }
    if (createdOwnerId) {
      await prisma.owner.delete({ where: { id: createdOwnerId } }).catch(() => {});
    }
    if (createdUnionId) {
      await prisma.auditLog.deleteMany({ where: { targetRecordId: createdUnionId } }).catch(() => {});
      await prisma.transportUnion.delete({ where: { id: createdUnionId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  // ---------------------------------------------------------------------------
  // 1. RBAC & UNAUTHORIZED ACCESS PREVENTION
  // ---------------------------------------------------------------------------
  test('Scenario 1: Unauthorized roles (DISTRIBUTEUR, AGENT_TERRAIN) receive 403 Forbidden on union registration', async () => {
    const payload = {
      name: `Syndicat Non Autorisé ${testSuffix}`,
      code: `SNA${testSuffix.slice(0, 3)}`,
    };

    // Agent de terrain cannot manage unions
    const resAgent = await request(app)
      .post('/api/v1/unions')
      .set('Authorization', `Bearer ${agentTerrainToken}`)
      .send(payload);
    expect(resAgent.status).toBe(403);

    // Distributeur cannot manage unions
    const resDistrib = await request(app)
      .post('/api/v1/unions')
      .set('Authorization', `Bearer ${distributeurToken}`)
      .send(payload);
    expect(resDistrib.status).toBe(403);
  });

  // ---------------------------------------------------------------------------
  // 2. SUPER_ADMIN UNION REGISTRATION & POSTGRESQL PERSISTENCE
  // ---------------------------------------------------------------------------
  test('Scenario 2: SUPER_ADMIN successfully registers a new transport union with official fields', async () => {
    const unionPayload = {
      name: `Fédération Nationale des Transports de Guinée ${testSuffix}`,
      code: `FNTG${testSuffix.slice(0, 3)}`,
      registrationNumber: `AGR-2026-FNTG-${testSuffix}`,
      presidentName: 'Elhadj Ousmane Horoya',
      contactPhone: '+224 622 11 22 33',
      contactEmail: `contact.fntg.${testSuffix}@aotuc.test`,
      headquartersAddress: 'Immeuble Syndical, Madina Marché, Conakry',
      communeId: kaloumCommune?.id || null,
      status: 'ACTIF',
    };

    const res = await request(app)
      .post('/api/v1/unions')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send(unionPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.code).toBe(unionPayload.code.toUpperCase());
    expect(res.body.data.name).toBe(unionPayload.name);
    expect(res.body.data.status).toBe('ACTIF');

    createdUnionId = res.body.data.id;

    // Verify ACTUAL PostgreSQL persistence and retrieval
    const dbRecord = await prisma.transportUnion.findUnique({
      where: { id: createdUnionId },
      include: { commune: true },
    });

    expect(dbRecord).not.toBeNull();
    expect(dbRecord.id).toBe(createdUnionId);
    expect(dbRecord.name).toBe(unionPayload.name);
    expect(dbRecord.code).toBe(unionPayload.code.toUpperCase());
    expect(dbRecord.registrationNumber).toBe(unionPayload.registrationNumber);
    expect(dbRecord.presidentName).toBe(unionPayload.presidentName);
    expect(dbRecord.status).toBe('ACTIF');
    expect(dbRecord.registeredByUserId).toBe(superAdminUser.id);
  });

  // ---------------------------------------------------------------------------
  // 3. DUPLICATE PREVENTION CHECKS
  // ---------------------------------------------------------------------------
  test('Scenario 3: Duplicate union registration is strictly rejected (name, code, registration number)', async () => {
    // 3a. Duplicate Name
    const dupNameRes = await request(app)
      .post('/api/v1/unions')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        name: `Fédération Nationale des Transports de Guinée ${testSuffix}`,
        code: `DIFF${testSuffix.slice(0, 3)}`,
        registrationNumber: `AGR-DIFF-${testSuffix}`,
      });
    expect(dupNameRes.status).toBe(409);
    expect(dupNameRes.body.code).toBe('DUPLICATE_UNION_NAME');

    // 3b. Duplicate Code
    const dupCodeRes = await request(app)
      .post('/api/v1/unions')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        name: `Autre Nom Syndicat ${testSuffix}`,
        code: `FNTG${testSuffix.slice(0, 3)}`,
        registrationNumber: `AGR-DIFF2-${testSuffix}`,
      });
    expect(dupCodeRes.status).toBe(409);
    expect(dupCodeRes.body.code).toBe('DUPLICATE_UNION_CODE');

    // 3c. Duplicate Registration Number
    const dupRegRes = await request(app)
      .post('/api/v1/unions')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        name: `Troisième Nom Syndicat ${testSuffix}`,
        code: `TRD${testSuffix.slice(0, 3)}`,
        registrationNumber: `AGR-2026-FNTG-${testSuffix}`,
      });
    expect(dupRegRes.status).toBe(409);
    expect(dupRegRes.body.code).toBe('DUPLICATE_UNION_REGISTRATION_NUMBER');
  });

  // ---------------------------------------------------------------------------
  // 4. UNION LISTING & DETAILS RETRIEVAL
  // ---------------------------------------------------------------------------
  test('Scenario 4: Union appears in listing and details endpoints with affiliation counts', async () => {
    // 4a. Listing
    const listRes = await request(app)
      .get(`/api/v1/unions?search=${testSuffix}`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(Array.isArray(listRes.body.items)).toBe(true);
    const found = listRes.body.items.find((u) => u.id === createdUnionId);
    expect(found).toBeDefined();
    expect(found.code).toBe(`FNTG${testSuffix.slice(0, 3)}`);

    // 4b. Single Details
    const detailRes = await request(app)
      .get(`/api/v1/unions/${createdUnionId}`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.success).toBe(true);
    expect(detailRes.body.data.id).toBe(createdUnionId);
    expect(detailRes.body.data._count).toBeDefined();
    expect(detailRes.body.data.members).toBeDefined();
    expect(detailRes.body.data.owners).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // 5. UNION INFORMATION EDITING & POSTGRESQL PERSISTENCE
  // ---------------------------------------------------------------------------
  test('Scenario 5: SUPER_ADMIN can edit union information and changes persist in PostgreSQL', async () => {
    const updatePayload = {
      presidentName: 'Elhadj Ousmane Horoya Modifié',
      contactPhone: '+224 620 99 88 77',
      headquartersAddress: 'Nouveau Siège Central, Kaloum, Conakry',
    };

    const res = await request(app)
      .put(`/api/v1/unions/${createdUnionId}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send(updatePayload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.presidentName).toBe(updatePayload.presidentName);
    expect(res.body.data.headquartersAddress).toBe(updatePayload.headquartersAddress);

    // Verify in PostgreSQL
    const freshDb = await prisma.transportUnion.findUnique({
      where: { id: createdUnionId },
    });
    expect(freshDb.presidentName).toBe(updatePayload.presidentName);
    expect(freshDb.headquartersAddress).toBe(updatePayload.headquartersAddress);
    expect(freshDb.contactPhone).toBe('+224620998877');
  });

  // ---------------------------------------------------------------------------
  // 6. STATUS MANAGEMENT (ACTIVATE, SUSPEND, REJECT) & AUDIT LOGGING
  // ---------------------------------------------------------------------------
  test('Scenario 6: SUPER_ADMIN can change union status to SUSPENDU with audit log, then reactivate', async () => {
    // 6a. Suspend
    const suspendRes = await request(app)
      .patch(`/api/v1/unions/${createdUnionId}/status`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        status: 'SUSPENDU',
        reason: 'Contrôle réglementaire conservatoire AOTUC',
      });

    expect(suspendRes.status).toBe(200);
    expect(suspendRes.body.success).toBe(true);
    expect(suspendRes.body.data.status).toBe('SUSPENDU');

    // Verify in PostgreSQL
    const suspendedDb = await prisma.transportUnion.findUnique({
      where: { id: createdUnionId },
    });
    expect(suspendedDb.status).toBe('SUSPENDU');

    // Verify Audit Log entry
    const auditEntry = await prisma.auditLog.findFirst({
      where: {
        targetRecordId: createdUnionId,
        action: 'UNION_STATUS_CHANGED',
      },
      orderBy: { timestamp: 'desc' },
    });
    expect(auditEntry).not.toBeNull();
    expect(auditEntry.action).toBe('UNION_STATUS_CHANGED');
    expect(auditEntry.targetModule).toBe('UNIONS');

    // 6b. Reactivate to ACTIF
    const activateRes = await request(app)
      .patch(`/api/v1/unions/${createdUnionId}/status`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        status: 'ACTIF',
        reason: 'Levée de suspension après mise en conformité des pièces',
      });

    expect(activateRes.status).toBe(200);
    expect(activateRes.body.data.status).toBe('ACTIF');

    const activeDb = await prisma.transportUnion.findUnique({
      where: { id: createdUnionId },
    });
    expect(activeDb.status).toBe('ACTIF');
  });

  // ---------------------------------------------------------------------------
  // 7. DRIVER & OWNER REGISTRATION WITH UNION AFFILIATION
  // ---------------------------------------------------------------------------
  test('Scenario 7: Driver & Owner can be registered with unionId, persisting relationship in PostgreSQL', async () => {
    // 7a. Register Driver linked to createdUnionId
    const driverPayload = {
      firstName: 'Amara',
      lastName: `Sylla ${testSuffix}`,
      nin: `NIN-DRV-${testSuffix}`,
      phoneNumber: `+224 621 ${testSuffix.slice(0, 2)} ${testSuffix.slice(2, 4)} ${testSuffix.slice(4, 6)}`,
      drivingLicenseNumber: `DL-GN-${testSuffix}`,
      licenseCategory: 'B',
      licenseExpirationDate: '2029-12-31',
      emergencyContactPhone: '+224 628 00 11 22',
      emergencyContactName: 'M’Balia Sylla',
      emergencyContactRelation: 'Épouse',
      commune: 'Kaloum',
      unionId: createdUnionId,
    };

    const driverRes = await request(app)
      .post('/api/v1/registration/drivers')
      .set('Authorization', `Bearer ${agentTerrainToken}`)
      .send(driverPayload);

    expect(driverRes.status).toBe(201);
    expect(driverRes.body.success).toBe(true);
    expect(driverRes.body.data.unionId).toBe(createdUnionId);
    expect(driverRes.body.data.union).toBeDefined();
    expect(driverRes.body.data.union.id).toBe(createdUnionId);

    createdDriverId = driverRes.body.data.id;

    // Verify in PostgreSQL directly
    const dbDriver = await prisma.driver.findUnique({
      where: { id: createdDriverId },
      include: { union: true, person: true },
    });
    expect(dbDriver).not.toBeNull();
    expect(dbDriver.unionId).toBe(createdUnionId);
    expect(dbDriver.union.name).toContain('Fédération Nationale');

    // 7b. Register Owner linked to createdUnionId
    const ownerPayload = {
      firstName: 'Ibrahima',
      lastName: `Sow ${testSuffix}`,
      nin: `NIN-OWN-${testSuffix}`,
      phoneNumber: `+224 623 ${testSuffix.slice(0, 2)} ${testSuffix.slice(2, 4)} ${testSuffix.slice(4, 6)}`,
      ownerType: 'INDIVIDU',
      commune: 'Kaloum',
      unionId: createdUnionId,
    };

    const ownerRes = await request(app)
      .post('/api/v1/registration/owners')
      .set('Authorization', `Bearer ${agentTerrainToken}`)
      .send(ownerPayload);

    expect(ownerRes.status).toBe(201);
    expect(ownerRes.body.success).toBe(true);
    expect(ownerRes.body.data.unionId).toBe(createdUnionId);

    createdOwnerId = ownerRes.body.data.id;

    // Verify in PostgreSQL directly
    const dbOwner = await prisma.owner.findUnique({
      where: { id: createdOwnerId },
      include: { union: true, person: true },
    });
    expect(dbOwner).not.toBeNull();
    expect(dbOwner.unionId).toBe(createdUnionId);

    // 7c. Verify Union details now displays this member driver and owner
    const unionWithMembers = await prisma.transportUnion.findUnique({
      where: { id: createdUnionId },
      include: {
        _count: { select: { members: true, owners: true } },
        members: true,
        owners: true,
      },
    });
    expect(unionWithMembers._count.members).toBeGreaterThanOrEqual(1);
    expect(unionWithMembers._count.owners).toBeGreaterThanOrEqual(1);
  });

  // ---------------------------------------------------------------------------
  // 8. MOBILE SYNC INTEGRATION (PULL & PUSH RESOLUTION)
  // ---------------------------------------------------------------------------
  test('Scenario 8: Mobile sync /sync/pull retrieves active unions, and /sync/push correctly resolves offline drafts with unionId', async () => {
    // 8a. Pull reference data
    const pullRes = await request(app)
      .get('/api/v1/sync/pull')
      .set('Authorization', `Bearer ${agentTerrainToken}`);

    expect(pullRes.status).toBe(200);
    expect(pullRes.body.success).toBe(true);
    expect(Array.isArray(pullRes.body.data.unions)).toBe(true);

    const pulledUnion = pullRes.body.data.unions.find((u) => u.id === createdUnionId);
    expect(pulledUnion).toBeDefined();
    expect(pulledUnion.code).toBe(`FNTG${testSuffix.slice(0, 3)}`);
    expect(pulledUnion.status).toBe('ACTIF');

    // 8b. Push batched offline draft with unionId
    const clientDriverId = crypto.randomUUID();
    const pushPayload = {
      deviceId: 'TEST-DEV-SYNDICAT-001',
      items: [
        {
          clientGeneratedId: clientDriverId,
          entityType: 'DRIVER',
          payload: {
            firstName: 'Moussa',
            lastName: `Conde ${testSuffix}`,
            nin: `NIN-SYNC-${testSuffix}`,
            phoneNumber: `+224 625 ${testSuffix.slice(0, 2)} ${testSuffix.slice(2, 4)} ${testSuffix.slice(4, 6)}`,
            drivingLicenseNumber: `DL-SYNC-${testSuffix}`,
            licenseCategory: 'B',
            licenseExpirationDate: '2029-12-31',
            emergencyContactPhone: '+224 629 88 77 66',
            emergencyContactName: 'Fanta Conde',
            emergencyContactRelation: 'Soeur',
            commune: 'Kaloum',
            communeId: kaloumCommune?.id,
            unionId: createdUnionId,
          },
          createdOfflineAt: new Date().toISOString(),
        },
      ],
    };

    const pushRes = await request(app)
      .post('/api/v1/sync/push')
      .set('Authorization', `Bearer ${agentTerrainToken}`)
      .send(pushPayload);

    expect(pushRes.status).toBe(200);
    expect(pushRes.body.success).toBe(true);
    expect(pushRes.body.data.accepted).toBe(1);

    // Verify driver was created in PostgreSQL with unionId correctly bound
    const syncDbDriver = await prisma.driver.findFirst({
      where: { drivingLicenseNumber: `DL-SYNC-${testSuffix}` },
      include: { union: true },
    });
    expect(syncDbDriver).not.toBeNull();
    expect(syncDbDriver.unionId).toBe(createdUnionId);

    // Cleanup sync test driver
    await prisma.driver.delete({ where: { id: syncDbDriver.id } }).catch(() => {});
  });
});
