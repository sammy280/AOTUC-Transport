import request from 'supertest';
import { jest } from '@jest/globals';
import crypto from 'crypto';
import app from '../src/app.js';
import jwt from 'jsonwebtoken';
import config from '../src/config/index.js';
import prisma from '../src/utils/prisma.js';

describe('AOTUC — Syndicat Management: Additional Identity Fields Audit Suite', () => {
  jest.setTimeout(60000);

  let superAdminUser;
  let superAdminToken;
  let unauthorizedToken;
  let restrictedAgentToken;
  let kaloumCommune;
  let matotoCommune;

  const createdUnionIds = [];
  const createdDocumentIds = [];

  // Minimal valid JPEG binary buffer (with authentic magic bytes FF D8 FF)
  const validJpegBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
    0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0xff, 0xd9,
  ]);
  const validJpegBase64 = `data:image/jpeg;base64,${validJpegBuffer.toString('base64')}`;

  beforeAll(async () => {
    // 1. Get SUPER_ADMIN user
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

    // 2. Communes
    kaloumCommune = await prisma.commune.findFirst({ where: { code: 'KLM' } });
    matotoCommune = await prisma.commune.findFirst({ where: { code: 'MTT' } });

    // 3. Restricted Agent scoped strictly to Matoto
    restrictedAgentToken = jwt.sign(
      {
        sub: '00000000-0000-0000-0000-000000000001',
        email: 'agent.matoto@transport.gn',
        roles: ['AGENT_TERRAIN'],
        permissions: ['unions:read', 'documents:upload'],
        communeId: matotoCommune?.id || '472c8f3d-3f1c-4272-a4ef-ecacfb8ca57e',
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '2h' }
    );

    // 4. Token without UNIONS permissions
    unauthorizedToken = jwt.sign(
      {
        sub: '00000000-0000-0000-0000-000000000002',
        email: 'nobody@transport.gn',
        roles: ['CITOYEN'],
        permissions: ['tickets:buy'],
        communeId: null,
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '2h' }
    );
  });

  afterAll(async () => {
    // Clean up created test documents and unions
    if (createdDocumentIds.length > 0) {
      await prisma.document.deleteMany({
        where: { id: { in: createdDocumentIds } },
      });
    }

    if (createdUnionIds.length > 0) {
      await prisma.document.deleteMany({
        where: { unionId: { in: createdUnionIds } },
      });
      await prisma.transportUnion.deleteMany({
        where: { id: { in: createdUnionIds } },
      });
    }
  });

  // TEST 1: Creation with fonction, portrait photo, and CNI documents
  test('1. Create TransportUnion with Fonction, Photo Portrait, and CNI (Recto & Verso)', async () => {
    const uniqueSuffix = Date.now().toString().slice(-6);
    const payload = {
      code: `SYND-${uniqueSuffix}`,
      name: `Syndicat Autonome des Transporteurs ${uniqueSuffix}`,
      registrationNumber: `AGR-${uniqueSuffix}-GN`,
      presidentName: 'Elhadj Ousmane Diallo',
      fonction: 'Secrétaire général', // FIELD A: FONCTION
      cniNumber: `CNI-2026-GN-${uniqueSuffix}`,
      contactPhone: '+224 621 11 22 33',
      contactEmail: `contact.synd${uniqueSuffix}@syndicat.gn`,
      headquartersAddress: 'Madina Marché, Matam, Conakry',
      communeId: kaloumCommune ? kaloumCommune.id : null,
      status: 'ACTIF',
      documents: [
        {
          category: 'PHOTO_PORTRAIT', // FIELD B: PHOTO D'IDENTITÉ
          originalName: 'portrait_secretaire_general.jpg',
          mimeType: 'image/jpeg',
          base64Data: validJpegBase64,
        },
        {
          category: 'CNI_RECTO', // FIELD C: CARTE D'IDENTITÉ RECTO
          originalName: 'cni_face_recto.jpg',
          mimeType: 'image/jpeg',
          base64Data: validJpegBase64,
        },
        {
          category: 'CNI_VERSO', // FIELD C: CARTE D'IDENTITÉ VERSO
          originalName: 'cni_face_verso.jpg',
          mimeType: 'image/jpeg',
          base64Data: validJpegBase64,
        },
      ],
    };

    const res = await request(app)
      .post('/api/v1/unions')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();

    const created = res.body.data;
    createdUnionIds.push(created.id);

    // Verify fields in API response
    expect(created.code).toBe(payload.code);
    expect(created.fonction).toBe('Secrétaire général');
    expect(created.cniNumber).toBe(payload.cniNumber);
    expect(created.presidentName).toBe('Elhadj Ousmane Diallo');
    expect(created.photoUrl).toMatch(/^\/api\/v1\/documents\/[0-9a-f-]+\/stream$/);

    // Verify PostgreSQL persistence directly
    const dbUnion = await prisma.transportUnion.findUnique({
      where: { id: created.id },
      include: { documents: true },
    });

    expect(dbUnion).toBeDefined();
    expect(dbUnion.fonction).toBe('Secrétaire général');
    expect(dbUnion.cniNumber).toBe(payload.cniNumber);
    expect(dbUnion.documents.length).toBe(3);

    const categories = dbUnion.documents.map((d) => d.category);
    expect(categories).toContain('PHOTO_PORTRAIT');
    expect(categories).toContain('CNI_RECTO');
    expect(categories).toContain('CNI_VERSO');

    dbUnion.documents.forEach((d) => createdDocumentIds.push(d.id));
  });

  // TEST 2: Retrieve single union by ID and verify all fields & documents
  test('2. Get Union by ID returns fonction, cniNumber, and attached documents', async () => {
    const unionId = createdUnionIds[0];
    expect(unionId).toBeDefined();

    const res = await request(app)
      .get(`/api/v1/unions/${unionId}`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;

    expect(data.id).toBe(unionId);
    expect(data.fonction).toBe('Secrétaire général');
    expect(data.cniNumber).toMatch(/^CNI-2026-GN-/);
    expect(Array.isArray(data.documents)).toBe(true);
    expect(data.documents.length).toBe(3);

    const portraitDoc = data.documents.find((d) => d.category === 'PHOTO_PORTRAIT');
    expect(portraitDoc).toBeDefined();
    expect(portraitDoc.mimeType).toBe('image/jpeg');
  });

  // TEST 3: Secure document streaming access control & CNI protection
  test('3. Secure Document Streaming (Stream & Scope Verification)', async () => {
    const unionId = createdUnionIds[0];
    const union = await prisma.transportUnion.findUnique({
      where: { id: unionId },
      include: { documents: true },
    });

    const cniRectoDoc = union.documents.find((d) => d.category === 'CNI_RECTO');
    expect(cniRectoDoc).toBeDefined();

    // 3.1: Super Admin with UNIONS_READ/DOCUMENTS_VERIFY can access
    const resAuth = await request(app)
      .get(`/api/v1/documents/${cniRectoDoc.id}/stream`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(resAuth.status).toBe(200);
    expect(resAuth.headers['content-type']).toBe('image/jpeg');

    // 3.2: Unauthenticated request is rejected (HTTP 401)
    const resNoAuth = await request(app)
      .get(`/api/v1/documents/${cniRectoDoc.id}/stream`);

    expect(resNoAuth.status).toBe(401);

    // 3.3: User without UNIONS_READ or DOCUMENTS_VERIFY is rejected (HTTP 403)
    const resForbiddenRole = await request(app)
      .get(`/api/v1/documents/${cniRectoDoc.id}/stream`)
      .set('Authorization', `Bearer ${unauthorizedToken}`);

    expect(resForbiddenRole.status).toBe(403);

    // 3.4: Agent restricted to Matoto trying to view document of Kaloum union gets 403 FORBIDDEN_DOCUMENT_SCOPE
    const resForbiddenScope = await request(app)
      .get(`/api/v1/documents/${cniRectoDoc.id}/stream`)
      .set('Authorization', `Bearer ${restrictedAgentToken}`);

    expect(resForbiddenScope.status).toBe(403);
    expect(resForbiddenScope.body.code).toBe('FORBIDDEN_DOCUMENT_SCOPE');
  });

  // TEST 4: Update union details (change fonction and replace/remove photo)
  test('4. Update Union details: change fonction, update CNI, and verify audit log', async () => {
    const unionId = createdUnionIds[0];

    const updatePayload = {
      fonction: 'Président', // Changed official position
      cniNumber: 'CNI-2026-REVISED-999',
      removePhoto: true, // Remove portrait photo
    };

    const res = await request(app)
      .put(`/api/v1/unions/${unionId}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send(updatePayload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.fonction).toBe('Président');
    expect(res.body.data.cniNumber).toBe('CNI-2026-REVISED-999');
    expect(res.body.data.photoUrl).toBeNull();

    // Verify in database
    const dbUnion = await prisma.transportUnion.findUnique({
      where: { id: unionId },
      include: { documents: true },
    });
    expect(dbUnion.fonction).toBe('Président');
    expect(dbUnion.photoUrl).toBeNull();

    // Check that PHOTO_PORTRAIT document was deleted but CNI documents remain
    const remainingCats = dbUnion.documents.map((d) => d.category);
    expect(remainingCats).not.toContain('PHOTO_PORTRAIT');
    expect(remainingCats).toContain('CNI_RECTO');
    expect(remainingCats).toContain('CNI_VERSO');

    // Verify Audit Log entry
    const audit = await prisma.auditLog.findFirst({
      where: {
        action: 'UNION_UPDATED',
        targetRecordId: unionId,
      },
      orderBy: { timestamp: 'desc' },
    });
    expect(audit).toBeDefined();
    expect(audit.newValues.fonction).toBe('Président');
  });

  // TEST 5: Offline synchronization push support for UNION entity with identity fields
  test('5. Offline Sync: push union created offline with fonction and inline portrait', async () => {
    const uniqueSyncCode = `OFF-${Date.now().toString().slice(-5)}`;
    const offlineItem = {
      clientGeneratedId: crypto.randomUUID(),
      entityType: 'UNION',
      createdOfflineAt: new Date(Date.now() - 3600000).toISOString(),
      payload: {
        code: uniqueSyncCode,
        name: `Syndicat des Chauffeurs Réunis ${uniqueSyncCode}`,
        registrationNumber: `REC-${uniqueSyncCode}`,
        presidentName: 'Mamoudou Barry',
        fonction: 'Trésorier',
        cniNumber: `CNI-OFFLINE-${uniqueSyncCode}`,
        commune: 'Dixinn',
        documents: [
          {
            category: 'PHOTO_PORTRAIT',
            originalName: 'photo_barry.jpg',
            mimeType: 'image/jpeg',
            base64Data: validJpegBase64,
          },
        ],
      },
    };

    const res = await request(app)
      .post('/api/v1/sync/push')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        deviceId: 'terminal-sync-offline-01',
        items: [offlineItem],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accepted).toBe(1);
    expect(res.body.data.failed).toBe(0);

    const syncResult = res.body.data.results[0];
    expect(syncResult.status).toBe('SUCCESS');
    expect(syncResult.serverRecordId).toBeDefined();

    createdUnionIds.push(syncResult.serverRecordId);

    // Verify PostgreSQL persistence
    const syncedUnion = await prisma.transportUnion.findUnique({
      where: { id: syncResult.serverRecordId },
      include: { documents: true, commune: true },
    });

    expect(syncedUnion).toBeDefined();
    expect(syncedUnion.code).toBe(uniqueSyncCode);
    expect(syncedUnion.fonction).toBe('Trésorier');
    expect(syncedUnion.cniNumber).toBe(`CNI-OFFLINE-${uniqueSyncCode}`);
    expect(syncedUnion.documents.length).toBe(1);
    expect(syncedUnion.documents[0].category).toBe('PHOTO_PORTRAIT');
    expect(syncedUnion.commune.code).toBe('DXN');
  });

  // TEST 6: Sync Reference Catalogue Pull contains all identity fields
  test('6. Sync Catalog Pull (GET /api/v1/sync/pull) returns fonction and presidentName', async () => {
    const res = await request(app)
      .get('/api/v1/sync/pull')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.unions)).toBe(true);

    const found = res.body.data.unions.find((u) => createdUnionIds.includes(u.id));
    expect(found).toBeDefined();
    expect(found).toHaveProperty('fonction');
    expect(found).toHaveProperty('presidentName');
    expect(found).toHaveProperty('cniNumber');
  });

  // TEST 7: Regression on duplicate code and name validation
  test('7. Regression: duplicate union code and name return HTTP 409', async () => {
    const existing = await prisma.transportUnion.findUnique({
      where: { id: createdUnionIds[0] },
    });

    // Attempt duplicate code
    const resDupCode = await request(app)
      .post('/api/v1/unions')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        code: existing.code,
        name: `Different Name ${Date.now()}`,
      });
    expect(resDupCode.status).toBe(409);
    expect(resDupCode.body.code).toBe('DUPLICATE_UNION_CODE');

    // Attempt duplicate name
    const resDupName = await request(app)
      .post('/api/v1/unions')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        code: `DIFF-${Date.now().toString().slice(-4)}`,
        name: existing.name,
      });
    expect(resDupName.status).toBe(409);
    expect(resDupName.body.code).toBe('DUPLICATE_UNION_NAME');
  });
});
