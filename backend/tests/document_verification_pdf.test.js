import request from 'supertest';
import app from '../src/app.js';
import jwt from 'jsonwebtoken';
import config from '../src/config/index.js';
import CryptoSignatureService from '../src/services/cryptoSignatureService.js';
import PdfBadgeService from '../src/services/pdfBadgeService.js';

describe('AOTUC Official Document Generation & Public QR Verification Suite', () => {
  let directorToken;
  let distributorToken;

  beforeAll(() => {
    directorToken = jwt.sign(
      { sub: 'usr-dir-001', email: 'directeur@aotuc.test', roles: ['DIRECTOR'], communeId: null },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '1h' }
    );

    distributorToken = jwt.sign(
      { sub: 'usr-dis-001', email: 'distributeur@aotuc.test', roles: ['DISTRIBUTEUR'], communeId: 'commune-kaloum' },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '1h' }
    );
  });

  describe('1. PDF Generation Engine (CR80 Badge, Windshield Sticker, Transport Ticket)', () => {
    it('should generate a valid PDF buffer for Driver Badge CR80 (85.6mm x 53.98mm)', async () => {
      const buffer = await PdfBadgeService.generateDriverBadgePdf({
        badgeNumber: 'CH-2026-00042',
        driverName: 'Thierno Mamadou Bah',
        licenseNumber: 'PC-GN-2018-9912',
        category: 'B, C1',
        expiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000),
        qrPayload: 'AOTUC1.aotuc-2026-v1.CH-2026-00042.DRIVER_BADGE.d1.1770000000.1800000000.signature',
      });

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(1000);
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
    });

    it('should generate a valid PDF buffer for Windshield Licence Sticker (100mm x 100mm)', async () => {
      const buffer = await PdfBadgeService.generateLicenceStickerPdf({
        licenceNumber: 'LIC-2026-00188',
        plateNumber: 'RC-9844-AB',
        lineCode: 'L-01 KALOUM — MATOTO',
        vehicleType: 'MINIBUS_URBAIN',
        expiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000),
        qrPayload: 'AOTUC1.aotuc-2026-v1.LIC-2026-00188.TRANSPORT_LICENCE.v1.1770000000.1800000000.signature',
      });

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(1000);
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
    });

    it('should generate a valid PDF buffer for Secure Transport Ticket (74mm x 140mm thermal format)', async () => {
      const buffer = await PdfBadgeService.generateTicketPdf({
        ticketNumber: 'REC-2026-00042',
        routeName: 'L-01 KALOUM — MATOTO',
        departure: 'Gare Centrale de Kaloum',
        destination: 'Rond-Point de Matoto',
        fareGnf: 2000,
        paymentMethod: 'ORANGE_MONEY',
        paymentRef: 'OM-GN-2026-881920',
        buyerName: 'Mamadou Oury Bah',
        operatorName: 'Ousmane Sylla (Guichet Kaloum)',
        issuedAt: new Date(),
        status: 'PAYÉ & VALIDE',
        qrPayload: 'AOTUC-TICKET-REC-2026-00042',
      });

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(1000);
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
    });

    it('should stream ticket PDF via GET /api/v1/ticketing/sales/:id/pdf to authorized distributor', async () => {
      const res = await request(app)
        .get('/api/v1/ticketing/sales/rec-001/pdf')
        .set('Authorization', `Bearer ${distributorToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain('attachment; filename=');
      expect(res.body.length).toBeGreaterThan(500);
    });

    it('should reject unauthenticated request to /api/v1/ticketing/sales/:id/pdf with 401', async () => {
      const res = await request(app).get('/api/v1/ticketing/sales/rec-001/pdf');
      expect(res.statusCode).toBe(401);
    });
  });

  describe('2. Public QR Verification Engine (/api/v1/verification/verify)', () => {
    it('should verify authentic Ed25519 QR payload without authentication and return VALID', async () => {
      const issuedAt = new Date();
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      const signResult = CryptoSignatureService.signCredential({
        credentialId: 'CH-2026-VERIFY-OK',
        type: 'DRIVER_BADGE',
        targetId: 'drv-uuid-999',
        issuedAt,
        expiresAt,
      });

      const res = await request(app)
        .post('/api/v1/verification/verify')
        .send({ qrPayload: signResult.qrPayload });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('VALID');
      expect(res.body.credentialNumber).toBe('CH-2026-VERIFY-OK');
      expect(res.body).toHaveProperty('issuingAuthority');
      // Must not expose sensitive internal notes or NIN to public
      expect(res.body).not.toHaveProperty('nin');
      expect(res.body).not.toHaveProperty('internalNotes');
    });

    it('should reject tampered or corrupted Ed25519 signature with INVALID_SIGNATURE', async () => {
      const issuedAt = new Date();
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      const signResult = CryptoSignatureService.signCredential({
        credentialId: 'CH-2026-TAMPER',
        type: 'DRIVER_BADGE',
        targetId: 'drv-uuid-111',
        issuedAt,
        expiresAt,
      });

      // Tamper signature string
      const parts = signResult.qrPayload.split('.');
      parts[7] = 'tampered_corrupted_signature_payload';
      const tamperedQr = parts.join('.');

      const res = await request(app)
        .post('/api/v1/verification/verify')
        .send({ qrPayload: tamperedQr });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('INVALID_SIGNATURE');
    });

    it('should flag expired credentials with EXPIRED status', async () => {
      const issuedAt = new Date(Date.now() - 400 * 24 * 3600 * 1000);
      const expiresAt = new Date(Date.now() - 35 * 24 * 3600 * 1000); // Expired 35 days ago

      const signResult = CryptoSignatureService.signCredential({
        credentialId: 'CH-2025-EXPIRED',
        type: 'DRIVER_BADGE',
        targetId: 'drv-uuid-old',
        issuedAt,
        expiresAt,
      });

      const res = await request(app)
        .post('/api/v1/verification/verify')
        .send({ qrPayload: signResult.qrPayload });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('EXPIRED');
    });

    it('should detect revoked credentials with REVOKED status', async () => {
      const res = await request(app)
        .post('/api/v1/verification/verify')
        .send({ qrPayload: 'BDG-2025-00911' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('REVOKED');
      expect(res.body.message).toContain('révoqué');
    });

    it('should return NOT_FOUND for unknown credentials', async () => {
      const res = await request(app)
        .post('/api/v1/verification/verify')
        .send({ qrPayload: 'UNKNOWN-RANDOM-FAKE-1234' });

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('NOT_FOUND');
    });

    it('should reject empty verification payload with 400', async () => {
      const res = await request(app)
        .post('/api/v1/verification/verify')
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.status).toBe('INVALID_REQUEST');
    });
  });
});
