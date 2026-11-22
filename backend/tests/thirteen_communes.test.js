import request from 'supertest';
import { jest } from '@jest/globals';
import app from '../src/app.js';
import jwt from 'jsonwebtoken';
import config from '../src/config/index.js';
import prisma from '../src/utils/prisma.js';

describe('AOTUC — 13 Communes Administrative System Verification', () => {
  jest.setTimeout(45000);

  let superAdminUser;
  let superAdminToken;
  let allCommunes;

  beforeAll(async () => {
    // 1. Fetch Super Admin for authenticated tests
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
      throw new Error('Super Admin user required in DB for tests');
    }

    superAdminToken = jwt.sign(
      {
        sub: superAdminUser.id,
        email: superAdminUser.email,
        roles: ['SUPER_ADMIN'],
        permissions: ['*'],
        communeId: superAdminUser.communeId,
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '2h' }
    );

    allCommunes = await prisma.commune.findMany({
      orderBy: { code: 'asc' },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('1. Database must contain exactly 13 official communes', () => {
    expect(allCommunes.length).toBe(13);

    const codes = allCommunes.map((c) => c.code).sort();
    const expectedCodes = [
      'DXN', // Dixinn
      'GBS', // Gbessia
      'KGB', // Kagbélen
      'KLM', // Kaloum
      'KSS', // Kassa
      'LBN', // Lambanyi
      'MNH', // Manéah
      'MTM', // Matam
      'MTT', // Matoto
      'RTM', // Ratoma
      'SNF', // Sonfonia
      'SNY', // Sanoyah
      'TMB', // Tombolia
    ].sort();

    expect(codes).toEqual(expectedCodes);
  });

  test('2. All 6 original communes must have preserved their original data and relations', async () => {
    const originalCodes = ['KLM', 'DXN', 'MTM', 'RTM', 'MTT', 'KSS'];

    for (const code of originalCodes) {
      const commune = allCommunes.find((c) => c.code === code);
      expect(commune).toBeDefined();
      expect(commune.id).toBeTruthy();
      expect(commune.administrativeOrigin).toBeDefined();
      expect(commune.administrativeOrigin).toMatch(/Ancienne commune/);

      // Verify foreign key integrity
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

      expect(counts).toBeDefined();
      if (code === 'KLM') {
        expect(counts._count.persons).toBeGreaterThanOrEqual(9);
        expect(counts._count.validationRequests).toBeGreaterThanOrEqual(9);
      }
      if (code === 'MTT') {
        expect(counts._count.persons).toBeGreaterThanOrEqual(2);
        expect(counts._count.validationRequests).toBeGreaterThanOrEqual(3);
      }
    }
  });

  test('3. All 7 new communes must have their correct administrative origins recorded', () => {
    const newCommuneExpectations = [
      { code: 'GBS', name: 'Gbessia', origin: 'Nouvelle – détachée de Matoto' },
      { code: 'TMB', name: 'Tombolia', origin: 'Nouvelle – détachée de Matoto' },
      { code: 'LBN', name: 'Lambanyi', origin: 'Nouvelle – détachée de Ratoma' },
      { code: 'SNF', name: 'Sonfonia', origin: 'Nouvelle – détachée de Ratoma' },
      { code: 'KGB', name: 'Kagbélen', origin: 'Nouvelle – détachée de Matoto' },
      { code: 'SNY', name: 'Sanoyah', origin: 'Nouvelle – détachée de Matoto' },
      { code: 'MNH', name: 'Manéah', origin: 'Nouvelle – détachée de Matoto / Coyah' },
    ];

    for (const exp of newCommuneExpectations) {
      const found = allCommunes.find((c) => c.code === exp.code);
      expect(found).toBeDefined();
      expect(found.name).toBe(exp.name);
      expect(found.administrativeOrigin).toBe(exp.origin);
      expect(found.description).toBeTruthy();
    }
  });

  test('4. GET /api/v1/users/communes must return all 13 communes with administrativeOrigin', async () => {
    const res = await request(app)
      .get('/api/v1/users/communes')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(13);

    const lambanyi = res.body.data.find((c) => c.name === 'Lambanyi');
    expect(lambanyi).toBeDefined();
    expect(lambanyi.code).toBe('LBN');
    expect(lambanyi.administrativeOrigin).toBe('Nouvelle – détachée de Ratoma');

    const gbessia = res.body.data.find((c) => c.name === 'Gbessia');
    expect(gbessia).toBeDefined();
    expect(gbessia.code).toBe('GBS');
    expect(gbessia.administrativeOrigin).toBe('Nouvelle – détachée de Matoto');
  });

  test('5. GET /api/v1/sync/pull must include all 13 communes in offline catalog', async () => {
    const res = await request(app)
      .get('/api/v1/sync/pull')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.communes).toBeDefined();
    expect(res.body.data.communes.length).toBe(13);

    const codes = res.body.data.communes.map((c) => c.code);
    expect(codes).toContain('MNH');
    expect(codes).toContain('SNY');
    expect(codes).toContain('KGB');
    expect(codes).toContain('GBS');
    expect(codes).toContain('LBN');
    expect(codes).toContain('SNF');
    expect(codes).toContain('TMB');
  });

  test('6. Registration in a new commune (e.g. Gbessia) persists properly', async () => {
    const gbessia = allCommunes.find((c) => c.code === 'GBS');
    expect(gbessia).toBeDefined();

    const timestamp = Date.now().toString().slice(-6);
    const testNin = `NIN-GBS-${timestamp}`;
    const testPhone = `+224629${timestamp}`;

    const res = await request(app)
      .post('/api/v1/registration/drivers')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        firstName: 'Ibrahima',
        lastName: 'Diallo',
        nin: testNin,
        phoneNumber: testPhone,
        address: 'Carrefour Aéroport, Gbessia',
        communeId: gbessia.id,
        drivingLicenseNumber: `PERM-GBS-${timestamp}`,
        licenseCategory: 'B',
        licenseExpirationDate: '2030-01-01',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.person.communeId).toBe(gbessia.id);

    // Clean up created test driver
    const driverId = res.body.data.id;
    const personId = res.body.data.personId;

    await prisma.validationRequest.deleteMany({
      where: { targetEntityId: driverId },
    });
    await prisma.driver.delete({ where: { id: driverId } });
    await prisma.person.delete({ where: { id: personId } });
  });

  test('7. Field operations assignment supports new communes (e.g. Manéah)', async () => {
    const maneah = allCommunes.find((c) => c.code === 'MNH');
    expect(maneah).toBeDefined();

    const timestamp = Date.now().toString().slice(-5);
    const res = await request(app)
      .post('/api/v1/field-operations/assignments')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        reference: `ASN-MNH-${timestamp}`,
        title: 'Mission Enrôlement Gare Manéah',
        communeId: maneah.name, // Resolve by name
        locationName: 'Gare Routière Manéah',
        latitude: 9.695,
        longitude: -13.445,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
        targetPeople: 50,
        targetVehicles: 25,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.communeId).toBe(maneah.id);

    // Clean up created assignment
    await prisma.fieldAssignment.delete({
      where: { id: res.body.data.id },
    });
  });
});
