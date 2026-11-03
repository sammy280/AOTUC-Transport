import request from 'supertest';
import { jest } from '@jest/globals';
import app from '../src/app.js';
import jwt from 'jsonwebtoken';
import config from '../src/config/index.js';
import prisma from '../src/utils/prisma.js';
import { normalizeGuineanPhone } from '../src/modules/registration/registration.schemas.js';

describe('Milestone 2 — Registration & Document Security Gates', () => {
  let agentToken;
  let distributorToken;

  beforeAll(() => {
    // Mock prisma document and audit log creation for testing without a live DB
    jest.spyOn(prisma.document, 'create').mockImplementation(async ({ data }) => {
      return {
        id: 'mock-doc-uuid-1234',
        fileName: data.fileName,
        originalName: data.originalName,
        mimeType: data.mimeType,
        fileSizeBytes: data.fileSizeBytes,
        storagePath: data.storagePath,
        fileHashSha256: data.fileHashSha256,
        category: data.category,
        uploadedByUserId: data.uploadedByUserId,
        personId: data.personId,
        vehicleId: data.vehicleId,
        createdAt: new Date(),
      };
    });

    jest.spyOn(prisma.auditLog, 'create').mockImplementation(async () => {
      return { id: 'mock-audit-uuid' };
    });

    agentToken = jwt.sign(
      { sub: 'agent-uuid-001', roles: ['AGENT_TERRAIN'], communeId: 'commune-matoto' },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    distributorToken = jwt.sign(
      { sub: 'distributor-uuid-001', roles: ['DISTRIBUTEUR'], communeId: 'commune-kaloum' },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );
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
      // Fake JPEG buffer: plain ASCII text, missing FF D8 FF signature
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

    it('should accept valid JPEG file matching magic bytes signature', async () => {
      // Valid JPEG header: FF D8 FF E0 + padding
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
    });

    it('should accept valid PDF file matching %PDF magic bytes signature', async () => {
      // Valid PDF header: 25 50 44 46 (%PDF)
      const validPdfBuffer = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');

      const res = await request(app)
        .post('/api/v1/documents/upload')
        .set('Authorization', `Bearer ${agentToken}`)
        .field('category', 'CARTE_GRISE')
        .attach('file', validPdfBuffer, { filename: 'carte_grise.pdf', contentType: 'application/pdf' });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.mimeType).toBe('application/pdf');
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
          phoneNumber: '12345', // Invalid phone format
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
          // Missing ownerId, plateNumber, chassisVin
          make: 'Toyota',
          model: 'Corolla',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.errors.length).toBeGreaterThanOrEqual(3);
    });
  });
});
