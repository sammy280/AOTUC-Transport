import request from 'supertest';
import { jest } from '@jest/globals';
import app from '../src/app.js';
import jwt from 'jsonwebtoken';
import config from '../src/config/index.js';
import CryptoSignatureService from '../src/services/cryptoSignatureService.js';
import PdfBadgeService from '../src/services/pdfBadgeService.js';
import prisma from '../src/utils/prisma.js';

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

  describe('4. End-to-End Chauffeur Enrolment, Dossier Approval, Badge Visibility, Validation, Payment Gate & Rejection Workflow', () => {
    jest.setTimeout(45000);

    const suffix = Date.now().toString().slice(-6);
    let matotoCommune;
    let agentDbUser;
    let chefDbUser;
    let directorDbUser;
    let superAdminDbUser;

    let realAgentToken;
    let realChefToken;
    let realDirectorToken;
    let realSuperAdminToken;

    let enrolledDriverId = null;
    let enrolledPersonId = null;
    let validationRequestId = null;
    let issuedBadgeId = null;

    beforeAll(async () => {
      matotoCommune =
        (await prisma.commune.findFirst({ where: { code: 'MTT' } })) ||
        (await prisma.commune.findFirst());

      agentDbUser =
        (await prisma.user.findFirst({ where: { email: 'agent.matoto@aotuc.test' } })) ||
        (await prisma.user.findFirst());

      chefDbUser =
        (await prisma.user.findFirst({ where: { email: 'chef.matoto@aotuc.test' } })) ||
        agentDbUser;

      directorDbUser =
        (await prisma.user.findFirst({ where: { email: 'directeur@aotuc.test' } })) ||
        agentDbUser;

      superAdminDbUser =
        (await prisma.user.findFirst({ where: { email: 'superadmin@aotuc.test' } })) ||
        agentDbUser;

      realAgentToken = jwt.sign(
        { sub: agentDbUser.id, roles: ['AGENT_TERRAIN'], communeId: matotoCommune.id },
        config.JWT_ACCESS_SECRET,
        { expiresIn: '30m' }
      );

      realChefToken = jwt.sign(
        { sub: chefDbUser.id, roles: ['CHEF_SERVICE'], communeId: matotoCommune.id },
        config.JWT_ACCESS_SECRET,
        { expiresIn: '30m' }
      );

      realDirectorToken = jwt.sign(
        { sub: directorDbUser.id, roles: ['DIRECTOR'], communeId: null },
        config.JWT_ACCESS_SECRET,
        { expiresIn: '30m' }
      );

      realSuperAdminToken = jwt.sign(
        { sub: superAdminDbUser.id, roles: ['SUPER_ADMIN'], communeId: null },
        config.JWT_ACCESS_SECRET,
        { expiresIn: '30m' }
      );
    });

    afterAll(async () => {
      try {
        if (enrolledDriverId) {
          await prisma.credentialRevocation.deleteMany({
            where: { serialNumber: { contains: suffix } },
          });
          await prisma.driverBadge.deleteMany({ where: { driverId: enrolledDriverId } });
          await prisma.validationRequest.deleteMany({
            where: { targetEntityId: enrolledDriverId },
          });
          await prisma.driver.deleteMany({ where: { id: enrolledDriverId } });
        }
        if (enrolledPersonId) {
          await prisma.person.deleteMany({ where: { id: enrolledPersonId } });
        }
      } catch (_) {}
      await prisma.$disconnect();
    });

    it('Step 1: Enrols a chauffeur and immediately displays them in the badge management list with clear non-eligible dossier reason', async () => {
      const enrolRes = await request(app)
        .post('/api/v1/registration/drivers')
        .set('Authorization', `Bearer ${realAgentToken}`)
        .send({
          firstName: 'Souleymane',
          lastName: `BadgeTest_${suffix}`,
          nin: `NIN-BDG-${suffix}`,
          phoneNumber: `+224625${suffix}`,
          drivingLicenseNumber: `PC-BDG-${suffix}`,
          licenseCategory: 'B',
          licenseExpirationDate: '2029-12-31',
          communeId: matotoCommune.id,
        });

      expect(enrolRes.status).toBe(201);
      enrolledDriverId = enrolRes.body.data.id;
      enrolledPersonId = enrolRes.body.data.personId;

      const valReq = await prisma.validationRequest.findFirst({
        where: { targetEntityId: enrolledDriverId, entityType: 'DRIVER_ENROLMENT' },
      });
      expect(valReq).toBeDefined();
      validationRequestId = valReq.id;

      // Verify chauffeur appears in GET /api/v1/badges with NON_ELIGIBLE_DOSSIER status
      const listRes = await request(app)
        .get(`/api/v1/badges?search=BadgeTest_${suffix}`)
        .set('Authorization', `Bearer ${realDirectorToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBe(1);
      const item = listRes.body.data[0];
      expect(item.driverId).toBe(enrolledDriverId);
      expect(item.badgeWorkflowStatus).toBe('NON_ELIGIBLE_DOSSIER');
      expect(item.isEligibleForValidation).toBe(false);
      expect(item.canPrint).toBe(false);
      expect(item.eligibilityReason).toMatch(/attente de validation préalable par le Chef des Agents/i);
    });

    it('Step 2: Blocks badge validation while the chauffeur dossier has not yet been approved by the Chef des Agents', async () => {
      const valRes = await request(app)
        .post(`/api/v1/badges/drivers/${enrolledDriverId}/validate`)
        .set('Authorization', `Bearer ${realDirectorToken}`)
        .send({});

      expect(valRes.status).toBe(400);
      expect(valRes.body.code).toBe('DRIVER_NOT_ELIGIBLE');
    });

    it('Step 3: Chef des Agents approves the chauffeur dossier, making the chauffeur eligible for badge validation', async () => {
      const approveDossierRes = await request(app)
        .post(`/api/v1/validation/requests/${validationRequestId}/transition`)
        .set('Authorization', `Bearer ${realChefToken}`)
        .send({
          action: 'APPROVE_FINAL',
          comment: 'Dossier chauffeur complet et conforme pour émission du badge.',
        });

      expect(approveDossierRes.status).toBe(200);
      expect(approveDossierRes.body.data.currentStatus).toBe('VALIDE');

      // Now check GET /api/v1/badges/drivers/:id
      const detailRes = await request(app)
        .get(`/api/v1/badges/drivers/${enrolledDriverId}`)
        .set('Authorization', `Bearer ${realDirectorToken}`);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.data.isDossierApproved).toBe(true);
      expect(detailRes.body.data.badgeWorkflowStatus).toBe('EN_ATTENTE_VALIDATION');
      expect(detailRes.body.data.isEligibleForValidation).toBe(true);
      expect(detailRes.body.data.canPrint).toBe(false);
    });

    it('Step 4: Enforces payment restriction — unpaid chauffeur cannot have badge validated until payment is confirmed', async () => {
      await prisma.driver.update({
        where: { id: enrolledDriverId },
        data: { isPaymentConfirmed: false },
      });

      const unpaidDetail = await request(app)
        .get(`/api/v1/badges/drivers/${enrolledDriverId}`)
        .set('Authorization', `Bearer ${realDirectorToken}`);
      expect(unpaidDetail.body.data.badgeWorkflowStatus).toBe('ATTENTE_PAIEMENT');

      const blockedValidate = await request(app)
        .post(`/api/v1/badges/drivers/${enrolledDriverId}/validate`)
        .set('Authorization', `Bearer ${realDirectorToken}`)
        .send({});
      expect(blockedValidate.status).toBe(400);
      expect(blockedValidate.body.code).toBe('PAYMENT_NOT_CONFIRMED');

      // Confirm payment
      const payRes = await request(app)
        .post(`/api/v1/badges/drivers/${enrolledDriverId}/confirm-payment`)
        .set('Authorization', `Bearer ${realSuperAdminToken}`)
        .send({ paymentReference: `PAY-TEST-${suffix}` });
      expect(payRes.status).toBe(200);
      expect(payRes.body.record.badgeWorkflowStatus).toBe('EN_ATTENTE_VALIDATION');
    });

    it('Step 5: Blocks unauthorized roles (AGENT_TERRAIN and SUPER_ADMIN) from validating or rejecting badges', async () => {
      const agentTry = await request(app)
        .post(`/api/v1/badges/drivers/${enrolledDriverId}/validate`)
        .set('Authorization', `Bearer ${realAgentToken}`)
        .send({});
      expect(agentTry.status).toBe(403);

      const superAdminTry = await request(app)
        .post(`/api/v1/badges/drivers/${enrolledDriverId}/validate`)
        .set('Authorization', `Bearer ${realSuperAdminToken}`)
        .send({});
      expect(superAdminTry.status).toBe(403);
    });

    it('Step 6: Authorized role validates the badge, persists Ed25519 signature, and unlocks PDF download', async () => {
      const validateRes = await request(app)
        .post(`/api/v1/badges/drivers/${enrolledDriverId}/validate`)
        .set('Authorization', `Bearer ${realDirectorToken}`)
        .send({ comment: 'Badge validé après contrôle complet.' });

      expect(validateRes.status).toBe(200);
      expect(validateRes.body.data.badgeWorkflowStatus).toBe('VALIDE');
      expect(validateRes.body.data.status).toBe('ACTIF');
      expect(validateRes.body.data.hasIssuedBadge).toBe(true);
      expect(validateRes.body.data.canPrint).toBe(true);
      expect(validateRes.body.data.badgeNumber).toMatch(/^CH-\d{4}-[A-F0-9]+$/);
      issuedBadgeId = validateRes.body.data.badgeId;

      // Verify state remains persisted after refreshing
      const refreshRes = await request(app)
        .get(`/api/v1/badges/drivers/${enrolledDriverId}`)
        .set('Authorization', `Bearer ${realChefToken}`);
      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.data.badgeWorkflowStatus).toBe('VALIDE');
      expect(refreshRes.body.data.badgeId).toBe(issuedBadgeId);
      expect(refreshRes.body.data.validationHistory.length).toBeGreaterThanOrEqual(2);

      // Verify printable PDF download succeeds
      const pdfRes = await request(app)
        .get(`/api/v1/badges/${issuedBadgeId}/pdf`)
        .set('Authorization', `Bearer ${realDirectorToken}`);
      expect(pdfRes.status).toBe(200);
      expect(pdfRes.headers['content-type']).toContain('application/pdf');
    });

    it('Step 7: Enforces mandatory explanation when rejecting a badge and persists rejection history', async () => {
      const missingReasonRes = await request(app)
        .post(`/api/v1/badges/drivers/${enrolledDriverId}/reject`)
        .set('Authorization', `Bearer ${realChefToken}`)
        .send({ reason: 'non' });
      expect(missingReasonRes.status).toBe(400);
      expect(missingReasonRes.body.code).toBe('REASON_REQUIRED');

      const validRejectRes = await request(app)
        .post(`/api/v1/badges/drivers/${enrolledDriverId}/reject`)
        .set('Authorization', `Bearer ${realChefToken}`)
        .send({ reason: 'Anomalie constatée sur la catégorie du permis lors du contrôle final.' });

      expect(validRejectRes.status).toBe(200);
      expect(validRejectRes.body.data.badgeWorkflowStatus).toBe('REJETE');
      expect(validRejectRes.body.data.canPrint).toBe(false);
      expect(validRejectRes.body.data.rejectionReason).toContain('Anomalie constatée');
    });
  });
});
