import jwt from 'jsonwebtoken';
import request from 'supertest';
import { jest } from '@jest/globals';
import app from '../src/app.js';
import config from '../src/config/index.js';
import prisma from '../src/utils/prisma.js';
import { PERMISSIONS } from '../src/config/permissions.js';

describe('Authorities Role & Payment Gated Printing Verification Suite', () => {
  jest.setTimeout(45000);

  let superAdminUser;
  let directorUser;
  let agentUser;
  let authorityUser;

  let superAdminToken;
  let directorToken;
  let agentToken;
  let authorityToken;

  const testSuffix = Date.now().toString().slice(-6);

  beforeAll(async () => {
    // 1. Fetch or resolve users for testing
    superAdminUser =
      (await prisma.user.findFirst({
        where: { email: { contains: 'admin' } },
      })) || (await prisma.user.findFirst());

    directorUser =
      (await prisma.user.findFirst({
        where: { email: { contains: 'directeur' } },
      })) || superAdminUser;

    agentUser =
      (await prisma.user.findFirst({
        where: { email: { contains: 'agent' } },
      })) || superAdminUser;

    superAdminToken = jwt.sign(
      {
        sub: superAdminUser.id,
        email: superAdminUser.email,
        phoneNumber: superAdminUser.phoneNumber,
        roles: ['SUPER_ADMIN'],
        permissions: [
          PERMISSIONS.USERS_CREATE,
          PERMISSIONS.USERS_READ,
          PERMISSIONS.USERS_UPDATE,
          PERMISSIONS.SYSTEM_SETTINGS_MANAGE,
          PERMISSIONS.ROLES_MANAGE,
          PERMISSIONS.AUTHORITIES_READ,
          PERMISSIONS.AUTHORITIES_CREATE,
          PERMISSIONS.AUTHORITIES_UPDATE,
          PERMISSIONS.AUTHORITIES_DELETE,
          PERMISSIONS.CREDENTIALS_READ,
        ],
        communeId: null,
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '30m' }
    );

    directorToken = jwt.sign(
      {
        sub: directorUser.id,
        email: directorUser.email,
        phoneNumber: directorUser.phoneNumber,
        roles: ['DIRECTOR'],
        permissions: [
          PERMISSIONS.CREDENTIALS_ISSUE,
          PERMISSIONS.CREDENTIALS_READ,
          PERMISSIONS.CREDENTIALS_VERIFY,
          PERMISSIONS.APPLICATIONS_APPROVE_L3,
          PERMISSIONS.APPLICATIONS_REVIEW_L2,
          PERMISSIONS.DRIVERS_READ,
          PERMISSIONS.DRIVERS_CREATE,
          PERMISSIONS.AUTHORITIES_READ,
          PERMISSIONS.AUTHORITIES_CREATE,
          PERMISSIONS.AUTHORITIES_UPDATE,
          PERMISSIONS.AUTHORITIES_DELETE,
          PERMISSIONS.FINANCIAL_REPORTS_READ,
          PERMISSIONS.SYSTEM_HEALTH_READ,
        ],
        communeId: null,
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '30m' }
    );

    agentToken = jwt.sign(
      {
        sub: agentUser.id,
        email: agentUser.email,
        phoneNumber: agentUser.phoneNumber,
        roles: ['AGENT_TERRAIN'],
        permissions: [
          PERMISSIONS.DRIVERS_CREATE,
          PERMISSIONS.DRIVERS_READ,
          PERMISSIONS.APPLICATIONS_SUBMIT,
        ],
        communeId: null,
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '30m' }
    );
  });

  describe('1. Authority Account Creation (Super Admin & Director)', () => {
    it('allows SUPER_ADMIN to register an AUTHORITY account', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          firstName: 'Ibrahima',
          lastName: `Ministre_${testSuffix}`,
          email: `ministre.sa.${testSuffix}@transports.gov.gn`,
          phoneNumber: `+224628${testSuffix}`,
          jobTitle: 'Ministre des Transports',
          role: 'AUTHORITY',
          password: 'Password@2026!',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.roles).toContain('AUTHORITY');
      authorityUser = res.body.data;

      // Generate authority token for subsequent tests
      authorityToken = jwt.sign(
        {
          sub: authorityUser.id,
          email: authorityUser.email,
          phoneNumber: authorityUser.phoneNumber,
          roles: ['AUTHORITY'],
          permissions: [
            PERMISSIONS.AUTHORITIES_READ,
            PERMISSIONS.FINANCIAL_REPORTS_READ,
            PERMISSIONS.SYSTEM_HEALTH_READ,
          ],
          communeId: null,
        },
        config.JWT_ACCESS_SECRET,
        { expiresIn: '30m' }
      );
    });

    it('allows DIRECTOR to register an AUTHORITY account', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({
          firstName: 'Fatoumata',
          lastName: `SecretaireGeneral_${testSuffix}`,
          email: `sg.dir.${testSuffix}@transports.gov.gn`,
          phoneNumber: `+224629${testSuffix}`,
          jobTitle: 'Secrétaire Général du Ministère',
          role: 'AUTHORITY',
          password: 'Password@2026!',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.roles).toContain('AUTHORITY');
    });

    it('blocks DIRECTOR from creating non-authority technical accounts (e.g. SUPER_ADMIN)', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({
          firstName: 'Unauthorized',
          lastName: `AdminAttempt_${testSuffix}`,
          email: `hack.admin.${testSuffix}@aotuc.test`,
          phoneNumber: `+224627${testSuffix}`,
          jobTitle: 'Admin',
          role: 'SUPER_ADMIN',
          password: 'Password@2026!',
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN_ROLE');
    });
  });

  describe('2. Authority Dashboard-Only Read-Only Access & Operational Isolation', () => {
    it('allows AUTHORITY to read Director dashboard statistics and KPIs', async () => {
      const res = await request(app)
        .get('/api/v1/authorities/kpis')
        .set('Authorization', `Bearer ${authorityToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('total');
      expect(res.body.data).toHaveProperty('active');
    });

    it('strictly blocks AUTHORITY from registering drivers (operational module)', async () => {
      const res = await request(app)
        .post('/api/v1/registration/drivers')
        .set('Authorization', `Bearer ${authorityToken}`)
        .send({
          firstName: 'Test',
          lastName: 'Driver',
        });

      expect(res.status).toBe(403);
    });

    it('strictly blocks AUTHORITY from issuing credentials', async () => {
      const res = await request(app)
        .post('/api/v1/badges/issue')
        .set('Authorization', `Bearer ${authorityToken}`)
        .send({ driverId: 'some-id' });

      expect(res.status).toBe(403);
    });

    it('strictly blocks AUTHORITY from creating user accounts', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${authorityToken}`)
        .send({
          firstName: 'Illegal',
          lastName: 'User',
          role: 'AUTHORITY',
        });

      expect(res.status).toBe(403);
    });

    it('strictly blocks AUTHORITY from ticketing POS operations', async () => {
      const res = await request(app)
        .post('/api/v1/ticketing/sales')
        .set('Authorization', `Bearer ${authorityToken}`)
        .send({ amount: 2000 });

      expect(res.status).toBe(403);
    });
  });

  describe('3. Driver Badge Payment Gate & Separation', () => {
    let testDriver;

    beforeAll(async () => {
      // Create a test person and driver with isPaymentConfirmed = false
      const person = await prisma.person.create({
        data: {
          firstName: 'Mamadou',
          lastName: `Chauffeur_${testSuffix}`,
          nin: `NIN-DRV-${testSuffix}`,
          phoneNumber: `+224621${testSuffix}`,
          dateOfBirth: new Date('1990-05-15'),
        },
      });

      testDriver = await prisma.driver.create({
        data: {
          personId: person.id,
          drivingLicenseNumber: `DL-GN-${testSuffix}`,
          licenseCategory: 'B',
          licenseExpirationDate: new Date('2029-01-01'),
          status: 'ACTIF',
          isPaymentConfirmed: false, // Unpaid driver
        },
      });
    });

    it('refuses to issue driver badge when payment has not been confirmed', async () => {
      const res = await request(app)
        .post('/api/v1/badges/issue')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ driverId: testDriver.id });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('PAYMENT_NOT_CONFIRMED');
    });

    it('allows confirming driver payment via the dedicated endpoint', async () => {
      const res = await request(app)
        .post(`/api/v1/badges/drivers/${testDriver.id}/confirm-payment`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ paymentReference: `REC-OM-${testSuffix}` });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isPaymentConfirmed).toBe(true);
    });

    it('successfully issues driver badge once payment is confirmed', async () => {
      const res = await request(app)
        .post('/api/v1/badges/issue')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ driverId: testDriver.id });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isPaymentConfirmed).toBe(true);
      expect(res.body.data.badgeNumber).toMatch(/^CH-\d{4}-[A-Z0-9]+$/);
    });
  });

  describe('4. Vehicle Sticker Payment Gate & Super Admin Confirmation', () => {
    let testVehicle;

    beforeAll(async () => {
      const person = await prisma.person.create({
        data: {
          firstName: 'Ousmane',
          lastName: `Proprio_${testSuffix}`,
          nin: `NIN-OWN-${testSuffix}`,
          phoneNumber: `+224622${testSuffix}`,
        },
      });

      const owner = await prisma.owner.create({
        data: {
          personId: person.id,
        },
      });

      testVehicle = await prisma.vehicle.create({
        data: {
          ownerId: owner.id,
          plateNumber: `RC-${testSuffix}-A`,
          registrationCardNumber: `CG-${testSuffix}`,
          chassisVin: `VIN-${testSuffix}-ABC`,
          vehicleType: 'TAXI_COLLECTIF',
          make: 'Toyota',
          model: 'Corolla',
          status: 'ACTIF',
          isPaymentConfirmed: false,
          superAdminConfirmed: false, // Not confirmed by Super Admin yet
        },
      });

      // Add a conforming vehicle inspection so inspection check passes
      await prisma.vehicleInspection.create({
        data: {
          vehicleId: testVehicle.id,
          inspectionCenter: 'Contrôle Technique Conakry',
          certificateNumber: `CERT-${testSuffix}`,
          inspectionDate: new Date(),
          expirationDate: new Date(Date.now() + 365 * 24 * 3600 * 1000),
          isConform: true,
        },
      });
    });

    it('refuses to issue vehicle sticker licence without Super Admin payment confirmation', async () => {
      const res = await request(app)
        .post('/api/v1/licences/issue')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ vehicleId: testVehicle.id });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('SUPER_ADMIN_PAYMENT_CONFIRMATION_REQUIRED');
    });

    it('blocks non-Super Admin from confirming vehicle payment', async () => {
      const res = await request(app)
        .post(`/api/v1/licences/vehicles/${testVehicle.id}/confirm-payment`)
        .set('Authorization', `Bearer ${agentToken}`)
        .send({ paymentReference: `PAY-V-${testSuffix}` });

      expect(res.status).toBe(403);
    });

    it('allows SUPER_ADMIN to confirm vehicle registration payment', async () => {
      const res = await request(app)
        .post(`/api/v1/licences/vehicles/${testVehicle.id}/confirm-payment`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ paymentReference: `SUPER-ADMIN-PAY-${testSuffix}` });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isPaymentConfirmed).toBe(true);
      expect(res.body.data.superAdminConfirmed).toBe(true);
    });

    it('successfully issues vehicle licence sticker once confirmed by Super Admin', async () => {
      const res = await request(app)
        .post('/api/v1/licences/issue')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ vehicleId: testVehicle.id });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isPaymentConfirmed).toBe(true);
      expect(res.body.data.licenceNumber).toMatch(/^LIC-\d{4}-[A-Z0-9]+$/);
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
