import crypto from 'crypto';
import request from 'supertest';
import { jest } from '@jest/globals';
import app from '../src/app.js';
import jwt from 'jsonwebtoken';
import config from '../src/config/index.js';
import prisma from '../src/utils/prisma.js';

// Valid minimal JPEG buffer (starts with magic bytes FF D8 FF E0)
const VALID_JPEG_BASE64 = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
  0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
  0x00, 0x48, 0x00, 0x00, 0xff, 0xd9,
]).toString('base64');

describe('Phase 1 — Real PostgreSQL Mobile Synchronization & Field Foundations Suite', () => {
  jest.setTimeout(30000);

  let agentUser;
  let matotoCommune;
  let agentToken;
  let syndicatToken;

  const suffix = Date.now().toString().slice(-6);
  const driverClientId = crypto.randomUUID();
  const ownerClientId = crypto.randomUUID();
  const vehicleClientId = crypto.randomUUID();
  const documentClientId = crypto.randomUUID();

  const testDriverNin = `NIN-DRV-${suffix}`;
  const testDriverPhone = `+224621${suffix}`;
  const testDriverLicense = `PC-GN-${suffix}`;

  const testOwnerNin = `NIN-OWN-${suffix}`;
  const testOwnerPhone = `+224622${suffix}`;

  const testPlate = `RC-${suffix.slice(0, 4)}-A`;
  const testCard = `CG-GN-${suffix}`;
  const testVin = `VIN-GN-2026-${suffix}`;

  let createdDriverId = null;
  let createdOwnerId = null;
  let createdVehicleId = null;
  let createdDocId = null;

  beforeAll(async () => {
    jest.setTimeout(30000);

    // Fetch real Matoto commune and real Agent user from PostgreSQL
    matotoCommune = await prisma.commune.findFirst({
      where: { code: 'MTT' },
    });

    agentUser = await prisma.user.findFirst({
      where: { email: 'agent.matoto@aotuc.test' },
    });

    if (!agentUser) {
      agentUser = await prisma.user.findFirst();
    }

    agentToken = jwt.sign(
      {
        sub: agentUser.id,
        email: agentUser.email,
        phoneNumber: agentUser.phoneNumber,
        roles: ['AGENT_TERRAIN'],
        communeId: matotoCommune?.id || null,
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    syndicatToken = jwt.sign(
      {
        sub: agentUser.id,
        roles: ['SYNDICAT'],
        communeId: null,
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );
  });

  afterAll(async () => {
    // Clean up test records created in PostgreSQL during this test run
    try {
      await prisma.auditLog.deleteMany({
        where: {
          targetRecordId: {
            in: [driverClientId, ownerClientId, vehicleClientId, documentClientId],
          },
        },
      });
      if (createdVehicleId) {
        await prisma.validationRequest.deleteMany({ where: { targetEntityId: createdVehicleId } });
      }
      if (createdDriverId) {
        await prisma.validationRequest.deleteMany({ where: { targetEntityId: createdDriverId } });
      }
      if (createdOwnerId) {
        await prisma.validationRequest.deleteMany({ where: { targetEntityId: createdOwnerId } });
      }
      await prisma.document.deleteMany({
        where: {
          OR: [
            { vehicle: { plateNumber: testPlate } },
            { person: { nin: { in: [testDriverNin, testOwnerNin] } } },
          ],
        },
      });
      await prisma.vehicleAssignment.deleteMany({
        where: { vehicle: { plateNumber: testPlate } },
      });
      await prisma.vehicle.deleteMany({
        where: { plateNumber: testPlate },
      });
      await prisma.driver.deleteMany({
        where: { drivingLicenseNumber: testDriverLicense },
      });
      await prisma.owner.deleteMany({
        where: { person: { nin: { in: [testDriverNin, testOwnerNin] } } },
      });
      await prisma.person.deleteMany({
        where: { nin: { in: [testDriverNin, testOwnerNin] } },
      });
    } catch (_) {
      // Ignore cleanup errors
    }
  });

  describe('1. Pull Updates Endpoint (Live PostgreSQL Query)', () => {
    it('should pull publicKeys, revocations, lines, communes and unions from real PostgreSQL', async () => {
      const res = await request(app)
        .get('/api/v1/sync/pull')
        .set('Authorization', `Bearer ${agentToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.publicKeys)).toBe(true);
      expect(res.body.data.publicKeys.length).toBeGreaterThan(0);
      expect(Array.isArray(res.body.data.revocations)).toBe(true);
      expect(Array.isArray(res.body.data.lines)).toBe(true);
      expect(Array.isArray(res.body.data.communes)).toBe(true);
      expect(res.body.data.communes.length).toBeGreaterThanOrEqual(5);
      expect(res.body.data).toHaveProperty('serverTimestamp');
    });

    it('should reject unauthenticated pull request with 401', async () => {
      const res = await request(app).get('/api/v1/sync/pull');
      expect(res.statusCode).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });
  });

  describe('2. Push Batched Offline Records (DRIVER, OWNER, VEHICLE, DOCUMENT, GPS) into Real PostgreSQL', () => {
    it('should persist DRIVER, OWNER, VEHICLE, DOCUMENT and GPS coordinates in PostgreSQL', async () => {
      const res = await request(app)
        .post('/api/v1/sync/push')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          deviceId: 'TABLET-CONAKRY-MATOTO-REAL-01',
          items: [
            {
              clientGeneratedId: driverClientId,
              entityType: 'DRIVER',
              payload: {
                firstName: 'Oumar',
                lastName: 'Barry',
                nin: testDriverNin,
                phoneNumber: testDriverPhone,
                email: `oumar.${suffix}@aotuc.test`,
                address: 'Quartier Sangoyah, Matoto',
                commune: 'Matoto',
                drivingLicenseNumber: testDriverLicense,
                licenseCategory: 'B',
                licenseExpirationDate: '2029-12-31T00:00:00.000Z',
                latitude: 9.5984,
                longitude: -13.6052,
                gpsCapturedAt: '2026-11-17T10:15:00.000Z',
                documents: [
                  {
                    category: 'PHOTO_PORTRAIT',
                    originalName: 'portrait_oumar.jpg',
                    mimeType: 'image/jpeg',
                    base64Data: VALID_JPEG_BASE64,
                  },
                ],
              },
              createdOfflineAt: '2026-11-17T10:15:00.000Z',
            },
            {
              clientGeneratedId: ownerClientId,
              entityType: 'OWNER',
              payload: {
                firstName: 'El Hadj',
                lastName: 'Sow',
                nin: testOwnerNin,
                phoneNumber: testOwnerPhone,
                ownerType: 'ENTREPRISE',
                businessName: `Transports Sow Guinée ${suffix}`,
                taxNumber: `NIF-GN-${suffix}`,
                address: 'Madina Corniche, Matam',
                commune: 'Matoto',
                latitude: 9.5712,
                longitude: -13.6341,
              },
              createdOfflineAt: '2026-11-17T10:20:00.000Z',
            },
            {
              clientGeneratedId: vehicleClientId,
              entityType: 'VEHICLE',
              payload: {
                ownerClientGeneratedId: ownerClientId,
                driverClientGeneratedId: driverClientId,
                plateNumber: testPlate,
                registrationCardNumber: testCard,
                chassisVin: testVin,
                vehicleType: 'MAGBANA_MINIBUS',
                make: 'Toyota',
                model: 'HiAce',
                year: 2021,
                seatingCapacity: 18,
                latitude: 9.6011,
                longitude: -13.6012,
              },
              createdOfflineAt: '2026-11-17T10:25:00.000Z',
            },
          ],
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accepted).toBe(3);
      expect(res.body.data.failed).toBe(0);

      const [drvRes, ownRes, vehRes] = res.body.data.results;
      expect(drvRes.status).toBe('SUCCESS');
      expect(ownRes.status).toBe('SUCCESS');
      expect(vehRes.status).toBe('SUCCESS');

      createdDriverId = drvRes.serverRecordId;
      createdOwnerId = ownRes.serverRecordId;
      createdVehicleId = vehRes.serverRecordId;

      // Verify directly in PostgreSQL that DRIVER + PERSON + GPS + PHOTO exist
      const dbDriver = await prisma.driver.findUnique({
        where: { id: createdDriverId },
        include: { person: { include: { documents: true } } },
      });
      expect(dbDriver).not.toBeNull();
      expect(dbDriver.drivingLicenseNumber).toBe(testDriverLicense);
      expect(dbDriver.person.nin).toBe(testDriverNin);
      expect(dbDriver.person.latitude).toBeCloseTo(9.5984, 4);
      expect(dbDriver.person.longitude).toBeCloseTo(-13.6052, 4);
      expect(dbDriver.person.registeredByUserId).toBe(agentUser.id);
      expect(dbDriver.person.documents.length).toBe(1);
      expect(dbDriver.person.documents[0].category).toBe('PHOTO_PORTRAIT');

      // Verify directly in PostgreSQL that OWNER + PERSON + GPS exist
      const dbOwner = await prisma.owner.findUnique({
        where: { id: createdOwnerId },
        include: { person: true },
      });
      expect(dbOwner).not.toBeNull();
      expect(dbOwner.ownerType).toBe('ENTREPRISE');
      expect(dbOwner.person.nin).toBe(testOwnerNin);
      expect(dbOwner.person.latitude).toBeCloseTo(9.5712, 4);

      // Verify directly in PostgreSQL that VEHICLE + ASSIGNMENT + GPS + VALIDATION REQUEST exist
      const dbVehicle = await prisma.vehicle.findUnique({
        where: { id: createdVehicleId },
        include: { assignments: true },
      });
      expect(dbVehicle).not.toBeNull();
      expect(dbVehicle.plateNumber).toBe(testPlate);
      expect(dbVehicle.ownerId).toBe(createdOwnerId);
      expect(dbVehicle.latitude).toBeCloseTo(9.6011, 4);
      expect(dbVehicle.assignments.length).toBe(1);
      expect(dbVehicle.assignments[0].driverId).toBe(createdDriverId);

      // Verify standalone DOCUMENT sync linked to vehicleId
      const docSyncRes = await request(app)
        .post('/api/v1/sync/push')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          deviceId: 'TABLET-CONAKRY-MATOTO-REAL-01',
          items: [
            {
              clientGeneratedId: documentClientId,
              entityType: 'DOCUMENT',
              payload: {
                category: 'CARTE_GRISE',
                originalName: 'carte_grise_hiace.jpg',
                mimeType: 'image/jpeg',
                base64Data: VALID_JPEG_BASE64,
                vehicleId: createdVehicleId,
              },
              createdOfflineAt: '2026-11-17T10:26:00.000Z',
            },
          ],
        });

      expect(docSyncRes.statusCode).toBe(200);
      expect(docSyncRes.body.data.accepted).toBe(1);
      createdDocId = docSyncRes.body.data.results[0].serverRecordId;

      const dbDoc = await prisma.document.findUnique({ where: { id: createdDocId } });
      expect(dbDoc).not.toBeNull();
      expect(dbDoc.vehicleId).toBe(createdVehicleId);
      expect(dbDoc.category).toBe('CARTE_GRISE');
    });

    it('should guarantee idempotency when the same clientGeneratedIds are pushed again (ALREADY_SYNCED)', async () => {
      const res = await request(app)
        .post('/api/v1/sync/push')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          deviceId: 'TABLET-CONAKRY-MATOTO-REAL-01',
          items: [
            {
              clientGeneratedId: driverClientId,
              entityType: 'DRIVER',
              payload: {
                firstName: 'Oumar',
                lastName: 'Barry',
                nin: testDriverNin,
                phoneNumber: testDriverPhone,
                drivingLicenseNumber: testDriverLicense,
              },
              createdOfflineAt: '2026-11-17T10:15:00.000Z',
            },
            {
              clientGeneratedId: vehicleClientId,
              entityType: 'VEHICLE',
              payload: {
                ownerId: createdOwnerId,
                plateNumber: testPlate,
                registrationCardNumber: testCard,
                chassisVin: testVin,
                vehicleType: 'MAGBANA_MINIBUS',
                make: 'Toyota',
                model: 'HiAce',
              },
              createdOfflineAt: '2026-11-17T10:25:00.000Z',
            },
          ],
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.duplicates).toBe(2);
      expect(res.body.data.results[0].status).toBe('ALREADY_SYNCED');
      expect(res.body.data.results[0].serverRecordId).toBe(createdDriverId);
      expect(res.body.data.results[1].status).toBe('ALREADY_SYNCED');
      expect(res.body.data.results[1].serverRecordId).toBe(createdVehicleId);
    });

    it('should detect conflicts when a different tablet pushes a conflicting license or plate', async () => {
      const conflictClientId = crypto.randomUUID();
      const res = await request(app)
        .post('/api/v1/sync/push')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          deviceId: 'TABLET-CONAKRY-MATOTO-REAL-02',
          items: [
            {
              clientGeneratedId: conflictClientId,
              entityType: 'DRIVER',
              payload: {
                firstName: 'Autre',
                lastName: 'Chauffeur',
                nin: `NIN-OTHER-${suffix}`,
                phoneNumber: `+224629${suffix}`,
                drivingLicenseNumber: testDriverLicense, // Conflicting license number!
              },
              createdOfflineAt: '2026-11-17T11:00:00.000Z',
            },
          ],
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.conflicts).toBe(1);
      expect(res.body.data.results[0].status).toBe('CONFLICT');
      expect(res.body.data.results[0].conflictCode).toBe('LICENSE_BELONGS_TO_OTHER_PERSON');
    });

    it('should forbid unauthorized roles (SYNDICAT) from pushing sync records (403)', async () => {
      const res = await request(app)
        .post('/api/v1/sync/push')
        .set('Authorization', `Bearer ${syndicatToken}`)
        .send({
          deviceId: 'TABLET-UNAUTHORIZED',
          items: [
            {
              clientGeneratedId: crypto.randomUUID(),
              entityType: 'DRIVER',
              payload: { firstName: 'Test', lastName: 'User' },
              createdOfflineAt: new Date().toISOString(),
            },
          ],
        });

      expect(res.statusCode).toBe(403);
    });

    it('should reject corrupted documents with mismatched SHA-256 hash (DOCUMENT_INTEGRITY_MISMATCH) without creating partial records', async () => {
      const badDocClientId = crypto.randomUUID();
      const res = await request(app)
        .post('/api/v1/sync/push')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          deviceId: 'TABLET-CONAKRY-MATOTO-REAL-01',
          items: [
            {
              clientGeneratedId: badDocClientId,
              entityType: 'DOCUMENT',
              payload: {
                category: 'CNI_RECTO',
                originalName: 'corrupted_cni.jpg',
                mimeType: 'image/jpeg',
                base64Data: VALID_JPEG_BASE64,
                fileHashSha256: '0000000000000000000000000000000000000000000000000000000000000000',
                vehicleId: createdVehicleId,
              },
              createdOfflineAt: new Date().toISOString(),
            },
          ],
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.failed).toBe(1);
      expect(res.body.data.results[0].status).toBe('ERROR');
      expect(res.body.data.results[0].errorCode).toBe('DOCUMENT_INTEGRITY_MISMATCH');
    });

    it('should detect phone-to-NIN and vehicle plate conflicts without overwriting existing server records', async () => {
      const phoneConflictId = crypto.randomUUID();
      const plateConflictId = crypto.randomUUID();

      const res = await request(app)
        .post('/api/v1/sync/push')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          deviceId: 'TABLET-CONAKRY-MATOTO-REAL-02',
          items: [
            {
              clientGeneratedId: phoneConflictId,
              entityType: 'DRIVER',
              payload: {
                firstName: 'Conflit',
                lastName: 'Telephone',
                nin: `NIN-DIFF-${suffix}`,
                phoneNumber: testDriverPhone, // Already belongs to testDriverNin!
                drivingLicenseNumber: `PC-DIFF-${suffix}`,
              },
              createdOfflineAt: new Date().toISOString(),
            },
            {
              clientGeneratedId: plateConflictId,
              entityType: 'VEHICLE',
              payload: {
                ownerId: createdOwnerId,
                plateNumber: testPlate, // Already registered!
                registrationCardNumber: `CG-NEW-${suffix}`,
                chassisVin: `VIN-NEW-2026-${suffix}`,
                vehicleType: 'TAXI_COLLECTIF',
                make: 'Peugeot',
                model: '406',
              },
              createdOfflineAt: new Date().toISOString(),
            },
          ],
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.conflicts).toBe(2);
      expect(res.body.data.results[0].status).toBe('CONFLICT');
      expect(res.body.data.results[0].conflictCode).toBe('PHONE_BELONGS_TO_OTHER_NIN');
      expect(res.body.data.results[1].status).toBe('CONFLICT');
      expect(res.body.data.results[1].conflictCode).toBe('PLATE_ALREADY_REGISTERED');

      // Verify original vehicle in PostgreSQL was NEVER overwritten
      const dbVehicle = await prisma.vehicle.findUnique({ where: { id: createdVehicleId } });
      expect(dbVehicle.make).toBe('Toyota');
      expect(dbVehicle.model).toBe('HiAce');
    });

    test('should persist UNION (Syndicat) with fonction, cniNumber, photoUrl, and inline documents into real PostgreSQL', async () => {
      const unionClientId = crypto.randomUUID();
      const testUnionCode = `UN-${suffix}`;
      const testUnionName = `Union Syndicale de Test ${suffix}`;

      const res = await request(app)
        .post('/api/v1/sync/push')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          deviceId: 'TABLET-CONAKRY-MATOTO-REAL-01',
          items: [
            {
              clientGeneratedId: unionClientId,
              entityType: 'UNION',
              payload: {
                code: testUnionCode,
                name: testUnionName,
                registrationNumber: `AGR-${suffix}`,
                presidentName: 'Mamadouba Camara',
                fonction: 'Secrétaire général',
                cniNumber: `CNI-UNION-${suffix}`,
                contactPhone: `+224628${suffix}`,
                contactEmail: `contact.${suffix}@syndicat.test`,
                commune: 'Matoto',
                latitude: 9.5800,
                longitude: -13.6100,
                documents: [
                  {
                    category: 'PHOTO_PORTRAIT',
                    originalName: 'portrait.jpg',
                    mimeType: 'image/jpeg',
                    base64Data: VALID_JPEG_BASE64,
                  },
                  {
                    category: 'CNI_RECTO',
                    originalName: 'cni_recto.jpg',
                    mimeType: 'image/jpeg',
                    base64Data: VALID_JPEG_BASE64,
                  },
                ],
              },
              createdOfflineAt: new Date().toISOString(),
            },
          ],
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.results[0].status).toBe('SUCCESS');
      const serverUnionId = res.body.data.results[0].serverRecordId;

      // Verify directly in real PostgreSQL
      const dbUnion = await prisma.transportUnion.findUnique({
        where: { id: serverUnionId },
        include: { documents: true },
      });

      expect(dbUnion).not.toBeNull();
      expect(dbUnion.code).toBe(testUnionCode);
      expect(dbUnion.name).toBe(testUnionName);
      expect(dbUnion.fonction).toBe('Secrétaire général');
      expect(dbUnion.cniNumber).toBe(`CNI-UNION-${suffix}`);
      expect(dbUnion.photoUrl).toContain('/api/v1/documents/');
      expect(dbUnion.documents.length).toBe(2);

      // Clean up the created test union
      await prisma.document.deleteMany({ where: { unionId: serverUnionId } });
      await prisma.auditLog.deleteMany({ where: { targetRecordId: unionClientId } });
      await prisma.transportUnion.delete({ where: { id: serverUnionId } });
    });
  });
});
