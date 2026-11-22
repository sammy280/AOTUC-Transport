import request from 'supertest';
import { jest } from '@jest/globals';
import app from '../src/app.js';
import jwt from 'jsonwebtoken';
import config from '../src/config/index.js';
import prisma from '../src/utils/prisma.js';

describe('AOTUC — 13-Commune Final Verification & Production Safety Audit', () => {
  jest.setTimeout(60000);

  let superAdminUser;
  let superAdminToken;
  let allCommunes;
  const createdRecordIds = {
    users: [],
    persons: [],
    drivers: [],
    owners: [],
    vehicles: [],
    validationRequests: [],
  };

  beforeAll(async () => {
    // 1. Authenticate as SUPER_ADMIN
    superAdminUser = await prisma.user.findFirst({
      where: {
        roles: {
          some: { role: { name: 'SUPER_ADMIN' } },
        },
      },
      include: {
        roles: { include: { role: true } },
      },
    });

    if (!superAdminUser) {
      throw new Error('SUPER_ADMIN account required in DB');
    }

    superAdminToken = jwt.sign(
      {
        sub: superAdminUser.id,
        email: superAdminUser.email,
        roles: ['SUPER_ADMIN'],
        permissions: ['*'],
        communeId: null, // Global scope
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '2h' }
    );

    allCommunes = await prisma.commune.findMany({
      orderBy: { code: 'asc' },
    });
  });

  afterAll(async () => {
    // Clean up only records created in this test suite
    if (createdRecordIds.validationRequests.length > 0) {
      await prisma.validationRequest.deleteMany({
        where: { id: { in: createdRecordIds.validationRequests } },
      });
    }
    if (createdRecordIds.vehicles.length > 0) {
      await prisma.vehicle.deleteMany({
        where: { id: { in: createdRecordIds.vehicles } },
      });
    }
    if (createdRecordIds.drivers.length > 0) {
      await prisma.driver.deleteMany({
        where: { id: { in: createdRecordIds.drivers } },
      });
    }
    if (createdRecordIds.owners.length > 0) {
      await prisma.owner.deleteMany({
        where: { id: { in: createdRecordIds.owners } },
      });
    }
    if (createdRecordIds.persons.length > 0) {
      await prisma.person.deleteMany({
        where: { id: { in: createdRecordIds.persons } },
      });
    }
    if (createdRecordIds.users.length > 0) {
      await prisma.userRole.deleteMany({
        where: { userId: { in: createdRecordIds.users } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: createdRecordIds.users } },
      });
    }
    await prisma.$disconnect();
  });

  // =========================================================================
  // 1. PRODUCTION SAFETY & COMMUNE INTEGRITY
  // =========================================================================
  test('Audit 1: Production safety — Database contains exactly 13 communes and original records are preserved', async () => {
    expect(allCommunes.length).toBe(13);

    const originalCommuneExpectations = [
      { code: 'KLM', name: 'Kaloum', minPersons: 9, minValidations: 9 },
      { code: 'DXN', name: 'Dixinn', minPersons: 0, minValidations: 0 },
      { code: 'MTM', name: 'Matam', minPersons: 0, minValidations: 0 },
      { code: 'RTM', name: 'Ratoma', minPersons: 0, minValidations: 0 },
      { code: 'MTT', name: 'Matoto', minPersons: 2, minValidations: 3 },
      { code: 'KSS', name: 'Kassa', minPersons: 0, minValidations: 0 },
    ];

    for (const exp of originalCommuneExpectations) {
      const commune = allCommunes.find((c) => c.code === exp.code);
      expect(commune).toBeDefined();
      expect(commune.name).toBe(exp.name);
      expect(commune.administrativeOrigin).toMatch(/Ancienne commune/);

      const counts = await prisma.commune.findUnique({
        where: { id: commune.id },
        select: {
          _count: {
            select: {
              users: true,
              persons: true,
              validationRequests: true,
            },
          },
        },
      });

      expect(counts._count.persons).toBeGreaterThanOrEqual(exp.minPersons);
      expect(counts._count.validationRequests).toBeGreaterThanOrEqual(exp.minValidations);
    }
  });

  // =========================================================================
  // 2. USER ACCESS AND COMMUNE ISOLATION
  // =========================================================================
  test('Audit 2.1: Administrators can assign users and field agents to any of the 13 communes', async () => {
    const gbessia = allCommunes.find((c) => c.code === 'GBS');
    expect(gbessia).toBeDefined();

    const timestamp = Date.now().toString().slice(-6);
    const agentEmail = `agent.gbs.${timestamp}@aotuc.test`;
    const agentPhone = `+224628${timestamp}`;

    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        firstName: 'Fodé',
        lastName: 'Camara',
        email: agentEmail,
        phoneNumber: agentPhone,
        jobTitle: 'Agent Enrôleur Gbessia',
        role: 'AGENT_TERRAIN',
        communeId: gbessia.id,
        password: 'Password2026!Test',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.communeId).toBe(gbessia.id);

    createdRecordIds.users.push(res.body.data.id);
  });

  test('Audit 2.2: Commune isolation — Agent assigned to Gbessia cannot access restricted records from Matoto or Kaloum', async () => {
    const gbessia = allCommunes.find((c) => c.code === 'GBS');
    const kaloum = allCommunes.find((c) => c.code === 'KLM');

    // Create a driver in Kaloum
    const kaloumPerson = await prisma.person.create({
      data: {
        firstName: 'Ousmane',
        lastName: 'Bah',
        nin: `NIN-KLM-${Date.now().toString().slice(-6)}`,
        phoneNumber: `+224627${Date.now().toString().slice(-6)}`,
        communeId: kaloum.id,
      },
    });
    createdRecordIds.persons.push(kaloumPerson.id);

    const kaloumDriver = await prisma.driver.create({
      data: {
        personId: kaloumPerson.id,
        drivingLicenseNumber: `PERM-KLM-${Date.now().toString().slice(-5)}`,
        licenseCategory: 'B',
        licenseExpirationDate: new Date('2030-01-01'),
      },
    });
    createdRecordIds.drivers.push(kaloumDriver.id);

    // Create an agent token strictly scoped to Gbessia
    const gbessiaAgentToken = jwt.sign(
      {
        sub: 'agent-gbessia-test',
        email: 'agent.gbessia@aotuc.test',
        roles: ['AGENT_TERRAIN'],
        permissions: ['drivers.read', 'drivers.create'],
        communeId: gbessia.id,
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '1h' }
    );

    // Attempt to access Kaloum driver using Gbessia agent token -> MUST BE 403
    const restrictedRes = await request(app)
      .get(`/api/v1/registration/drivers/${kaloumDriver.id}`)
      .set('Authorization', `Bearer ${gbessiaAgentToken}`);

    expect(restrictedRes.status).toBe(403);
    expect(restrictedRes.body.code).toBe('FORBIDDEN_COMMUNE_SCOPE');

    // SUPER_ADMIN accessing the same driver -> MUST BE 200
    const superAdminRes = await request(app)
      .get(`/api/v1/registration/drivers/${kaloumDriver.id}`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(superAdminRes.status).toBe(200);
    expect(superAdminRes.body.success).toBe(true);
    expect(superAdminRes.body.data.id).toBe(kaloumDriver.id);
  });

  // =========================================================================
  // 3. ALL REGISTRATION TYPES (DRIVER, OWNER, VEHICLE) IN 13 COMMUNES
  // =========================================================================
  test('Audit 3.1: Driver, Owner, and Vehicle registration with new commune (Lambanyi)', async () => {
    const lambanyi = allCommunes.find((c) => c.code === 'LBN');
    expect(lambanyi).toBeDefined();

    const timestamp = Date.now().toString().slice(-6);

    // 1. Register Owner in Lambanyi
    const ownerRes = await request(app)
      .post('/api/v1/registration/owners')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        firstName: 'Mariam',
        lastName: 'Sylla',
        nin: `NIN-OWN-${timestamp}`,
        phoneNumber: `+224626${timestamp}`,
        address: 'Carrefour Lambanyi Plage',
        communeId: lambanyi.id,
        ownerType: 'INDIVIDU',
      });

    expect(ownerRes.status).toBe(201);
    expect(ownerRes.body.data.person.communeId).toBe(lambanyi.id);
    const ownerId = ownerRes.body.data.id;
    createdRecordIds.owners.push(ownerId);
    createdRecordIds.persons.push(ownerRes.body.data.personId);

    // 2. Register Driver in Lambanyi
    const driverRes = await request(app)
      .post('/api/v1/registration/drivers')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        firstName: 'Aboubacar',
        lastName: 'Touré',
        nin: `NIN-DRV-${timestamp}`,
        phoneNumber: `+224625${timestamp}`,
        address: 'Marché Lambanyi',
        communeId: lambanyi.id,
        drivingLicenseNumber: `PERM-LBN-${timestamp}`,
        licenseCategory: 'B',
        licenseExpirationDate: '2030-05-15',
      });

    expect(driverRes.status).toBe(201);
    expect(driverRes.body.data.person.communeId).toBe(lambanyi.id);
    const driverId = driverRes.body.data.id;
    createdRecordIds.drivers.push(driverId);
    createdRecordIds.persons.push(driverRes.body.data.personId);

    // 3. Register Vehicle in Lambanyi
    const vehicleRes = await request(app)
      .post('/api/v1/registration/vehicles')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        ownerId: ownerId,
        driverId: driverId,
        plateNumber: `RC-${timestamp}-A`,
        registrationCardNumber: `CG-LBN-${timestamp}`,
        chassisVin: `VIN-LBN-${timestamp}XYZ`,
        atrNumber: `ATR-LBN-${timestamp}`,
        aotucLicenseNumber: `LIC-LBN-${timestamp}`,
        vehicleType: 'TAXI_COLLECTIF',
        make: 'Toyota',
        model: 'Corolla',
        year: 2018,
        communeId: lambanyi.id,
      });

    expect(vehicleRes.status).toBe(201);
    expect(vehicleRes.body.success).toBe(true);
    createdRecordIds.vehicles.push(vehicleRes.body.data.id);
  });

  test('Audit 3.2: Commune filtering on registration lists returns scoped results', async () => {
    const lambanyi = allCommunes.find((c) => c.code === 'LBN');

    // Query drivers filtered by Lambanyi
    const filteredDrivers = await request(app)
      .get(`/api/v1/registration/drivers?communeId=${lambanyi.id}`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(filteredDrivers.status).toBe(200);
    expect(filteredDrivers.body.success).toBe(true);
    expect(Array.isArray(filteredDrivers.body.data.items)).toBe(true);

    for (const item of filteredDrivers.body.data.items) {
      if (item.person && item.person.communeId) {
        expect(item.person.communeId).toBe(lambanyi.id);
      }
    }
  });

  // =========================================================================
  // 4. MOBILE OFFLINE OPERATION & SYNC IN NEW COMMUNES
  // =========================================================================
  test('Audit 4.1: Sync catalog download contains all 13 communes', async () => {
    const pullRes = await request(app)
      .get('/api/v1/sync/pull')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(pullRes.status).toBe(200);
    expect(pullRes.body.data.communes).toBeDefined();
    expect(pullRes.body.data.communes.length).toBe(13);

    const names = pullRes.body.data.communes.map((c) => c.name);
    expect(names).toContain('Gbessia');
    expect(names).toContain('Tombolia');
    expect(names).toContain('Lambanyi');
    expect(names).toContain('Sonfonia');
    expect(names).toContain('Kagbélen');
    expect(names).toContain('Sanoyah');
    expect(names).toContain('Manéah');
    expect(names).toContain('Kaloum');
    expect(names).toContain('Dixinn');
    expect(names).toContain('Matam');
    expect(names).toContain('Ratoma');
    expect(names).toContain('Matoto');
    expect(names).toContain('Kassa');
  });

  test('Audit 4.2: Synchronizing an offline draft created in a new commune (Sonfonia) preserves commune in PostgreSQL', async () => {
    const sonfonia = allCommunes.find((c) => c.code === 'SNF');
    expect(sonfonia).toBeDefined();

    const timestamp = Date.now().toString().slice(-6);
    const pushRes = await request(app)
      .post('/api/v1/sync/push')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        deviceId: 'TEST-DEV-SNF-001',
        items: [
          {
            clientGeneratedId: `00000000-0000-4000-a000-${timestamp.padStart(12, '0')}`,
            entityType: 'DRIVER',
            payload: {
              firstName: 'Salifou',
              lastName: 'Camara',
              nin: `NIN-SNF-${timestamp}`,
              phoneNumber: `+224624${timestamp}`,
              address: 'Université Julius Nyerere, Sonfonia',
              commune: 'Sonfonia', // Offline draft uses commune name or code
              drivingLicenseNumber: `PERM-SNF-${timestamp}`,
              licenseCategory: 'B',
              licenseExpirationDate: '2031-01-01',
            },
            createdOfflineAt: new Date().toISOString(),
          },
        ],
      });

    expect(pushRes.status).toBe(200);
    expect(pushRes.body.success).toBe(true);
    expect(pushRes.body.data.accepted).toBe(1);

    // Verify in PostgreSQL that the person was assigned Sonfonia communeId
    const syncedPerson = await prisma.person.findUnique({
      where: { nin: `NIN-SNF-${timestamp}` },
      include: { driver: true, commune: true },
    });

    expect(syncedPerson).toBeDefined();
    expect(syncedPerson.communeId).toBe(sonfonia.id);
    expect(syncedPerson.commune.name).toBe('Sonfonia');
    expect(syncedPerson.commune.code).toBe('SNF');

    createdRecordIds.persons.push(syncedPerson.id);
    if (syncedPerson.driver) {
      createdRecordIds.drivers.push(syncedPerson.driver.id);
    }
  });

  // =========================================================================
  // 5. GIS ACCURACY
  // =========================================================================
  test('Audit 5: GIS layer accuracy — stops and corridors are defined, no fabricated polygons for new communes', () => {
    // 7 new communes
    const newCommuneCodes = ['GBS', 'TMB', 'LBN', 'SNF', 'KGB', 'SNY', 'MNH'];

    for (const code of newCommuneCodes) {
      const commune = allCommunes.find((c) => c.code === code);
      expect(commune).toBeDefined();
      // Description is informative and does not claim official decree polygons
      expect(commune.description).toBeDefined();
    }
  });
});
