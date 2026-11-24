import crypto from 'crypto';
import request from 'supertest';
import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import config from '../src/config/index.js';
import prisma from '../src/utils/prisma.js';

// Valid minimal JPEG buffer (starts with magic bytes FF D8 FF E0)
const VALID_JPEG_BASE64 = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
  0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
  0x00, 0x48, 0x00, 0x00, 0xff, 0xd9,
]).toString('base64');

describe('AOTUC Web-Admin Offline Enrollment & Synchronization Suite', () => {
  jest.setTimeout(45000);

  let agentUser;
  let chefServiceUser;
  let directorUser;
  let superAdminUser;
  let testCommune;

  let agentToken;
  let chefToken;
  let directorToken;
  let superAdminToken;
  let unauthorizedDistributorToken;

  const testSuffix = Date.now().toString().slice(-6);

  beforeAll(async () => {
    testCommune = await prisma.commune.findFirst({
      where: { code: 'MTT' },
    });
    if (!testCommune) {
      testCommune = await prisma.commune.findFirst();
    }

    const testUsers = await prisma.user.findMany({ take: 10 });
    agentUser = testUsers[0];
    chefServiceUser = testUsers[1] || testUsers[0];
    directorUser = testUsers[2] || testUsers[0];
    superAdminUser = testUsers[3] || testUsers[0];

    agentToken = jwt.sign(
      {
        sub: agentUser.id,
        email: agentUser.email,
        roles: ['AGENT_TERRAIN'],
        communeId: testCommune?.id || null,
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    chefToken = jwt.sign(
      {
        sub: chefServiceUser.id,
        email: chefServiceUser.email,
        roles: ['CHEF_SERVICE'],
        communeId: testCommune?.id || null,
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

    unauthorizedDistributorToken = jwt.sign(
      {
        sub: agentUser.id,
        roles: ['DISTRIBUTEUR'],
        communeId: null,
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );
  });

  describe('1. Role & Access Compatibility for Web-Admin Sync Push', () => {
    it('allows AGENT_TERRAIN to push offline drafts', async () => {
      const res = await request(app)
        .post('/api/v1/sync/push')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          deviceId: `web-test-${testSuffix}`,
          items: [
            {
              clientGeneratedId: crypto.randomUUID(),
              entityType: 'DRIVER',
              createdOfflineAt: new Date().toISOString(),
              payload: {
                firstName: 'TestAgent',
                lastName: `Diallo-${testSuffix}`,
                nin: `NIN-AG-${testSuffix}`,
                phoneNumber: `+224621${testSuffix}`,
                drivingLicenseNumber: `PC-AG-${testSuffix}`,
                commune: testCommune?.name || 'Matoto',
              },
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accepted).toBe(1);
    });

    it('allows CHEF_SERVICE to push offline drafts from web-admin', async () => {
      const res = await request(app)
        .post('/api/v1/sync/push')
        .set('Authorization', `Bearer ${chefToken}`)
        .send({
          deviceId: `web-test-${testSuffix}`,
          items: [
            {
              clientGeneratedId: crypto.randomUUID(),
              entityType: 'DRIVER',
              createdOfflineAt: new Date().toISOString(),
              payload: {
                firstName: 'TestChef',
                lastName: `Barry-${testSuffix}`,
                nin: `NIN-CH-${testSuffix}`,
                phoneNumber: `+224622${testSuffix}`,
                drivingLicenseNumber: `PC-CH-${testSuffix}`,
                commune: testCommune?.name || 'Matoto',
              },
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accepted).toBe(1);
    });

    it('allows DIRECTOR to push offline drafts from web-admin', async () => {
      const res = await request(app)
        .post('/api/v1/sync/push')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({
          deviceId: `web-test-${testSuffix}`,
          items: [
            {
              clientGeneratedId: crypto.randomUUID(),
              entityType: 'DRIVER',
              createdOfflineAt: new Date().toISOString(),
              payload: {
                firstName: 'TestDirector',
                lastName: `Camara-${testSuffix}`,
                nin: `NIN-DIR-${testSuffix}`,
                phoneNumber: `+224623${testSuffix}`,
                drivingLicenseNumber: `PC-DIR-${testSuffix}`,
                commune: testCommune?.name || 'Matoto',
              },
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accepted).toBe(1);
    });

    it('strictly denies unauthorized DISTRIBUTEUR from pushing offline sync batches', async () => {
      const res = await request(app)
        .post('/api/v1/sync/push')
        .set('Authorization', `Bearer ${unauthorizedDistributorToken}`)
        .send({
          deviceId: `web-test-${testSuffix}`,
          items: [
            {
              clientGeneratedId: crypto.randomUUID(),
              entityType: 'DRIVER',
              createdOfflineAt: new Date().toISOString(),
              payload: {
                firstName: 'Unauthorized',
                lastName: 'User',
                nin: 'NIN-UNAUTH',
                phoneNumber: '+224620000000',
                drivingLicenseNumber: 'PC-UNAUTH',
              },
            },
          ],
        });

      expect(res.status).toBe(403);
    });

    it('rejects sync drafts when agentUserId does not match authenticated user (ATTRIBUTION_MISMATCH)', async () => {
      const res = await request(app)
        .post('/api/v1/sync/push')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          deviceId: `web-test-${testSuffix}`,
          items: [
            {
              clientGeneratedId: crypto.randomUUID(),
              agentUserId: 'different-agent-user-id-999',
              entityType: 'DRIVER',
              createdOfflineAt: new Date().toISOString(),
              payload: {
                agentUserId: 'different-agent-user-id-999',
                firstName: 'Spoofed',
                lastName: `Attribution-${testSuffix}`,
                nin: `NIN-ATT-${testSuffix}`,
                phoneNumber: `+224625${testSuffix}`,
                drivingLicenseNumber: `PC-ATT-${testSuffix}`,
                commune: testCommune?.name || 'Matoto',
              },
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.failed).toBe(1);
      expect(res.body.data.results[0].status).toBe('ERROR');
      expect(res.body.data.results[0].errorCode).toBe('ATTRIBUTION_MISMATCH');
    });
  });

  describe('2. End-to-End Web-Admin Driver & Vehicle Sync with Documents', () => {
    const driverId = crypto.randomUUID();
    const ownerId = crypto.randomUUID();
    const vehicleId = crypto.randomUUID();

    const driverNin = `NIN-WDRV-${testSuffix}`;
    const driverPhone = `+224624${testSuffix}`;
    const driverLicense = `PC-WDRV-${testSuffix}`;

    const ownerNin = `NIN-WOWN-${testSuffix}`;
    const ownerPhone = `+224625${testSuffix}`;

    const plateNumber = `RC-${testSuffix.slice(0, 4)}-W`;
    const carteGrise = `CG-W-${testSuffix}`;
    const chassisVin = `VIN-W-${testSuffix}`;

    it('synchronizes a full web-admin offline batch containing Driver, Owner, Vehicle and Photos', async () => {
      const res = await request(app)
        .post('/api/v1/sync/push')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          deviceId: `web-chrome-${testSuffix}`,
          items: [
            {
              clientGeneratedId: ownerId,
              entityType: 'OWNER',
              createdOfflineAt: new Date().toISOString(),
              payload: {
                firstName: 'Ousmane',
                lastName: `Sow-${testSuffix}`,
                nin: ownerNin,
                phoneNumber: ownerPhone,
                ownerType: 'INDIVIDU',
                commune: testCommune?.name || 'Matoto',
              },
            },
            {
              clientGeneratedId: driverId,
              entityType: 'DRIVER',
              createdOfflineAt: new Date().toISOString(),
              payload: {
                firstName: 'Ibrahima',
                lastName: `Bah-${testSuffix}`,
                nin: driverNin,
                phoneNumber: driverPhone,
                emergencyContactPhone: `+224626${testSuffix}`,
                emergencyContactName: 'Fatoumata Bah',
                emergencyContactRelation: 'Épouse',
                drivingLicenseNumber: driverLicense,
                licenseCategory: 'B',
                licenseExpirationDate: '2029-12-31',
                commune: testCommune?.name || 'Matoto',
                documents: [
                  {
                    category: 'PHOTO_PORTRAIT',
                    originalName: 'conducteur_portrait.jpg',
                    mimeType: 'image/jpeg',
                    base64Data: VALID_JPEG_BASE64,
                  },
                ],
              },
            },
            {
              clientGeneratedId: vehicleId,
              entityType: 'VEHICLE',
              createdOfflineAt: new Date().toISOString(),
              payload: {
                ownerClientGeneratedId: ownerId,
                driverClientGeneratedId: driverId,
                plateNumber,
                registrationCardNumber: carteGrise,
                chassisVin,
                vehicleType: 'TAXI_COLLECTIF',
                make: 'Toyota',
                model: 'Corolla',
                year: 2021,
                seatingCapacity: 5,
                commune: testCommune?.name || 'Matoto',
                documents: [
                  {
                    category: 'PHOTO_VEHICULE_AVANT',
                    originalName: 'vehicule_face.jpg',
                    mimeType: 'image/jpeg',
                    base64Data: VALID_JPEG_BASE64,
                  },
                ],
              },
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accepted).toBe(3);
      expect(res.body.data.failed).toBe(0);

      // Verify that records were actually created in PostgreSQL
      const persistedDriver = await prisma.driver.findUnique({
        where: { drivingLicenseNumber: driverLicense },
        include: { person: true },
      });
      expect(persistedDriver).toBeTruthy();
      expect(persistedDriver.person.nin).toBe(driverNin);

      const persistedVehicle = await prisma.vehicle.findUnique({
        where: { plateNumber },
        include: { owner: { include: { person: true } } },
      });
      expect(persistedVehicle).toBeTruthy();
      expect(persistedVehicle.registrationCardNumber).toBe(carteGrise);
      expect(persistedVehicle.owner.person.nin).toBe(ownerNin);
    });

    it('guarantees idempotency: re-pushing the exact same batch returns ALREADY_SYNCED without duplicating records', async () => {
      const res = await request(app)
        .post('/api/v1/sync/push')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          deviceId: `web-chrome-${testSuffix}`,
          items: [
            {
              clientGeneratedId: driverId,
              entityType: 'DRIVER',
              createdOfflineAt: new Date().toISOString(),
              payload: {
                firstName: 'Ibrahima',
                lastName: `Bah-${testSuffix}`,
                nin: driverNin,
                phoneNumber: driverPhone,
                drivingLicenseNumber: driverLicense,
              },
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.duplicates).toBe(1);
      expect(res.body.data.results[0].status).toBe('ALREADY_SYNCED');

      // Verify no duplicate driver created
      const count = await prisma.driver.count({
        where: { drivingLicenseNumber: driverLicense },
      });
      expect(count).toBe(1);
    });

    it('detects and handles conflicts when another device registered conflicting identifiers', async () => {
      const conflictingDriverId = crypto.randomUUID();
      const res = await request(app)
        .post('/api/v1/sync/push')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          deviceId: `web-chrome-conflict-${testSuffix}`,
          items: [
            {
              clientGeneratedId: conflictingDriverId,
              entityType: 'DRIVER',
              createdOfflineAt: new Date().toISOString(),
              payload: {
                firstName: 'Impostor',
                lastName: 'Driver',
                nin: `NIN-DIFFERENT-${testSuffix}`,
                phoneNumber: `+224629${testSuffix}`,
                drivingLicenseNumber: driverLicense, // SAME driving license!
                commune: testCommune?.name || 'Matoto',
              },
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.conflicts).toBe(1);
      expect(res.body.data.results[0].status).toBe('CONFLICT');
      expect(res.body.data.results[0].conflictCode).toBe('LICENSE_BELONGS_TO_OTHER_PERSON');
    });
  });

  describe('3. Web Cryptography AES-256-GCM Simulation', () => {
    it('verifies that AES-GCM 256-bit encrypts and decrypts offline payloads with zero data loss', async () => {
      const subtle = globalThis.crypto.subtle;
      const seed = globalThis.crypto.getRandomValues(new Uint8Array(32));
      const salt = new TextEncoder().encode('aotuc-guinee-transport-offline-salt-v1');

      const baseKey = await subtle.importKey(
        'raw',
        seed,
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );

      const aesKey = await subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt,
          iterations: 10000,
          hash: 'SHA-256',
        },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );

      const sensitivePayload = {
        firstName: 'Mamadou',
        lastName: 'Diallo',
        nin: '199512345678',
        phoneNumber: '+224621998877',
        address: 'Conakry, Commune de Matam',
      };

      const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode(JSON.stringify(sensitivePayload));

      const cipher = await subtle.encrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        encoded
      );

      // Verify that cipher is not readable as plaintext
      const cipherText = Buffer.from(cipher).toString('utf8');
      expect(cipherText).not.toContain('Mamadou');
      expect(cipherText).not.toContain('199512345678');

      // Decrypt
      const decrypted = await subtle.decrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        cipher
      );
      const restored = JSON.parse(new TextDecoder().decode(decrypted));

      expect(restored.firstName).toBe('Mamadou');
      expect(restored.nin).toBe('199512345678');
      expect(restored.phoneNumber).toBe('+224621998877');
    });
  });
});
