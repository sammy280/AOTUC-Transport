import request from 'supertest';
import { jest } from '@jest/globals';
import app from '../src/app.js';
import jwt from 'jsonwebtoken';
import config from '../src/config/index.js';
import CryptoSignatureService from '../src/services/cryptoSignatureService.js';
import PdfBadgeService from '../src/services/pdfBadgeService.js';

describe('Milestone 4 — Badges, Licences & Asymmetric Ed25519 Cryptography', () => {
  let directorToken;
  let agentToken;

  beforeAll(() => {
    directorToken = jwt.sign(
      { sub: 'director-001', roles: ['DIRECTOR'], communeId: null },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    agentToken = jwt.sign(
      { sub: 'agent-001', roles: ['AGENT_TERRAIN'], communeId: 'commune-matoto' },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );
  });

  describe('1. Ed25519 Asymmetric Cryptographic Signing Engine', () => {
    it('should generate a valid Ed25519 signed QR payload', () => {
      const issuedAt = new Date();
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      const signResult = CryptoSignatureService.signCredential({
        credentialId: 'CH-2026-TEST1',
        type: 'DRIVER_BADGE',
        targetId: 'driver-uuid-1234',
        issuedAt,
        expiresAt,
      });

      expect(signResult).toHaveProperty('keyId');
      expect(signResult).toHaveProperty('signature');
      expect(signResult).toHaveProperty('qrPayload');
      expect(signResult.qrPayload.startsWith('AOTUC1.')).toBe(true);
    });

    it('should verify genuine Ed25519 QR payload offline with public key', () => {
      const issuedAt = new Date();
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      const { qrPayload } = CryptoSignatureService.signCredential({
        credentialId: 'CH-2026-TEST2',
        type: 'DRIVER_BADGE',
        targetId: 'driver-uuid-5678',
        issuedAt,
        expiresAt,
      });

      const verification = CryptoSignatureService.verifyQrPayload(qrPayload);
      expect(verification.isValid).toBe(true);
      expect(verification.isExpired).toBe(false);
      expect(verification.payload.credentialId).toBe('CH-2026-TEST2');
    });

    it('should REJECT a tampered QR payload with forged or altered signature', () => {
      const issuedAt = new Date();
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      const { qrPayload } = CryptoSignatureService.signCredential({
        credentialId: 'CH-2026-TEST3',
        type: 'DRIVER_BADGE',
        targetId: 'driver-uuid-9999',
        issuedAt,
        expiresAt,
      });

      // Tamper with target ID in the QR string (e.g. impersonate another driver)
      const tamperedQr = qrPayload.replace('driver-uuid-9999', 'hacked-driver-fake');

      const verification = CryptoSignatureService.verifyQrPayload(tamperedQr);
      expect(verification.isValid).toBe(false);
      expect(verification.reason).toContain('altérée ou contrefaite');
    });

    it('should detect when an authentic credential has expired', () => {
      // Past dates
      const pastIssuedAt = new Date('2024-01-01');
      const pastExpiresAt = new Date('2025-01-01');

      const { qrPayload } = CryptoSignatureService.signCredential({
        credentialId: 'CH-2024-EXPIRED',
        type: 'DRIVER_BADGE',
        targetId: 'driver-uuid-0000',
        issuedAt: pastIssuedAt,
        expiresAt: pastExpiresAt,
      });

      const verification = CryptoSignatureService.verifyQrPayload(qrPayload);
      expect(verification.isValid).toBe(true);
      expect(verification.isExpired).toBe(true);
      expect(verification.reason).toContain('Titre expiré');
    });
  });

  describe('2. Printable CR80 & Windshield Sticker PDF Generation', () => {
    it('should generate a valid binary CR80 PDF card matching %PDF signature', async () => {
      const pdfBuffer = await PdfBadgeService.generateDriverBadgePdf({
        badgeNumber: 'CH-2026-00042',
        driverName: 'Ibrahima Sory Diallo',
        licenseNumber: 'PC-2026-99988',
        category: 'B',
        expiresAt: new Date('2027-11-04'),
        qrPayload: 'AOTUC1.test-key.CH-2026-00042.DRIVER_BADGE.test.1730728800.1762264800.fakesig',
      });

      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      expect(pdfBuffer.length).toBeGreaterThan(1000);
      // PDF Magic bytes check (%PDF)
      expect(pdfBuffer.subarray(0, 4).toString('utf8')).toBe('%PDF');
    });

    it('should generate a valid Windshield Sticker PDF buffer', async () => {
      const pdfBuffer = await PdfBadgeService.generateLicenceStickerPdf({
        licenceNumber: 'LIC-2026-00100',
        plateNumber: 'RC-1234-A',
        lineCode: 'L-01',
        vehicleType: 'TAXI_COLLECTIF',
        expiresAt: new Date('2027-11-04'),
        qrPayload: 'AOTUC1.test-key.LIC-2026-00100.TRANSPORT_LICENCE.test.1730728800.1762264800.fakesig',
      });

      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      expect(pdfBuffer.length).toBeGreaterThan(1000);
      expect(pdfBuffer.subarray(0, 4).toString('utf8')).toBe('%PDF');
    });
  });

  describe('3. Role Authorization Gates for Credential Issuance', () => {
    it('should allow public access to GET /api/v1/badges/public-keys for offline syncing', async () => {
      const res = await request(app).get('/api/v1/badges/public-keys');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0]).toHaveProperty('algorithm', 'Ed25519');
      expect(res.body.data[0]).toHaveProperty('publicKeyPem');
    });

    it('should REJECT Field Agent attempting to issue a badge directly (403)', async () => {
      const res = await request(app)
        .post('/api/v1/badges/issue')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({ driverId: 'driver-uuid-123' });

      expect(res.statusCode).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN_ROLE');
    });

    it('should REJECT Field Agent attempting to issue a transport licence directly (403)', async () => {
      const res = await request(app)
        .post('/api/v1/licences/issue')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({ vehicleId: 'vehicle-uuid-123' });

      expect(res.statusCode).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN_ROLE');
    });
  });
});
