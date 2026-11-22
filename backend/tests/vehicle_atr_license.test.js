import crypto from 'crypto';
import request from 'supertest';
import { jest } from '@jest/globals';
import app from '../src/app.js';
import jwt from 'jsonwebtoken';
import config from '../src/config/index.js';
import prisma from '../src/utils/prisma.js';
import fs from 'fs';

// Valid JPEG binary buffer (starts with FF D8 FF)
const VALID_JPEG_BUFFER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
  0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
  0x00, 0x48, 0x00, 0x00, 0xff, 0xd9,
]);
const VALID_JPEG_BASE64 = VALID_JPEG_BUFFER.toString('base64');

// Valid PNG binary buffer (starts with 89 50 4E 47 0D 0A 1A 0A)
const VALID_PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
  0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);
const VALID_PNG_BASE64 = VALID_PNG_BUFFER.toString('base64');

describe('AOTUC — Vehicle ATR & AOTUC Licence Field Management Suite', () => {
  jest.setTimeout(45000);

  let agentUser;
  let superAdminUser;
  let testOwner;
  let agentToken;
  let superAdminToken;

  const testSuffix = Date.now().toString().slice(-6);
  const createdVehicleIds = [];

  beforeAll(async () => {
    agentUser =
      (await prisma.user.findFirst({
        where: { email: { contains: 'agent' } },
      })) || (await prisma.user.findFirst());

    superAdminUser =
      (await prisma.user.findFirst({
        where: { email: { contains: 'admin' } },
      })) || agentUser;

    agentToken = jwt.sign(
      {
        sub: agentUser.id,
        email: agentUser.email,
        phoneNumber: agentUser.phoneNumber,
        roles: ['AGENT_TERRAIN'],
        permissions: [
          'drivers.create',
          'drivers.read',
          'drivers.update',
          'documents.upload',
          'documents.verify',
          'sync.push',
          'sync.pull',
        ],
        communeId: null,
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '1h' }
    );

    superAdminToken = jwt.sign(
      {
        sub: superAdminUser.id,
        email: superAdminUser.email,
        phoneNumber: superAdminUser.phoneNumber,
        roles: ['SUPER_ADMIN'],
        permissions: [
          'drivers.create',
          'drivers.read',
          'drivers.update',
          'documents.upload',
          'documents.verify',
          'unions.manage',
          'sync.push',
          'sync.pull',
        ],
        communeId: null,
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '1h' }
    );

    // Ensure a test owner exists
    testOwner = await prisma.owner.findFirst({
      include: { person: true },
    });

    if (!testOwner) {
      const p = await prisma.person.create({
        data: {
          firstName: 'Proprio',
          lastName: 'Test',
          nin: `NIN-OWN-${testSuffix}`,
          phoneNumber: `+224628${testSuffix}`,
        },
      });
      testOwner = await prisma.owner.create({
        data: {
          personId: p.id,
          ownerType: 'INDIVIDU',
        },
        include: { person: true },
      });
    }
  });

  afterAll(async () => {
    if (createdVehicleIds.length > 0) {
      for (const vId of createdVehicleIds) {
        try {
          const docs = await prisma.document.findMany({ where: { vehicleId: vId } });
          for (const d of docs) {
            if (fs.existsSync(d.storagePath)) {
              fs.unlinkSync(d.storagePath);
            }
          }
          await prisma.document.deleteMany({ where: { vehicleId: vId } });
          await prisma.validationRequest.deleteMany({ where: { targetEntityId: vId } });
          await prisma.vehicleAssignment.deleteMany({ where: { vehicleId: vId } });
          await prisma.vehicleInspection.deleteMany({ where: { vehicleId: vId } });
          await prisma.vehicle.delete({ where: { id: vId } });
        } catch (_) {}
      }
    }
  });

  test('1. Successfully registers a vehicle with dedicated Numéro ATR and Numéro de licence AOTUC + Documents', async () => {
    const payload = {
      ownerId: testOwner.id,
      plateNumber: `RC-${testSuffix}-A`,
      registrationCardNumber: `CG-2026-${testSuffix}`,
      chassisVin: `VIN${testSuffix}XYZ001`,
      atrNumber: `ATR-GN-2026-${testSuffix}`,
      aotucLicenseNumber: `AOTUC-LIC-2026-${testSuffix}`,
      vehicleType: 'MAGBANA_MINIBUS',
      make: 'Toyota',
      model: 'HiAce',
      year: 2022,
      seatingCapacity: 18,
      documents: [
        {
          category: 'CARTE_GRISE',
          originalName: 'carte_grise.jpg',
          mimeType: 'image/jpeg',
          base64Data: VALID_JPEG_BASE64,
        },
        {
          category: 'PHOTO_VEHICULE_AVANT',
          originalName: 'photo_vehicule.png',
          mimeType: 'image/png',
          base64Data: VALID_PNG_BASE64,
        },
      ],
    };

    const res = await request(app)
      .post('/api/v1/registration/vehicles')
      .set('Authorization', `Bearer ${agentToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();

    const created = res.body.data;
    createdVehicleIds.push(created.id);

    expect(created.plateNumber).toBe(`RC-${testSuffix}-A`);
    expect(created.atrNumber).toBe(`ATR-GN-2026-${testSuffix}`);
    expect(created.aotucLicenseNumber).toBe(`AOTUC-LIC-2026-${testSuffix}`);
    expect(created.atrNumber).not.toBe(created.aotucLicenseNumber);
    expect(created.make).toBe('Toyota');
    expect(created.model).toBe('HiAce');

    // Verify documents returned
    expect(Array.isArray(created.documents)).toBe(true);
    expect(created.documents.length).toBe(2);

    const cgDoc = created.documents.find((d) => d.category === 'CARTE_GRISE');
    const photoDoc = created.documents.find((d) => d.category === 'PHOTO_VEHICULE_AVANT');

    expect(cgDoc).toBeDefined();
    expect(photoDoc).toBeDefined();
  });

  test('2. Confirms Numéro ATR and Numéro de licence AOTUC are persisted in distinct PostgreSQL columns', async () => {
    const vehicleId = createdVehicleIds[0];
    const dbVehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: { documents: true },
    });

    expect(dbVehicle).not.toBeNull();
    // Confirms discrete storage in PostgreSQL
    expect(dbVehicle.atrNumber).toBe(`ATR-GN-2026-${testSuffix}`);
    expect(dbVehicle.aotucLicenseNumber).toBe(`AOTUC-LIC-2026-${testSuffix}`);
    expect(dbVehicle.atrNumber).not.toBe(dbVehicle.aotucLicenseNumber);

    // Verify documents persisted with sha256 in DB
    expect(dbVehicle.documents.length).toBe(2);
    for (const doc of dbVehicle.documents) {
      expect(doc.fileHashSha256).toBeDefined();
      expect(doc.fileHashSha256.length).toBe(64);
      expect(fs.existsSync(doc.storagePath)).toBe(true);
    }
  });

  test('3. Tests identifiers independently (Vehicle with only ATR vs Vehicle with only AOTUC Licence)', async () => {
    const suffixA = `${testSuffix}A`;
    const suffixB = `${testSuffix}B`;

    // Vehicle A: only ATR
    const resA = await request(app)
      .post('/api/v1/registration/vehicles')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({
        ownerId: testOwner.id,
        plateNumber: `RC-${suffixA}`,
        registrationCardNumber: `CG-${suffixA}`,
        chassisVin: `VIN${suffixA}111`,
        atrNumber: `ATR-GN-${suffixA}`,
        // aotucLicenseNumber omitted
        vehicleType: 'TAXI_COLLECTIF',
        make: 'Peugeot',
        model: '406',
      });

    expect(resA.status).toBe(201);
    createdVehicleIds.push(resA.body.data.id);
    expect(resA.body.data.atrNumber).toBe(`ATR-GN-${suffixA}`);
    expect(resA.body.data.aotucLicenseNumber).toBeNull();

    // Vehicle B: only AOTUC licence
    const resB = await request(app)
      .post('/api/v1/registration/vehicles')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({
        ownerId: testOwner.id,
        plateNumber: `RC-${suffixB}`,
        registrationCardNumber: `CG-${suffixB}`,
        chassisVin: `VIN${suffixB}222`,
        // atrNumber omitted
        aotucLicenseNumber: `AOTUC-LIC-${suffixB}`,
        vehicleType: 'BUS_URBAIN',
        make: 'Mercedes',
        model: 'Sprinter',
      });

    expect(resB.status).toBe(201);
    createdVehicleIds.push(resB.body.data.id);
    expect(resB.body.data.atrNumber).toBeNull();
    expect(resB.body.data.aotucLicenseNumber).toBe(`AOTUC-LIC-${suffixB}`);

    // Verify in PostgreSQL
    const dbA = await prisma.vehicle.findUnique({ where: { id: resA.body.data.id } });
    expect(dbA.atrNumber).toBe(`ATR-GN-${suffixA}`);
    expect(dbA.aotucLicenseNumber).toBeNull();

    const dbB = await prisma.vehicle.findUnique({ where: { id: resB.body.data.id } });
    expect(dbB.atrNumber).toBeNull();
    expect(dbB.aotucLicenseNumber).toBe(`AOTUC-LIC-${suffixB}`);
  });

  test('4. Rejects duplicate Numéro ATR and duplicate Numéro de licence AOTUC with distinct error codes', async () => {
    // Attempt duplicate ATR
    const resDupAtr = await request(app)
      .post('/api/v1/registration/vehicles')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({
        ownerId: testOwner.id,
        plateNumber: `RC-${testSuffix}-X1`,
        registrationCardNumber: `CG-${testSuffix}-X1`,
        chassisVin: `VIN${testSuffix}X100`,
        atrNumber: `ATR-GN-2026-${testSuffix}`, // Existing ATR
        vehicleType: 'MAGBANA_MINIBUS',
        make: 'Nissan',
        model: 'Urvan',
      });

    expect(resDupAtr.status).toBe(409);
    expect(resDupAtr.body.code).toBe('VEHICLE_ATR_ALREADY_EXISTS');

    // Attempt duplicate AOTUC License
    const resDupLic = await request(app)
      .post('/api/v1/registration/vehicles')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({
        ownerId: testOwner.id,
        plateNumber: `RC-${testSuffix}-X2`,
        registrationCardNumber: `CG-${testSuffix}-X2`,
        chassisVin: `VIN${testSuffix}X200`,
        aotucLicenseNumber: `AOTUC-LIC-2026-${testSuffix}`, // Existing licence
        vehicleType: 'MAGBANA_MINIBUS',
        make: 'Nissan',
        model: 'Urvan',
      });

    expect(resDupLic.status).toBe(409);
    expect(resDupLic.body.code).toBe('VEHICLE_AOTUC_LICENCE_ALREADY_EXISTS');
  });

  test('5. Searches vehicles by Numéro ATR and by Numéro de licence AOTUC independently', async () => {
    // Search by ATR
    const resAtrSearch = await request(app)
      .get(`/api/v1/registration/vehicles?search=ATR-GN-2026-${testSuffix}`)
      .set('Authorization', `Bearer ${agentToken}`);

    expect(resAtrSearch.status).toBe(200);
    expect(resAtrSearch.body.success).toBe(true);
    expect(resAtrSearch.body.data.items.length).toBeGreaterThanOrEqual(1);
    expect(resAtrSearch.body.data.items[0].atrNumber).toBe(`ATR-GN-2026-${testSuffix}`);

    // Search by AOTUC licence
    const resLicSearch = await request(app)
      .get(`/api/v1/registration/vehicles?search=AOTUC-LIC-2026-${testSuffix}`)
      .set('Authorization', `Bearer ${agentToken}`);

    expect(resLicSearch.status).toBe(200);
    expect(resLicSearch.body.success).toBe(true);
    expect(resLicSearch.body.data.items.length).toBeGreaterThanOrEqual(1);
    expect(resLicSearch.body.data.items[0].aotucLicenseNumber).toBe(`AOTUC-LIC-2026-${testSuffix}`);

    // Duplicate check endpoint
    const resDupCheck = await request(app)
      .get(`/api/v1/registration/check-duplicate?atrNumber=ATR-GN-2026-${testSuffix}`)
      .set('Authorization', `Bearer ${agentToken}`);

    expect(resDupCheck.status).toBe(200);
    expect(resDupCheck.body.data.hasDuplicate).toBe(true);
    expect(resDupCheck.body.data.vehicle.atrNumber).toBe(`ATR-GN-2026-${testSuffix}`);
  });

  test('6. Successfully retrieves vehicle profile with ATR, AOTUC licence, and documents via GET /vehicles/:id', async () => {
    const vehicleId = createdVehicleIds[0];
    const res = await request(app)
      .get(`/api/v1/registration/vehicles/${vehicleId}`)
      .set('Authorization', `Bearer ${agentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(vehicleId);
    expect(res.body.data.atrNumber).toBe(`ATR-GN-2026-${testSuffix}`);
    expect(res.body.data.aotucLicenseNumber).toBe(`AOTUC-LIC-2026-${testSuffix}`);
    expect(res.body.data.owner).toBeDefined();
    expect(res.body.data.documents.length).toBe(2);
  });

  test('7. Successfully processes offline synchronized vehicle draft preserving Numéro ATR and Numéro de licence AOTUC', async () => {
    const offlineSuffix = `OFF${testSuffix}`;
    const clientGeneratedId = crypto.randomUUID();

    const draftItem = {
      clientGeneratedId,
      entityType: 'VEHICLE',
      createdOfflineAt: new Date().toISOString(),
      payload: {
        ownerId: testOwner.id,
        plateNumber: `RC-${offlineSuffix}`,
        registrationCardNumber: `CG-${offlineSuffix}`,
        chassisVin: `VIN${offlineSuffix}999`,
        atrNumber: `ATR-GN-OFF-${offlineSuffix}`,
        aotucLicenseNumber: `AOTUC-LIC-OFF-${offlineSuffix}`,
        vehicleType: 'TAXI_COLLECTIF',
        make: 'Toyota',
        model: 'Corolla',
        year: 2021,
        seatingCapacity: 5,
        documents: [
          {
            category: 'CARTE_GRISE',
            originalName: 'offline_carte_grise.jpg',
            mimeType: 'image/jpeg',
            base64Data: VALID_JPEG_BASE64,
          },
        ],
      },
    };

    const res = await request(app)
      .post('/api/v1/sync/push')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({
        deviceId: 'MOBILE-TABLET-CONAKRY-01',
        items: [draftItem],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accepted).toBe(1);

    const syncItemResult = res.body.data.results.find((r) => r.clientGeneratedId === clientGeneratedId);
    expect(syncItemResult).toBeDefined();
    expect(syncItemResult.status).toBe('SUCCESS');

    const createdServerId = syncItemResult.serverRecordId;
    createdVehicleIds.push(createdServerId);

    // Verify in PostgreSQL
    const dbOfflineVehicle = await prisma.vehicle.findUnique({
      where: { id: createdServerId },
      include: { documents: true },
    });

    expect(dbOfflineVehicle).not.toBeNull();
    expect(dbOfflineVehicle.atrNumber).toBe(`ATR-GN-OFF-${offlineSuffix}`);
    expect(dbOfflineVehicle.aotucLicenseNumber).toBe(`AOTUC-LIC-OFF-${offlineSuffix}`);
    expect(dbOfflineVehicle.documents.length).toBe(1);
    expect(dbOfflineVehicle.documents[0].category).toBe('CARTE_GRISE');
  });
});
