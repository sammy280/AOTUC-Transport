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

describe('AOTUC — Driver Driving Licence Document Capture, Storage & Streaming Suite', () => {
  jest.setTimeout(40000);

  let agentUser;
  let superAdminUser;
  let kaloumCommune;
  let agentToken;
  let superAdminToken;

  const testSuffix = Date.now().toString().slice(-6);
  let createdDriverId = null;
  let createdPersonId = null;
  let licenceRectoDocId = null;
  let licenceVersoDocId = null;
  let portraitDocId = null;

  beforeAll(async () => {
    kaloumCommune = await prisma.commune.findFirst({ where: { code: 'KLM' } });

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
        communeId: kaloumCommune?.id || null,
        permissions: ['drivers.create', 'drivers.read', 'documents.upload'],
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    superAdminToken = jwt.sign(
      {
        sub: superAdminUser.id,
        email: superAdminUser.email,
        phoneNumber: superAdminUser.phoneNumber,
        roles: ['SUPER_ADMIN'],
        communeId: null,
        permissions: ['drivers.create', 'drivers.read', 'drivers.update', 'documents.upload', 'documents.verify'],
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );
  });

  afterAll(async () => {
    // Clean up created test driver documents and records
    if (createdPersonId) {
      const docs = await prisma.document.findMany({ where: { personId: createdPersonId } });
      for (const d of docs) {
        if (fs.existsSync(d.storagePath)) {
          try { fs.unlinkSync(d.storagePath); } catch (_) {}
        }
      }
      await prisma.document.deleteMany({ where: { personId: createdPersonId } });
      if (createdDriverId) {
        await prisma.validationRequest.deleteMany({ where: { targetEntityId: createdDriverId } });
        await prisma.auditLog.deleteMany({ where: { targetRecordId: createdDriverId } });
        await prisma.driver.deleteMany({ where: { id: createdDriverId } });
      }
      await prisma.person.deleteMany({ where: { id: createdPersonId } });
    }
  });

  // 1. Driver registration with Front & Back licence photos + portrait
  it('1. Successfully registers a driver with both Front and Back driving licence photographs', async () => {
    const payload = {
      firstName: `Mamadou_${testSuffix}`,
      lastName: 'Barry',
      nin: `NIN-LIC-${testSuffix}`,
      phoneNumber: `+2246201${testSuffix.slice(-5)}`,
      emergencyContactPhone: `+2246202${testSuffix.slice(-5)}`,
      emergencyContactName: 'Fatou Barry',
      emergencyContactRelation: 'Épouse',
      drivingLicenseNumber: `PC-LIC-${testSuffix}`,
      licenseCategory: 'B',
      licenseExpirationDate: '2029-12-31',
      communeId: kaloumCommune?.id,
      documents: [
        {
          category: 'PHOTO_PORTRAIT',
          originalName: 'portrait_officiel.jpg',
          mimeType: 'image/jpeg',
          base64Data: VALID_JPEG_BASE64,
        },
        {
          category: 'PERMIS_CONDUIRE_RECTO',
          originalName: 'permis_conduire_recto.jpg',
          mimeType: 'image/jpeg',
          base64Data: VALID_JPEG_BASE64,
        },
        {
          category: 'PERMIS_CONDUIRE_VERSO',
          originalName: 'permis_conduire_verso.png',
          mimeType: 'image/png',
          base64Data: VALID_PNG_BASE64,
        },
        {
          category: 'CNI_RECTO',
          originalName: 'cni_identite.jpg',
          mimeType: 'image/jpeg',
          base64Data: VALID_JPEG_BASE64,
        },
      ],
    };

    const res = await request(app)
      .post('/api/v1/registration/drivers')
      .set('Authorization', `Bearer ${agentToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();

    const driver = res.body.data;
    createdDriverId = driver.id;
    createdPersonId = driver.personId;

    expect(driver.drivingLicenseNumber).toBe(`PC-LIC-${testSuffix}`);

    // Verify documents are returned
    const docs = driver.documents || driver.person?.documents;
    expect(Array.isArray(docs)).toBe(true);
    expect(docs.length).toBe(4);

    const recto = docs.find((d) => d.category === 'PERMIS_CONDUIRE_RECTO');
    const verso = docs.find((d) => d.category === 'PERMIS_CONDUIRE_VERSO');
    const portrait = docs.find((d) => d.category === 'PHOTO_PORTRAIT');
    const cni = docs.find((d) => d.category === 'CNI_RECTO');

    expect(recto).toBeDefined();
    expect(verso).toBeDefined();
    expect(portrait).toBeDefined();
    expect(cni).toBeDefined();

    licenceRectoDocId = recto.id;
    licenceVersoDocId = verso.id;
    portraitDocId = portrait.id;
  });

  // 2. PostgreSQL persistence and separation
  it('2. Confirms licence documents are stored in PostgreSQL separate from portrait and CNI', async () => {
    const dbDocs = await prisma.document.findMany({
      where: { personId: createdPersonId },
      orderBy: { createdAt: 'asc' },
    });

    expect(dbDocs.length).toBe(4);

    const categories = dbDocs.map((d) => d.category);
    expect(categories).toContain('PHOTO_PORTRAIT');
    expect(categories).toContain('PERMIS_CONDUIRE_RECTO');
    expect(categories).toContain('PERMIS_CONDUIRE_VERSO');
    expect(categories).toContain('CNI_RECTO');

    // Confirm files exist on disk and have valid SHA-256 hashes
    for (const doc of dbDocs) {
      expect(doc.storagePath).toBeDefined();
      expect(fs.existsSync(doc.storagePath)).toBe(true);

      const fileContent = fs.readFileSync(doc.storagePath);
      const computedHash = crypto.createHash('sha256').update(fileContent).digest('hex');
      expect(doc.fileHashSha256).toBe(computedHash);
    }
  });

  // 3. Document Streaming via /stream and /download
  it('3. Successfully streams and downloads licence documents for authorized user', async () => {
    // Test /stream
    const streamRes = await request(app)
      .get(`/api/v1/documents/${licenceRectoDocId}/stream`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(streamRes.status).toBe(200);
    expect(streamRes.headers['content-type']).toBe('image/jpeg');
    expect(streamRes.body.length).toBe(VALID_JPEG_BUFFER.length);

    // Test /download alias
    const downloadRes = await request(app)
      .get(`/api/v1/documents/${licenceVersoDocId}/download`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers['content-type']).toBe('image/png');
    expect(downloadRes.body.length).toBe(VALID_PNG_BUFFER.length);
  });

  // 4. Retrieve driver details by ID with documents
  it('4. Successfully retrieves driver profile with documents list via GET /drivers/:id', async () => {
    const res = await request(app)
      .get(`/api/v1/registration/drivers/${createdDriverId}`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(createdDriverId);

    const personDocs = res.body.data.person?.documents;
    expect(Array.isArray(personDocs)).toBe(true);
    expect(personDocs.length).toBe(4);

    const categories = personDocs.map((d) => d.category);
    expect(categories).toContain('PERMIS_CONDUIRE_RECTO');
    expect(categories).toContain('PERMIS_CONDUIRE_VERSO');
  });

  // 5. Corrupted/invalid image rejected (Security check)
  it('5. Rejects registration when driving licence document has invalid magic bytes', async () => {
    const invalidTextBase64 = Buffer.from('THIS IS PLAIN TEXT NOT A REAL JPEG').toString('base64');
    const invalidPayload = {
      firstName: 'TestCorrupt',
      lastName: 'FakeImage',
      nin: `NIN-CORR-${testSuffix}`,
      phoneNumber: `+2246211${testSuffix.slice(-5)}`,
      emergencyContactPhone: `+2246212${testSuffix.slice(-5)}`,
      emergencyContactName: 'Urgence',
      emergencyContactRelation: 'Ami',
      drivingLicenseNumber: `PC-CORR-${testSuffix}`,
      licenseCategory: 'B',
      licenseExpirationDate: '2029-12-31',
      communeId: kaloumCommune?.id,
      documents: [
        {
          category: 'PERMIS_CONDUIRE_RECTO',
          originalName: 'fake_licence.jpg',
          mimeType: 'image/jpeg',
          base64Data: invalidTextBase64,
        },
      ],
    };

    const res = await request(app)
      .post('/api/v1/registration/drivers')
      .set('Authorization', `Bearer ${agentToken}`)
      .send(invalidPayload);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('INVALID_FILE_SIGNATURE');
  });

  // 6. Offline draft sync with Front & Back licence photos
  it('6. Successfully processes offline synchronized driver draft with licence documents', async () => {
    const syncClientGeneratedId = crypto.randomUUID();
    const syncDriverLicense = `PC-SYNC-LIC-${testSuffix}`;
    const syncDriverNin = `NIN-SYNC-LIC-${testSuffix}`;
    const syncPhone = `+2246221${testSuffix.slice(-5)}`;

    const syncPayload = {
      deviceId: 'dev-field-tablet-test-01',
      items: [
        {
          clientGeneratedId: syncClientGeneratedId,
          entityType: 'DRIVER',
          createdOfflineAt: new Date().toISOString(),
          payload: {
            firstName: 'Ibrahima',
            lastName: 'Sylla',
            nin: syncDriverNin,
            phoneNumber: syncPhone,
            emergencyContactPhone: `+2246222${testSuffix.slice(-5)}`,
            emergencyContactName: 'Aissatou Sylla',
            emergencyContactRelation: 'Soeur',
            drivingLicenseNumber: syncDriverLicense,
            licenseCategory: 'C',
            licenseExpirationDate: '2030-01-01',
            communeId: kaloumCommune?.id,
            documents: [
              {
                category: 'PERMIS_CONDUIRE_RECTO',
                originalName: 'sync_permis_recto.jpg',
                mimeType: 'image/jpeg',
                base64Data: VALID_JPEG_BASE64,
              },
              {
                category: 'PERMIS_CONDUIRE_VERSO',
                originalName: 'sync_permis_verso.jpg',
                mimeType: 'image/jpeg',
                base64Data: VALID_JPEG_BASE64,
              },
            ],
          },
        },
      ],
    };

    const res = await request(app)
      .post('/api/v1/sync/push')
      .set('Authorization', `Bearer ${agentToken}`)
      .send(syncPayload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accepted).toBe(1);

    // Verify in database
    const syncDriver = await prisma.driver.findUnique({
      where: { drivingLicenseNumber: syncDriverLicense },
      include: { person: { include: { documents: true } } },
    });

    expect(syncDriver).toBeDefined();
    expect(syncDriver.person.documents.length).toBe(2);

    const cats = syncDriver.person.documents.map((d) => d.category);
    expect(cats).toContain('PERMIS_CONDUIRE_RECTO');
    expect(cats).toContain('PERMIS_CONDUIRE_VERSO');

    // Clean up sync driver
    for (const d of syncDriver.person.documents) {
      if (fs.existsSync(d.storagePath)) {
        try { fs.unlinkSync(d.storagePath); } catch (_) {}
      }
    }
    await prisma.document.deleteMany({ where: { personId: syncDriver.personId } });
    await prisma.validationRequest.deleteMany({ where: { targetEntityId: syncDriver.id } });
    await prisma.auditLog.deleteMany({ where: { targetRecordId: syncDriver.id } });
    await prisma.driver.delete({ where: { id: syncDriver.id } });
    await prisma.person.delete({ where: { id: syncDriver.personId } });
  });
});
