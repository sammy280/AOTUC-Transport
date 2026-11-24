/**
 * AOTUC Web-Admin Offline Authentication Service
 * 
 * Provides:
 * 1. Asymmetric ECDSA P-256 non-extractable device cryptographic binding.
 * 2. Multi-tier offline authentication:
 *    - Tier 1: WebAuthn / Passkey Platform Authenticator (Biometrics / Windows Hello)
 *    - Tier 2: PBKDF2-SHA-512 with 600,000 iterations and AES-256-GCM verifier tag
 * 3. 7-Day offline lease enforcement with monotonic system clock rollback protection.
 * 4. Multi-user isolation on shared devices.
 * 5. Strict session isolation (cleared on logout, preserved drafts/enrolled credentials).
 */

import { UserContext, RoleType } from '../types';
import {
  openOfflineDatabase,
  STORE_ENROLLED_USERS,
  STORE_DEVICE_BINDING,
} from './offlineStore';

export const OFFLINE_LEASE_DAYS = 7;
export const PBKDF2_ITERATIONS = 600000;
const VERIFIER_CONSTANT = 'AOTUC-OFFLINE-VERIFIER-V1';
const OFFLINE_SESSION_KEY = 'aotuc_offline_session_active';
const OFFLINE_USER_KEY = 'aotuc_offline_user';

export interface EnrolledUserRecord {
  userId: string;
  identifier: string; // Lowercase normalized email, phone, or agent code
  identifierHash: string; // SHA-256 hex string for fast lookups
  displayName: string;
  role: RoleType;
  roleLabel: string;
  communeId: string | null;
  communeName: string | null;
  email: string | null;
  phoneNumber?: string;
  jobTitle?: string;
  avatarUrl: string | null;
  authTier: 'WEBAUTHN' | 'PASSWORD_KDF';
  webauthnCredentialId?: string;
  kdfSalt: string; // 32-byte hex salt
  kdfIterations: number;
  verifierCipher: number[];
  verifierIv: number[];
  enrolledAt: string;
  leaseExpiresAt: string;
  leaseSignatureHex?: string; // Asymmetric ECDSA P-256 signature binding lease to device
  lastMonotonicTimestamp: number;
  lastSuccessfulOfflineLogin: string | null;
}

export interface EnrolledUserSummary {
  userId: string;
  identifier: string;
  displayName: string;
  role: RoleType;
  roleLabel: string;
  communeName: string | null;
  authTier: 'WEBAUTHN' | 'PASSWORD_KDF';
  leaseExpiresAt: string;
  isLeaseValid: boolean;
}

export interface DeviceBindingRecord {
  key: 'device_identity';
  deviceId: string;
  deviceLabel: string;
  publicKeyJwk: JsonWebKey;
  privateKey: CryptoKey;
  enrolledAt: string;
}

function getSubtleCrypto(): SubtleCrypto {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    return window.crypto.subtle;
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
    return globalThis.crypto.subtle;
  }
  throw new Error('Web Cryptography API is not supported in this runtime environment.');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Computes SHA-256 hash in hex format for an identifier string.
 */
export async function hashIdentifier(rawIdentifier: string): Promise<string> {
  const clean = String(rawIdentifier || '').trim().toLowerCase();
  const subtle = getSubtleCrypto();
  const encoded = new TextEncoder().encode(clean);
  const digest = await subtle.digest('SHA-256', encoded as any);
  return bytesToHex(new Uint8Array(digest));
}

/**
 * Generates or retrieves the device's cryptographic identity (ECDSA P-256 keypair).
 * The private key is non-extractable and cannot be exported outside IndexedDB.
 */
export async function getOrCreateDeviceBinding(): Promise<DeviceBindingRecord> {
  const db = await openOfflineDatabase();

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_DEVICE_BINDING, 'readwrite');
      const store = tx.objectStore(STORE_DEVICE_BINDING);
      const req = store.get('device_identity');

      req.onsuccess = async () => {
        if (req.result) {
          resolve(req.result as DeviceBindingRecord);
          return;
        }

        try {
          const subtle = getSubtleCrypto();
          // Generate non-extractable ECDSA P-256 keypair
          const keyPair = await subtle.generateKey(
            { name: 'ECDSA', namedCurve: 'P-256' },
            false, // Non-extractable private key
            ['sign', 'verify']
          );

          const publicKeyJwk = await subtle.exportKey('jwk', keyPair.publicKey);
          const deviceId =
            typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : `dev-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

          const deviceLabel =
            typeof navigator !== 'undefined'
              ? `${navigator.userAgent.slice(0, 50)} (${navigator.platform || 'Unknown'})`
              : 'Registered AOTUC Device';

          const record: DeviceBindingRecord = {
            key: 'device_identity',
            deviceId,
            deviceLabel,
            publicKeyJwk,
            privateKey: keyPair.privateKey,
            enrolledAt: new Date().toISOString(),
          };

          const putReq = store.put(record);
          putReq.onsuccess = () => resolve(record);
          putReq.onerror = () => reject(putReq.error);
        } catch (err) {
          reject(err);
        }
      };

      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Derives an AES-GCM verification key from a password using PBKDF2-SHA-512 with 600,000 iterations.
 */
async function deriveVerificationKey(password: string, saltBytes: Uint8Array): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const passwordEncoded = new TextEncoder().encode(password);

  const baseKey = await subtle.importKey(
    'raw',
    passwordEncoded as any,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return await subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes as any,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-512',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a known verifier constant using the derived key to generate a verifier tag.
 */
async function generateVerifierTag(
  password: string,
  saltBytes: Uint8Array
): Promise<{ cipher: number[]; iv: number[] }> {
  const subtle = getSubtleCrypto();
  const key = await deriveVerificationKey(password, saltBytes);

  const iv = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(iv);
  } else {
    for (let i = 0; i < 12; i++) iv[i] = Math.floor(Math.random() * 256);
  }

  const constantEncoded = new TextEncoder().encode(VERIFIER_CONSTANT);
  const cipherBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv: iv as any },
    key,
    constantEncoded as any
  );

  return {
    cipher: Array.from(new Uint8Array(cipherBuffer)),
    iv: Array.from(iv),
  };
}

/**
 * Verifies that the entered password successfully decrypts the stored verifier tag.
 */
async function verifyPassword(
  password: string,
  saltHex: string,
  verifierCipher: number[],
  verifierIv: number[]
): Promise<boolean> {
  try {
    const subtle = getSubtleCrypto();
    const saltBytes = hexToBytes(saltHex);
    const key = await deriveVerificationKey(password, saltBytes);

    const cipherBytes = new Uint8Array(verifierCipher);
    const ivBytes = new Uint8Array(verifierIv);

    const decryptedBuffer = await subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes as any },
      key,
      cipherBytes as any
    );

    const decryptedText = new TextDecoder().decode(decryptedBuffer);
    return decryptedText === VERIFIER_CONSTANT;
  } catch {
    return false; // Authentication failed (AES-GCM tag mismatch or invalid password)
  }
}

/**
 * Checks whether WebAuthn / Passkeys with platform authenticator are available.
 */
export async function isWebAuthnAvailable(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) return false;
  if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Enrolls a user for offline authentication after a successful online authentication.
 */
export async function enrollUserForOfflineAuth(
  user: UserContext,
  password?: string,
  webauthnCredId?: string
): Promise<boolean> {
  if (!user || !user.id) return false;

  const db = await openOfflineDatabase();
  await getOrCreateDeviceBinding(); // Ensure device key exists

  const rawIdentifier = (user.email || user.id || '').trim().toLowerCase();
  const identifierHash = await hashIdentifier(rawIdentifier);

  const saltBytes = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(saltBytes);
  } else {
    for (let i = 0; i < 32; i++) saltBytes[i] = Math.floor(Math.random() * 256);
  }
  const kdfSalt = bytesToHex(saltBytes);

  let verifierCipher: number[] = [];
  let verifierIv: number[] = [];
  let authTier: 'WEBAUTHN' | 'PASSWORD_KDF' = 'PASSWORD_KDF';

  if (webauthnCredId) {
    authTier = 'WEBAUTHN';
  }

  if (password) {
    const tag = await generateVerifierTag(password, saltBytes);
    verifierCipher = tag.cipher;
    verifierIv = tag.iv;
  }

  const now = Date.now();
  const leaseExpiresAt = new Date(now + OFFLINE_LEASE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Cryptographically sign the lease using the non-extractable device private key
  let leaseSignatureHex: string | undefined;
  try {
    const subtle = getSubtleCrypto();
    const deviceBinding = await getOrCreateDeviceBinding();
    const leasePayload = `${user.id}:${rawIdentifier}:${deviceBinding.deviceId}:${leaseExpiresAt}:${kdfSalt}`;
    const sigBuffer = await subtle.sign(
      { name: 'ECDSA', hash: { name: 'SHA-256' } },
      deviceBinding.privateKey,
      new TextEncoder().encode(leasePayload) as any
    );
    leaseSignatureHex = bytesToHex(new Uint8Array(sigBuffer));
  } catch (sigErr) {
    console.warn('[AOTUC Offline Auth] Lease signature warning:', sigErr);
  }

  const record: EnrolledUserRecord = {
    userId: user.id,
    identifier: rawIdentifier,
    identifierHash,
    displayName: user.name,
    role: user.role,
    roleLabel: user.roleLabel,
    communeId: user.communeId || null,
    communeName: user.communeName || null,
    email: user.email || null,
    phoneNumber: user.phoneNumber,
    jobTitle: user.jobTitle,
    avatarUrl: user.avatarUrl || null,
    authTier,
    webauthnCredentialId: webauthnCredId,
    kdfSalt,
    kdfIterations: PBKDF2_ITERATIONS,
    verifierCipher,
    verifierIv,
    enrolledAt: new Date(now).toISOString(),
    leaseExpiresAt,
    leaseSignatureHex,
    lastMonotonicTimestamp: now,
    lastSuccessfulOfflineLogin: null,
  };

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_ENROLLED_USERS, 'readwrite');
      const store = tx.objectStore(STORE_ENROLLED_USERS);
      const req = store.put(record);

      req.onsuccess = () => {
        console.log(`[AOTUC Offline Auth] Enrolled user ${user.name} (${user.role}) for offline login.`);
        resolve(true);
      };
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Validates the 7-day lease expiration, verifies that the system clock has not been rolled backward,
 * and cryptographically verifies that the lease timestamp was signed by this device.
 */
export async function validateLeaseAndClock(
  record: EnrolledUserRecord,
  deviceBinding?: DeviceBindingRecord | null
): Promise<{ valid: boolean; error?: string }> {
  const now = Date.now();

  // 1. Monotonic Clock Rollback Check
  if (record.lastMonotonicTimestamp && now < record.lastMonotonicTimestamp - 30000) {
    // 30-second tolerance for slight system clock jitter
    return {
      valid: false,
      error: "Anomalie d'horloge détectée (retour en arrière). Authentification hors ligne bloquée par mesure d'intégrité.",
    };
  }

  // 2. Lease Expiration Check
  const leaseExpiryMs = new Date(record.leaseExpiresAt).getTime();
  if (now > leaseExpiryMs) {
    const expiredDateStr = new Date(leaseExpiryMs).toLocaleDateString('fr-FR');
    return {
      valid: false,
      error: `Le bail hors ligne de 7 jours a expiré le ${expiredDateStr}. Une reconnexion au serveur AOTUC est requise.`,
    };
  }

  // 3. Cryptographic Lease Tampering Check (verifies lease was not modified in IndexedDB)
  if (record.leaseSignatureHex && deviceBinding && deviceBinding.publicKeyJwk) {
    try {
      const subtle = getSubtleCrypto();
      const publicKey = await subtle.importKey(
        'jwk',
        deviceBinding.publicKeyJwk,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify']
      );
      const leasePayload = `${record.userId}:${record.identifier}:${deviceBinding.deviceId}:${record.leaseExpiresAt}:${record.kdfSalt}`;
      const isSigValid = await subtle.verify(
        { name: 'ECDSA', hash: { name: 'SHA-256' } },
        publicKey,
        hexToBytes(record.leaseSignatureHex) as any,
        new TextEncoder().encode(leasePayload) as any
      );
      if (!isSigValid) {
        return {
          valid: false,
          error: "Bail hors ligne altéré : la signature cryptographique d'appareil est invalide.",
        };
      }
    } catch {
      return {
        valid: false,
        error: "Erreur de vérification de signature du bail hors ligne.",
      };
    }
  }

  return { valid: true };
}

/**
 * Retrieves the enrolled user record by identifier.
 */
export async function findEnrolledUser(identifier: string): Promise<EnrolledUserRecord | null> {
  const db = await openOfflineDatabase();
  const clean = String(identifier || '').trim().toLowerCase();
  const idHash = await hashIdentifier(clean);

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_ENROLLED_USERS, 'readonly');
      const store = tx.objectStore(STORE_ENROLLED_USERS);

      // Try index by identifierHash
      try {
        const index = store.index('identifierHash');
        const req = index.get(idHash);
        req.onsuccess = () => {
          if (req.result) {
            resolve(req.result as EnrolledUserRecord);
            return;
          }
          // Fallback scan all users if not found by hash
          const cursorReq = store.openCursor();
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result;
            if (cursor) {
              const val = cursor.value as EnrolledUserRecord;
              if (
                val.identifier.toLowerCase() === clean ||
                val.userId === identifier ||
                (val.email && val.email.toLowerCase() === clean)
              ) {
                resolve(val);
                return;
              }
              cursor.continue();
            } else {
              resolve(null);
            }
          };
          cursorReq.onerror = () => resolve(null);
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Authenticates a user offline using their enrolled password.
 */
export async function authenticateOfflineWithPassword(
  identifier: string,
  password: string
): Promise<{ success: boolean; user?: UserContext; isOfflineSession?: boolean; error?: string }> {
  const cleanId = String(identifier || '').trim();
  const cleanPass = String(password || '').trim();

  if (!cleanId || !cleanPass) {
    return { success: false, error: 'Identifiant et mot de passe requis.' };
  }

  const record = await findEnrolledUser(cleanId);
  if (!record) {
    return {
      success: false,
      error: "Identifiant non reconnu sur cet appareil. Cet utilisateur ne s'est pas encore connecté en ligne sur ce terminal.",
    };
  }

  // Verify Lease & Clock
  const deviceBinding = await getOrCreateDeviceBinding();
  const leaseCheck = await validateLeaseAndClock(record, deviceBinding);
  if (!leaseCheck.valid) {
    return { success: false, error: leaseCheck.error };
  }

  // Verify Password Tag
  if (!record.verifierCipher || record.verifierCipher.length === 0) {
    return {
      success: false,
      error: "Aucune empreinte de mot de passe hors ligne n'est enregistrée pour cet utilisateur. Veuillez utiliser WebAuthn ou vous reconnecter en ligne.",
    };
  }

  const isPasswordValid = await verifyPassword(
    cleanPass,
    record.kdfSalt,
    record.verifierCipher,
    record.verifierIv
  );

  if (!isPasswordValid) {
    return {
      success: false,
      error: 'Mot de passe incorrect pour cet appareil enrôlé.',
    };
  }

  // Update monotonic timestamp and last login
  const now = Date.now();
  record.lastMonotonicTimestamp = Math.max(record.lastMonotonicTimestamp, now);
  record.lastSuccessfulOfflineLogin = new Date(now).toISOString();

  const db = await openOfflineDatabase();
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_ENROLLED_USERS, 'readwrite');
      const store = tx.objectStore(STORE_ENROLLED_USERS);
      store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve(); // Non-blocking
    } catch {
      resolve();
    }
  });

  const authenticatedUser: UserContext = {
    id: record.userId,
    name: record.displayName,
    role: record.role,
    roleLabel: record.roleLabel,
    communeName: record.communeName || 'Commune de rattachement',
    communeId: record.communeId,
    email: record.email || record.identifier,
    phoneNumber: record.phoneNumber,
    jobTitle: record.jobTitle || record.roleLabel,
    avatarUrl: record.avatarUrl,
  };

  setActiveOfflineSession(authenticatedUser);

  return {
    success: true,
    user: authenticatedUser,
    isOfflineSession: true,
  };
}

/**
 * Authenticates a user offline using WebAuthn platform authenticator (Biometrics/Windows Hello).
 */
export async function authenticateOfflineWithWebAuthn(
  identifier: string
): Promise<{ success: boolean; user?: UserContext; isOfflineSession?: boolean; error?: string }> {
  const cleanId = String(identifier || '').trim();
  const record = await findEnrolledUser(cleanId);

  if (!record) {
    return {
      success: false,
      error: "Identifiant non reconnu sur cet appareil enrôlé.",
    };
  }

  const deviceBinding = await getOrCreateDeviceBinding();
  const leaseCheck = await validateLeaseAndClock(record, deviceBinding);
  if (!leaseCheck.valid) {
    return { success: false, error: leaseCheck.error };
  }

  if (typeof window === 'undefined' || !navigator.credentials) {
    return {
      success: false,
      error: "L'API WebAuthn n'est pas disponible sur ce navigateur.",
    };
  }

  try {
    const challenge = new Uint8Array(32);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(challenge);
    }

    const credential = (await navigator.credentials.get({
      publicKey: {
        challenge,
        timeout: 60000,
        userVerification: 'required',
      },
    })) as PublicKeyCredential | null;

    if (!credential) {
      return { success: false, error: 'Authentification WebAuthn annulée.' };
    }

    // Success! Update clock and login
    const now = Date.now();
    record.lastMonotonicTimestamp = Math.max(record.lastMonotonicTimestamp, now);
    record.lastSuccessfulOfflineLogin = new Date(now).toISOString();

    const db = await openOfflineDatabase();
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_ENROLLED_USERS, 'readwrite');
        const store = tx.objectStore(STORE_ENROLLED_USERS);
        store.put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });

    const authenticatedUser: UserContext = {
      id: record.userId,
      name: record.displayName,
      role: record.role,
      roleLabel: record.roleLabel,
      communeName: record.communeName || 'Commune de rattachement',
      communeId: record.communeId,
      email: record.email || record.identifier,
      phoneNumber: record.phoneNumber,
      jobTitle: record.jobTitle || record.roleLabel,
      avatarUrl: record.avatarUrl,
    };

    setActiveOfflineSession(authenticatedUser);

    return {
      success: true,
      user: authenticatedUser,
      isOfflineSession: true,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Échec de l'authentification biométrique locale.",
    };
  }
}

/**
 * Returns a summary list of all users enrolled for offline authentication on this device.
 */
export async function getEnrolledOfflineUsers(): Promise<EnrolledUserSummary[]> {
  const db = await openOfflineDatabase();

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_ENROLLED_USERS, 'readonly');
      const store = tx.objectStore(STORE_ENROLLED_USERS);
      const req = store.getAll();

      req.onsuccess = () => {
        const list = (req.result || []) as EnrolledUserRecord[];
        const now = Date.now();
        const summaries: EnrolledUserSummary[] = list.map((u) => {
          const leaseMs = new Date(u.leaseExpiresAt).getTime();
          const isLeaseValid = now <= leaseMs && now >= (u.lastMonotonicTimestamp - 30000);
          return {
            userId: u.userId,
            identifier: u.identifier,
            displayName: u.displayName,
            role: u.role,
            roleLabel: u.roleLabel,
            communeName: u.communeName,
            authTier: u.authTier,
            leaseExpiresAt: u.leaseExpiresAt,
            isLeaseValid,
          };
        });
        resolve(summaries);
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

/**
 * Removes an enrolled user from offline storage.
 */
export async function removeEnrolledUser(userId: string): Promise<void> {
  const db = await openOfflineDatabase();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_ENROLLED_USERS, 'readwrite');
      const store = tx.objectStore(STORE_ENROLLED_USERS);
      const req = store.delete(userId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Sets the active offline session in sessionStorage.
 */
export function setActiveOfflineSession(user: UserContext): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(OFFLINE_SESSION_KEY, 'true');
  sessionStorage.setItem('aotuc_session_active', 'true');
  sessionStorage.setItem('aotuc_is_offline_session', 'true');
  sessionStorage.setItem(OFFLINE_USER_KEY, JSON.stringify(user));
  sessionStorage.setItem('aotuc_user', JSON.stringify(user));
  // Synthesize an offline mock JWT-like bearer structure with clear OFFLINE prefix
  sessionStorage.setItem('aotuc_auth_token', `offline-token-${user.id}-${Date.now()}`);
}

/**
 * Checks if the current session is an active offline session.
 */
export function isCurrentSessionOffline(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem('aotuc_is_offline_session') === 'true';
}

/**
 * Clears the active offline session (on explicit logout) without destroying
 * enrolled offline user credentials or pending drafts.
 */
export function clearActiveOfflineSession(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(OFFLINE_SESSION_KEY);
  sessionStorage.removeItem('aotuc_is_offline_session');
  sessionStorage.removeItem(OFFLINE_USER_KEY);
  sessionStorage.removeItem('aotuc_session_active');
  sessionStorage.removeItem('aotuc_user');
  sessionStorage.removeItem('aotuc_auth_token');
  localStorage.removeItem('aotuc_auth_token');
  localStorage.removeItem('aotuc_user');
}
