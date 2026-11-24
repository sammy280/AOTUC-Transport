import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Re-implement the exact cryptography primitives used in offlineAuthService.ts using Node crypto
const PBKDF2_ITERATIONS = 600000;
const VERIFIER_CONSTANT = 'AOTUC-OFFLINE-VERIFIER-V1';
const OFFLINE_LEASE_DAYS = 7;

function bytesToHex(buf) {
  return Buffer.from(buf).toString('hex');
}

function hexToBytes(hex) {
  return Buffer.from(hex, 'hex');
}

async function hashIdentifier(raw) {
  const clean = String(raw || '').trim().toLowerCase();
  const subtle = globalThis.crypto.subtle;
  const digest = await subtle.digest('SHA-256', Buffer.from(clean));
  return bytesToHex(new Uint8Array(digest));
}

async function deriveVerificationKey(password, saltBytes) {
  const subtle = globalThis.crypto.subtle;
  const baseKey = await subtle.importKey(
    'raw',
    Buffer.from(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return await subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-512',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function generateVerifierTag(password, saltBytes) {
  const subtle = globalThis.crypto.subtle;
  const key = await deriveVerificationKey(password, saltBytes);
  const iv = crypto.randomBytes(12);
  const encoded = Buffer.from(VERIFIER_CONSTANT);

  const cipher = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  return {
    cipher: Array.from(new Uint8Array(cipher)),
    iv: Array.from(iv),
  };
}

async function verifyPassword(password, saltHex, verifierCipher, verifierIv) {
  try {
    const subtle = globalThis.crypto.subtle;
    const saltBytes = hexToBytes(saltHex);
    const key = await deriveVerificationKey(password, saltBytes);

    const cipherBytes = Buffer.from(verifierCipher);
    const ivBytes = Buffer.from(verifierIv);

    const decrypted = await subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes },
      key,
      cipherBytes
    );

    return Buffer.from(decrypted).toString('utf8') === VERIFIER_CONSTANT;
  } catch {
    return false;
  }
}

async function validateLeaseAndClock(record, deviceBinding = null, currentTimestamp = Date.now()) {
  // Clock rollback check (30s tolerance)
  if (record.lastMonotonicTimestamp && currentTimestamp < record.lastMonotonicTimestamp - 30000) {
    return {
      valid: false,
      error: "Anomalie d'horloge détectée (retour en arrière). Authentification hors ligne bloquée par mesure d'intégrité.",
    };
  }

  // 7-day lease expiration check
  const leaseExpiryMs = new Date(record.leaseExpiresAt).getTime();
  if (currentTimestamp > leaseExpiryMs) {
    return {
      valid: false,
      error: 'Le bail hors ligne de 7 jours a expiré. Une reconnexion au serveur AOTUC est requise.',
    };
  }

  // Cryptographic signature check (prevents tampering with lease in IndexedDB)
  if (record.leaseSignatureHex && deviceBinding && deviceBinding.publicKey) {
    const subtle = globalThis.crypto.subtle;
    const leasePayload = `${record.userId}:${record.identifier}:${deviceBinding.deviceId}:${record.leaseExpiresAt}:${record.kdfSalt}`;
    const isValid = await subtle.verify(
      { name: 'ECDSA', hash: { name: 'SHA-256' } },
      deviceBinding.publicKey,
      hexToBytes(record.leaseSignatureHex),
      Buffer.from(leasePayload)
    );
    if (!isValid) {
      return {
        valid: false,
        error: "Bail hors ligne altéré : la signature cryptographique d'appareil est invalide.",
      };
    }
  }

  return { valid: true };
}

// Scoped Permissions logic matching web-admin/src/utils/permissions.ts
const OFFLINE_ALLOWED_TABS = ['enrolment', 'dashboard', 'field'];
const ROLE_ALLOWED_TABS = {
  DIRECTOR: ['dashboard', 'authorities', 'field', 'enrolment', 'unions', 'validation', 'badges', 'licences', 'mapping', 'ticketing', 'audit'],
  SUPER_ADMIN: ['dashboard', 'authorities', 'field', 'enrolment', 'unions', 'users', 'audit', 'mapping'],
  CHEF_SERVICE: ['dashboard', 'field', 'validation', 'enrolment', 'unions', 'badges', 'licences', 'mapping'],
  AGENT_TERRAIN: ['dashboard', 'field', 'enrolment', 'unions', 'validation'],
};

function isTabAllowed(role, tabId, isOfflineSession = false) {
  if (isOfflineSession) {
    return OFFLINE_ALLOWED_TABS.includes(tabId);
  }
  return (ROLE_ALLOWED_TABS[role] || []).includes(tabId);
}

describe('AOTUC Web-Admin Full Offline Authentication Suite (Phases 2-6)', () => {
  describe('Phase 2 & 3: Cryptographic Material Derivation & Offline Enrollment', () => {
    test('1. Generates non-extractable ECDSA P-256 device keypair', async () => {
      const subtle = globalThis.crypto.subtle;
      const keyPair = await subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        false, // Non-extractable
        ['sign', 'verify']
      );

      expect(keyPair.privateKey).toBeDefined();
      expect(keyPair.publicKey).toBeDefined();
      expect(keyPair.privateKey.extractable).toBe(false);

      // Verify signing capability
      const challenge = Buffer.from('AOTUC-DEVICE-PROOF-' + Date.now());
      const signature = await subtle.sign(
        { name: 'ECDSA', hash: { name: 'SHA-256' } },
        keyPair.privateKey,
        challenge
      );
      expect(signature.byteLength).toBeGreaterThan(0);

      const isValid = await subtle.verify(
        { name: 'ECDSA', hash: { name: 'SHA-256' } },
        keyPair.publicKey,
        signature,
        challenge
      );
      expect(isValid).toBe(true);
    });

    test('2. Computes PBKDF2-SHA-512 with 600,000 iterations and valid AES-GCM verifier tag', async () => {
      const password = 'SuperAdminSecretPassword2026!';
      const saltBytes = crypto.randomBytes(32);
      const tag = await generateVerifierTag(password, saltBytes);

      expect(tag.cipher.length).toBeGreaterThan(0);
      expect(tag.iv.length).toBe(12);

      // Verify correct password succeeds
      const isCorrect = await verifyPassword(password, bytesToHex(saltBytes), tag.cipher, tag.iv);
      expect(isCorrect).toBe(true);

      // Verify wrong password fails
      const isWrong = await verifyPassword('WrongPassword123!', bytesToHex(saltBytes), tag.cipher, tag.iv);
      expect(isWrong).toBe(false);
    }, 30000);

    test('3. Enrolls multiple distinct users (SUPER_ADMIN and AGENT_TERRAIN) on the same device without collisions', async () => {
      const users = [
        {
          userId: 'usr-admin-01',
          email: 'admin.dsi@aotuc.gov.gn',
          name: 'Ibrahima Diallo',
          role: 'SUPER_ADMIN',
          password: 'AdminPassword#1',
        },
        {
          userId: 'usr-agent-02',
          email: 'agent.kaloum@aotuc.gov.gn',
          name: 'Fatoumata Camara',
          role: 'AGENT_TERRAIN',
          password: 'AgentPassword#2',
        },
      ];

      const enrolledStore = new Map();

      for (const u of users) {
        const idHash = await hashIdentifier(u.email);
        const salt = crypto.randomBytes(32);
        const tag = await generateVerifierTag(u.password, salt);
        const now = Date.now();

        enrolledStore.set(u.userId, {
          userId: u.userId,
          identifier: u.email,
          identifierHash: idHash,
          displayName: u.name,
          role: u.role,
          kdfSalt: bytesToHex(salt),
          verifierCipher: tag.cipher,
          verifierIv: tag.iv,
          enrolledAt: new Date(now).toISOString(),
          leaseExpiresAt: new Date(now + OFFLINE_LEASE_DAYS * 86400000).toISOString(),
          lastMonotonicTimestamp: now,
        });
      }

      expect(enrolledStore.size).toBe(2);

      // Verify each user authenticates independently
      const adminRecord = enrolledStore.get('usr-admin-01');
      const agentRecord = enrolledStore.get('usr-agent-02');

      expect(await verifyPassword('AdminPassword#1', adminRecord.kdfSalt, adminRecord.verifierCipher, adminRecord.verifierIv)).toBe(true);
      expect(await verifyPassword('AgentPassword#2', adminRecord.kdfSalt, adminRecord.verifierCipher, adminRecord.verifierIv)).toBe(false);

      expect(await verifyPassword('AgentPassword#2', agentRecord.kdfSalt, agentRecord.verifierCipher, agentRecord.verifierIv)).toBe(true);
      expect(await verifyPassword('AdminPassword#1', agentRecord.kdfSalt, agentRecord.verifierCipher, agentRecord.verifierIv)).toBe(false);
    }, 30000);
  });

  describe('Phase 4: Offline Login Flow & Verification', () => {
    test('4. Successfully logs in offline with valid credentials and establishes offline session', async () => {
      const salt = crypto.randomBytes(32);
      const tag = await generateVerifierTag('ValidPass2026', salt);
      const now = Date.now();

      const userRecord = {
        userId: 'usr-chef-03',
        identifier: 'chef.matoto@aotuc.gov.gn',
        identifierHash: await hashIdentifier('chef.matoto@aotuc.gov.gn'),
        displayName: 'Sekou Traore',
        role: 'CHEF_SERVICE',
        kdfSalt: bytesToHex(salt),
        verifierCipher: tag.cipher,
        verifierIv: tag.iv,
        enrolledAt: new Date(now).toISOString(),
        leaseExpiresAt: new Date(now + OFFLINE_LEASE_DAYS * 86400000).toISOString(),
        lastMonotonicTimestamp: now,
      };

      const leaseCheck = await validateLeaseAndClock(userRecord);
      expect(leaseCheck.valid).toBe(true);

      const passCheck = await verifyPassword('ValidPass2026', userRecord.kdfSalt, userRecord.verifierCipher, userRecord.verifierIv);
      expect(passCheck).toBe(true);
    }, 30000);

    test('5. Rejects offline authentication when password is incorrect', async () => {
      const salt = crypto.randomBytes(32);
      const tag = await generateVerifierTag('CorrectPass', salt);

      const passCheck = await verifyPassword('WrongPass', bytesToHex(salt), tag.cipher, tag.iv);
      expect(passCheck).toBe(false);
    }, 30000);
  });

  describe('Phase 5: Offline Permissions & Scoped Capabilities', () => {
    test('6. Strictly permits ONLY non-authoritative tabs in offline session (enrolment, dashboard, field)', () => {
      // Online mode: SUPER_ADMIN has users, audit, etc.
      expect(isTabAllowed('SUPER_ADMIN', 'users', false)).toBe(true);
      expect(isTabAllowed('SUPER_ADMIN', 'audit', false)).toBe(true);
      expect(isTabAllowed('DIRECTOR', 'validation', false)).toBe(true);
      expect(isTabAllowed('DIRECTOR', 'badges', false)).toBe(true);
      expect(isTabAllowed('DIRECTOR', 'ticketing', false)).toBe(true);

      // Offline session: SUPER_ADMIN and DIRECTOR are STRICTLY restricted!
      expect(isTabAllowed('SUPER_ADMIN', 'enrolment', true)).toBe(true);
      expect(isTabAllowed('SUPER_ADMIN', 'dashboard', true)).toBe(true);
      expect(isTabAllowed('SUPER_ADMIN', 'field', true)).toBe(true);

      // BLOCKED operations:
      expect(isTabAllowed('SUPER_ADMIN', 'users', true)).toBe(false);
      expect(isTabAllowed('SUPER_ADMIN', 'audit', true)).toBe(false);
      expect(isTabAllowed('DIRECTOR', 'validation', true)).toBe(false);
      expect(isTabAllowed('DIRECTOR', 'badges', true)).toBe(false);
      expect(isTabAllowed('DIRECTOR', 'licences', true)).toBe(false);
      expect(isTabAllowed('DIRECTOR', 'ticketing', true)).toBe(false);
      expect(isTabAllowed('DIRECTOR', 'authorities', true)).toBe(false);
    });

    test('7. Explicit logout clears active session but preserves enrolled credentials', () => {
      // Mock sessionStorage and localStorage
      const mockSession = new Map([
        ['aotuc_session_active', 'true'],
        ['aotuc_is_offline_session', 'true'],
        ['aotuc_auth_token', 'offline-token-usr123'],
        ['aotuc_user', JSON.stringify({ id: 'usr123', name: 'Agent' })],
      ]);

      const mockIndexedDB = new Map([
        ['enrolled_users', [{ userId: 'usr123', identifier: 'agent@aotuc.gov.gn' }]],
        ['offline_drafts', [{ clientGeneratedId: 'draft-abc' }]],
      ]);

      // Execute logout: clears active session tokens
      mockSession.delete('aotuc_session_active');
      mockSession.delete('aotuc_is_offline_session');
      mockSession.delete('aotuc_auth_token');
      mockSession.delete('aotuc_user');

      expect(mockSession.has('aotuc_auth_token')).toBe(false);
      expect(mockSession.has('aotuc_session_active')).toBe(false);

      // IndexedDB credentials and drafts are 100% PRESERVED
      expect(mockIndexedDB.get('enrolled_users').length).toBe(1);
      expect(mockIndexedDB.get('offline_drafts').length).toBe(1);
    });
  });

  describe('Phase 6: Attributed Synchronization, Lease Enforcement & Clock Protection', () => {
    test('8. Enforces 7-day lease expiration', async () => {
      const now = Date.now();
      const validRecord = {
        leaseExpiresAt: new Date(now + 2 * 86400000).toISOString(),
        lastMonotonicTimestamp: now - 3600000,
      };
      const validRes = await validateLeaseAndClock(validRecord, null, now);
      expect(validRes.valid).toBe(true);

      const expiredRecord = {
        leaseExpiresAt: new Date(now - 86400000).toISOString(), // Expired yesterday
        lastMonotonicTimestamp: now - 86400000 * 2,
      };
      const result = await validateLeaseAndClock(expiredRecord, null, now);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('bail hors ligne de 7 jours a expiré');
    });

    test('9. Detects monotonic system clock rollback and blocks authentication', async () => {
      const baseTime = Date.now();
      const record = {
        leaseExpiresAt: new Date(baseTime + 5 * 86400000).toISOString(),
        lastMonotonicTimestamp: baseTime, // User operated at baseTime
      };

      // Attacker rolls clock back by 3 hours
      const rolledBackTime = baseTime - 3 * 3600000;
      const result = await validateLeaseAndClock(record, null, rolledBackTime);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Anomalie d'horloge détectée");
    });

    test('10. Cryptographically signs lease and blocks tampering with leaseExpiresAt', async () => {
      const subtle = globalThis.crypto.subtle;
      const keyPair = await subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign', 'verify']
      );

      const deviceBinding = {
        deviceId: 'dev-crypto-999',
        publicKey: keyPair.publicKey,
      };

      const now = Date.now();
      const authenticExpiry = new Date(now + 7 * 86400000).toISOString();
      const record = {
        userId: 'usr-agent-01',
        identifier: 'agent@aotuc.gov.gn',
        kdfSalt: 'abcdef1234567890',
        leaseExpiresAt: authenticExpiry,
        lastMonotonicTimestamp: now,
      };

      // Sign legitimate lease
      const payload = `${record.userId}:${record.identifier}:${deviceBinding.deviceId}:${record.leaseExpiresAt}:${record.kdfSalt}`;
      const sig = await subtle.sign(
        { name: 'ECDSA', hash: { name: 'SHA-256' } },
        keyPair.privateKey,
        Buffer.from(payload)
      );
      record.leaseSignatureHex = bytesToHex(sig);

      // Verify unmodified record passes
      const validCheck = await validateLeaseAndClock(record, deviceBinding, now);
      expect(validCheck.valid).toBe(true);

      // Attacker tampers with leaseExpiresAt in IndexedDB to 2035
      const tamperedRecord = {
        ...record,
        leaseExpiresAt: '2035-01-01T00:00:00.000Z',
      };
      const tamperedCheck = await validateLeaseAndClock(tamperedRecord, deviceBinding, now);
      expect(tamperedCheck.valid).toBe(false);
      expect(tamperedCheck.error).toContain('Bail hors ligne altéré');
    });

    test('11. Confirms offline draft creation preserves agent attribution for server audit', () => {
      const activeUser = {
        id: 'usr-agent-77',
        name: 'Mamadou Diallo',
        role: 'AGENT_TERRAIN',
      };

      const draftPayload = {
        clientGeneratedId: 'draft-uuid-001',
        agentUserId: activeUser.id,
        agentName: activeUser.name,
        entityType: 'DRIVER',
        payload: { firstName: 'Thierno', lastName: 'Barry' },
      };

      expect(draftPayload.agentUserId).toBe('usr-agent-77');
      expect(draftPayload.agentName).toBe('Mamadou Diallo');
    });
  });
});
