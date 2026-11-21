import crypto from 'crypto';
import request from 'supertest';
import { jest } from '@jest/globals';
import app from '../src/app.js';
import jwt from 'jsonwebtoken';
import config from '../src/config/index.js';
import prisma from '../src/utils/prisma.js';
import { normalizeGuineanPhone } from '../src/modules/registration/registration.schemas.js';

const VALID_JPEG_BASE64 = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
  0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
  0x00, 0x48, 0x00, 0x00, 0xff, 0xd9,
]).toString('base64');

describe('Phase 3 — Registration (Drivers, Owners, Vehicles), Documents, GPS & Duplicate Detection Suite', () => {
  jest.setTimeout(30000);

  let agentUser;
  let matotoCommune;
  let agentToken;
  let distributorToken;

  const suffix = Date.now().toString().slice(-6);
  const driverNin = `NIN-P3-DRV-${suffix}`;
  const driverPhone = `+224623${suffix}`;
  const driverLicense = `PC-P3-${suffix}`;

  const emergDriverNin = `NIN-EMG-DRV-${suffix}`;
  const emergDriverPhone = `+224625${suffix}`;
  const emergContactPhone = `628${suffix}`;
  const emergDriverLicense = `PC-EMG-${suffix}`;

  const syncDriverNin = `NIN-SNC-DRV-${suffix}`;
  const syncDriverPhone = `+224626${suffix}`;
  const syncEmergPhone = `+224627${suffix}`;
  const syncDriverLicense = `PC-SNC-${suffix}`;

  const ownerNin = `NIN-P3-OWN-${suffix}`;
  const ownerPhone = `+224624${suffix}`;

  const vehiclePlate = `RC-${suffix.slice(0, 4)}-P3`;
  const vehicleCard = `CG-P3-${suffix}`;
  const vehicleVin = `VIN-P3-2026-${suffix}`;

  let createdDriverId = null;
  let createdEmergDriverId = null;
  let createdSyncDriverId = null;
  let createdOwnerId = null;
  let createdVehicleId = null;
  const uploadedDocIds = [];

  beforeAll(async () => {
    jest.setTimeout(30000);

    matotoCommune = await prisma.commune.findFirst({ where: { code: 'MTT' } });
    agentUser = await prisma.user.findFirst({ where: { email: 'agent.matoto@aotuc.test' } });
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

    distributorToken = jwt.sign(
      { sub: agentUser.id, roles: ['DISTRIBUTEUR'], communeId: matotoCommune?.id || null },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );
  });

  afterAll(async () => {
    try {
      if (uploadedDocIds.length > 0) {
        await prisma.document.deleteMany({ where: { id: { in: uploadedDocIds } } });
      }
      if (createdVehicleId) {
        await prisma.validationRequest.deleteMany({ where: { targetEntityId: createdVehicleId } });
        await prisma.vehicleInspection.deleteMany({ where: { vehicleId: createdVehicleId } });
      }
      if (createdDriverId) {
        await prisma.validationRequest.deleteMany({ where: { targetEntityId: createdDriverId } });
      }
      if (createdEmergDriverId) {
        await prisma.validationRequest.deleteMany({ where: { targetEntityId: createdEmergDriverId } });
      }
      if (createdSyncDriverId) {
        await prisma.validationRequest.deleteMany({ where: { targetEntityId: createdSyncDriverId } });
      }
      if (createdOwnerId) {
        await prisma.validationRequest.deleteMany({ where: { targetEntityId: createdOwnerId } });
      }
      await prisma.document.deleteMany({
        where: {
          OR: [
            { vehicle: { plateNumber: vehiclePlate } },
            { person: { nin: { in: [driverNin, emergDriverNin, syncDriverNin, ownerNin] } } },
          ],
        },
      });
      await prisma.vehicleAssignment.deleteMany({
        where: { vehicle: { plateNumber: vehiclePlate } },
      });
      await prisma.vehicle.deleteMany({ where: { plateNumber: vehiclePlate } });
      await prisma.driver.deleteMany({
        where: { drivingLicenseNumber: { in: [driverLicense, emergDriverLicense, syncDriverLicense] } },
      });
      await prisma.owner.deleteMany({
        where: { person: { nin: { in: [driverNin, emergDriverNin, syncDriverNin, ownerNin] } } },
      });
      await prisma.person.deleteMany({
        where: { nin: { in: [driverNin, emergDriverNin, syncDriverNin, ownerNin] } },
      });
    } catch (_) {
      // Ignore cleanup errors
    }
  });

  describe('1. Document Upload Security & Magic Byte Inspection', () => {
    it('should reject upload without authentication (401)', async () => {
      const res = await request(app).post('/api/v1/documents/upload');
      expect(res.statusCode).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('should reject file upload when no file is attached (400)', async () => {
      const res = await request(app)
        .post('/api/v1/documents/upload')
        .set('Authorization', `Bearer ${agentToken}`)
        .field('category', 'PHOTO_PORTRAIT');

      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('NO_FILE_PROVIDED');
      expect(res.body.message).toContain('Aucun fichier');
    });

    it('should reject file with spoofed MIME type (fake image containing text)', async () => {
      const fakeImageBuffer = Buffer.from('THIS IS PLAIN TEXT NOT A REAL JPEG IMAGE');

      const res = await request(app)
        .post('/api/v1/documents/upload')
        .set('Authorization', `Bearer ${agentToken}`)
        .field('category', 'PHOTO_PORTRAIT')
        .attach('file', fakeImageBuffer, { filename: 'malicious.jpg', contentType: 'image/jpeg' });

      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('INVALID_FILE_SIGNATURE');
      expect(res.body.message).toContain('ne correspond pas au type déclaré');
    });

    it('should accept valid JPEG file matching magic bytes signature and persist to PostgreSQL', async () => {
      const validJpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

      const res = await request(app)
        .post('/api/v1/documents/upload')
        .set('Authorization', `Bearer ${agentToken}`)
        .field('category', 'PHOTO_PORTRAIT')
        .attach('file', validJpegBuffer, { filename: 'driver_portrait.jpg', contentType: 'image/jpeg' });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.category).toBe('PHOTO_PORTRAIT');
      expect(res.body.data.fileHashSha256).toBeDefined();
      uploadedDocIds.push(res.body.data.id);
    });

    it('should accept valid PDF file matching %PDF magic bytes signature and persist to PostgreSQL', async () => {
      const validPdfBuffer = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');

      const res = await request(app)
        .post('/api/v1/documents/upload')
        .set('Authorization', `Bearer ${agentToken}`)
        .field('category', 'CARTE_GRISE')
        .attach('file', validPdfBuffer, { filename: 'carte_grise.pdf', contentType: 'application/pdf' });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.mimeType).toBe('application/pdf');
      uploadedDocIds.push(res.body.data.id);
    });
  });

  describe('2. Registration Business Rules & Role Boundaries', () => {
    it('should correctly normalize Guinean telephone numbers to E.164', () => {
      expect(normalizeGuineanPhone('620 12 34 56')).toBe('+224620123456');
      expect(normalizeGuineanPhone('+224620123456')).toBe('+224620123456');
      expect(normalizeGuineanPhone('00224620123456')).toBe('+224620123456');
    });

    it('should reject driver registration by unauthorized role (DISTRIBUTEUR) with 403', async () => {
      const res = await request(app)
        .post('/api/v1/registration/drivers')
        .set('Authorization', `Bearer ${distributorToken}`)
        .send({
          firstName: 'Amadou',
          lastName: 'Bah',
          nin: 'NIN-TEST-001',
          phoneNumber: '+224620112233',
          drivingLicenseNumber: 'PC-2026-999',
          licenseExpirationDate: '2028-12-31',
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN_ROLE');
    });

    it('should validate driver registration schema and reject invalid phone number', async () => {
      const res = await request(app)
        .post('/api/v1/registration/drivers')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          firstName: 'Amadou',
          lastName: 'Bah',
          nin: 'NIN-TEST-001',
          phoneNumber: '12345',
          drivingLicenseNumber: 'PC-2026-999',
          licenseExpirationDate: '2028-12-31',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.errors.some((e) => e.field === 'phoneNumber')).toBe(true);
    });

    it('should validate vehicle registration schema and require mandatory fields', async () => {
      const res = await request(app)
        .post('/api/v1/registration/vehicles')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          make: 'Toyota',
          model: 'Corolla',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('3. Real PostgreSQL End-to-End Registration (Driver, Owner, Vehicle, Documents, GPS & Duplicates)', () => {
    it('should register a Driver online with GPS coordinates, inline documents, and agent provenance', async () => {
      const res = await request(app)
        .post('/api/v1/registration/drivers')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          firstName: 'Ibrahima',
          lastName: 'Camara',
          nin: driverNin,
          phoneNumber: driverPhone,
          address: 'Sangoyah, Matoto',
          commune: 'Matoto',
          drivingLicenseNumber: driverLicense,
          licenseCategory: 'B',
          licenseExpirationDate: '2029-12-31',
          latitude: 9.6012,
          longitude: -13.6045,
          gpsCapturedAt: '2026-11-17T12:00:00.000Z',
          documents: [
            {
              category: 'PHOTO_PORTRAIT',
              originalName: 'ibrahima_portrait.jpg',
              mimeType: 'image/jpeg',
              base64Data: VALID_JPEG_BASE64,
            },
            {
              category: 'PERMIS_CONDUIRE',
              originalName: 'ibrahima_permis.jpg',
              mimeType: 'image/jpeg',
              base64Data: VALID_JPEG_BASE64,
            },
          ],
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      createdDriverId = res.body.data.id;
      expect(createdDriverId).toBeDefined();
      expect(res.body.data.person.latitude).toBeCloseTo(9.6012, 4);
      expect(res.body.data.person.registeredByUserId).toBe(agentUser.id);
      expect(res.body.data.documents.length).toBe(2);
    });

    it('should reject duplicate Driver registration with 409 CONFLICT', async () => {
      const res = await request(app)
        .post('/api/v1/registration/drivers')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          firstName: 'Autre',
          lastName: 'Chauffeur',
          nin: driverNin,
          phoneNumber: driverPhone,
          drivingLicenseNumber: driverLicense,
          licenseExpirationDate: '2029-12-31',
        });

      expect(res.statusCode).toBe(409);
      expect(res.body.code).toBe('DRIVER_ALREADY_EXISTS');
    });

    it('should register a Company Owner (ENTREPRISE) with GPS and inline documents', async () => {
      const res = await request(app)
        .post('/api/v1/registration/owners')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          firstName: 'Hadj',
          lastName: 'Kaba',
          nin: ownerNin,
          phoneNumber: ownerPhone,
          address: 'Enta Marché, Matoto',
          commune: 'Matoto',
          ownerType: 'ENTREPRISE',
          businessName: `Société Transport Kaba ${suffix}`,
          taxNumber: `NIF-P3-${suffix}`,
          latitude: 9.6123,
          longitude: -13.5911,
          gpsCapturedAt: '2026-11-17T12:05:00.000Z',
          documents: [
            {
              category: 'CNI_RECTO',
              originalName: 'kaba_cni.jpg',
              mimeType: 'image/jpeg',
              base64Data: VALID_JPEG_BASE64,
            },
          ],
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      createdOwnerId = res.body.data.id;
      expect(res.body.data.ownerType).toBe('ENTREPRISE');
      expect(res.body.data.businessName).toContain('Société Transport Kaba');
      expect(res.body.data.documents.length).toBe(1);
    });

    it('should register a Vehicle linked to the Owner and Driver, with GPS, inspection certificate & inline documents', async () => {
      const res = await request(app)
        .post('/api/v1/registration/vehicles')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          ownerId: createdOwnerId,
          driverId: createdDriverId,
          plateNumber: vehiclePlate,
          registrationCardNumber: vehicleCard,
          chassisVin: vehicleVin,
          vehicleType: 'TAXI_COLLECTIF',
          make: 'Renault',
          model: 'Logan',
          year: 2022,
          seatingCapacity: 5,
          inspectionCertificateNumber: `VT-P3-${suffix}`,
          inspectionCenter: 'Centre Contrôle Technique Matoto',
          inspectionExpirationDate: '2027-12-31',
          latitude: 9.6055,
          longitude: -13.6001,
          gpsCapturedAt: '2026-11-17T12:10:00.000Z',
          documents: [
            {
              category: 'CARTE_GRISE',
              originalName: 'logan_cg.jpg',
              mimeType: 'image/jpeg',
              base64Data: VALID_JPEG_BASE64,
            },
          ],
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      createdVehicleId = res.body.data.id;
      expect(res.body.data.ownerId).toBe(createdOwnerId);
      expect(res.body.data.latitude).toBeCloseTo(9.6055, 4);
      expect(res.body.data.registeredByUserId).toBe(agentUser.id);
      expect(res.body.data.documents.length).toBe(1);

      // Verify driver-to-vehicle assignment and technical inspection in PostgreSQL
      const dbVehicle = await prisma.vehicle.findUnique({
        where: { id: createdVehicleId },
        include: { assignments: true, inspections: true },
      });
      expect(dbVehicle.assignments.length).toBe(1);
      expect(dbVehicle.assignments[0].driverId).toBe(createdDriverId);
      expect(dbVehicle.inspections.length).toBe(1);
      expect(dbVehicle.inspections[0].certificateNumber).toBe(`VT-P3-${suffix}`);
    });

    it('should detect duplicates via GET /api/v1/registration/check-duplicate for NIN, license and plate', async () => {
      const res = await request(app)
        .get('/api/v1/registration/check-duplicate')
        .set('Authorization', `Bearer ${agentToken}`)
        .query({
          nin: driverNin,
          drivingLicenseNumber: driverLicense,
          plateNumber: vehiclePlate,
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.hasDuplicate).toBe(true);
      expect(res.body.data.person.nin).toBe(driverNin);
      expect(res.body.data.driver.drivingLicenseNumber).toBe(driverLicense);
      expect(res.body.data.vehicle.plateNumber).toBe(vehiclePlate);
    });

    it('should list registered Owners via GET /api/v1/registration/owners', async () => {
      const res = await request(app)
        .get('/api/v1/registration/owners')
        .set('Authorization', `Bearer ${agentToken}`)
        .query({ search: ownerNin });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.some((o) => o.id === createdOwnerId)).toBe(true);
    });
  });

  describe('4. Emergency Contact Validation, Photograph Verification, Offline Sync & Re-login Visibility', () => {
    it('should reject driver creation when emergency contact phone equals primary phone (400)', async () => {
      const res = await request(app)
        .post('/api/v1/registration/drivers')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          firstName: 'Ousmane',
          lastName: 'Sylla',
          nin: `NIN-SAME-PH-${suffix}`,
          phoneNumber: '+224620998877',
          emergencyContactPhone: '620 99 88 77',
          emergencyContactName: 'Même Numéro',
          emergencyContactRelation: 'Famille',
          drivingLicenseNumber: `PC-SAME-${suffix}`,
          licenseExpirationDate: '2029-12-31',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(
        res.body.errors.some((e) => e.field.includes('emergencyContactPhone'))
      ).toBe(true);
    });

    it('should reject driver creation when inline photograph has invalid magic bytes and not persist orphan driver', async () => {
      const badPhotoNin = `NIN-BAD-IMG-${suffix}`;
      const fakeJpegBase64 = Buffer.from('FAKE_CORRUPTED_IMAGE_BYTES').toString('base64');

      const res = await request(app)
        .post('/api/v1/registration/drivers')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          firstName: 'Moussa',
          lastName: 'Kourouma',
          nin: badPhotoNin,
          phoneNumber: `+224629${suffix}`,
          emergencyContactPhone: `+224628${suffix}`,
          drivingLicenseNumber: `PC-BADIMG-${suffix}`,
          licenseExpirationDate: '2029-12-31',
          documents: [
            {
              category: 'PHOTO_PORTRAIT',
              originalName: 'fake_portrait.jpg',
              mimeType: 'image/jpeg',
              base64Data: fakeJpegBase64,
            },
          ],
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('INVALID_FILE_SIGNATURE');

      const checkPerson = await prisma.person.findUnique({ where: { nin: badPhotoNin } });
      expect(checkPerson).toBeNull();
    });

    it('should register a Driver with normalized emergency contact details and portrait photograph and persist in PostgreSQL', async () => {
      const res = await request(app)
        .post('/api/v1/registration/drivers')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          firstName: 'Sékou',
          lastName: 'Touré',
          nin: emergDriverNin,
          phoneNumber: emergDriverPhone,
          emergencyContactPhone: emergContactPhone,
          emergencyContactName: 'Mariama Touré',
          emergencyContactRelation: 'Conjoint(e)',
          commune: 'Matoto',
          drivingLicenseNumber: emergDriverLicense,
          licenseCategory: 'C1',
          licenseExpirationDate: '2030-06-30',
          documents: [
            {
              category: 'PHOTO_PORTRAIT',
              originalName: 'sekou_portrait.jpg',
              mimeType: 'image/jpeg',
              base64Data: VALID_JPEG_BASE64,
            },
          ],
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      createdEmergDriverId = res.body.data.id;
      expect(res.body.data.emergencyContactPhone).toBe(`+224${emergContactPhone}`);
      expect(res.body.data.emergencyContactName).toBe('Mariama Touré');
      expect(res.body.data.emergencyContactRelation).toBe('Conjoint(e)');
      expect(res.body.data.documents.length).toBe(1);
      expect(res.body.data.documents[0].category).toBe('PHOTO_PORTRAIT');

      // Verify existing driver without emergency contact remains valid in PostgreSQL
      const existingDriverWithoutEmergency = await prisma.driver.findUnique({
        where: { id: createdDriverId },
      });
      expect(existingDriverWithoutEmergency).not.toBeNull();
      expect(existingDriverWithoutEmergency.emergencyContactPhone).toBeNull();
    });

    it('should synchronize an offline Driver draft with emergency contact details and portrait photo via POST /api/v1/sync/push', async () => {
      const clientGeneratedId = crypto.randomUUID();
      const res = await request(app)
        .post('/api/v1/sync/push')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          deviceId: `DEV-TEST-${suffix}`,
          items: [
            {
              clientGeneratedId,
              entityType: 'DRIVER',
              createdOfflineAt: new Date().toISOString(),
              payload: {
                firstName: 'Alpha',
                lastName: 'Condé',
                nin: syncDriverNin,
                phoneNumber: syncDriverPhone,
                emergencyContactPhone: syncEmergPhone,
                emergencyContactName: 'Kadiatou Condé',
                emergencyContactRelation: 'Famille',
                commune: 'Matoto',
                drivingLicenseNumber: syncDriverLicense,
                licenseCategory: 'B',
                licenseExpirationDate: '2029-12-31',
                documents: [
                  {
                    category: 'PHOTO_PORTRAIT',
                    originalName: 'alpha_offline_portrait.jpg',
                    mimeType: 'image/jpeg',
                    base64Data: VALID_JPEG_BASE64,
                  },
                ],
              },
            },
          ],
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accepted).toBe(1);
      createdSyncDriverId = res.body.data.results[0].serverRecordId;
      expect(createdSyncDriverId).toBeDefined();

      const syncedDriver = await prisma.driver.findUnique({
        where: { id: createdSyncDriverId },
        include: { person: { include: { documents: true } } },
      });
      expect(syncedDriver.emergencyContactPhone).toBe(syncEmergPhone);
      expect(syncedDriver.emergencyContactName).toBe('Kadiatou Condé');
      expect(syncedDriver.emergencyContactRelation).toBe('Famille');
      expect(syncedDriver.person.documents.some((d) => d.category === 'PHOTO_PORTRAIT')).toBe(true);
    });

    it('should keep driver and vehicle records visible after a fresh login session (including SUPER_ADMIN and AGENT_TERRAIN)', async () => {
      const freshSuperAdminToken = jwt.sign(
        {
          sub: agentUser.id,
          email: 'superadmin@aotuc.gov.gn',
          roles: ['SUPER_ADMIN'],
          communeId: null,
        },
        config.JWT_ACCESS_SECRET,
        { expiresIn: '15m' }
      );

      const driversRes = await request(app)
        .get('/api/v1/registration/drivers')
        .set('Authorization', `Bearer ${freshSuperAdminToken}`)
        .query({ search: emergDriverNin });

      expect(driversRes.statusCode).toBe(200);
      const foundDriver = driversRes.body.data.items.find((d) => d.id === createdEmergDriverId);
      expect(foundDriver).toBeDefined();
      expect(foundDriver.emergencyContactPhone).toBe(`+224${emergContactPhone}`);
      expect(foundDriver.person.documents.some((doc) => doc.category === 'PHOTO_PORTRAIT')).toBe(
        true
      );

      const vehiclesRes = await request(app)
        .get('/api/v1/registration/vehicles')
        .set('Authorization', `Bearer ${freshSuperAdminToken}`)
        .query({ search: vehiclePlate });

      expect(vehiclesRes.statusCode).toBe(200);
      const foundVehicle = vehiclesRes.body.data.items.find((v) => v.id === createdVehicleId);
      expect(foundVehicle).toBeDefined();
      expect(foundVehicle.plateNumber).toBe(vehiclePlate);
    });
  });
});
