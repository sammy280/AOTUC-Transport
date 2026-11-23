/**
 * Offline Payload Encryption Service for AOTUC Web Admin
 *
 * Uses W3C Web Cryptography API with AES-256-GCM to secure
 * citizen PII (NIN, phone, addresses) and sensitive documents
 * at rest inside browser IndexedDB storage.
 */

let cachedCryptoKey: CryptoKey | null = null;

function getSubtleCrypto(): SubtleCrypto {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    return window.crypto.subtle;
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
    return globalThis.crypto.subtle;
  }
  throw new Error('Web Cryptography API is not supported in this runtime environment.');
}

function getOrGenerateDeviceSeed(): Uint8Array {
  const SEED_STORAGE_KEY = 'aotuc_device_crypto_seed_v1';
  if (typeof window === 'undefined' || !window.localStorage) {
    return new Uint8Array(32).fill(7); // Test environment fallback
  }

  const existingHex = localStorage.getItem(SEED_STORAGE_KEY);
  if (existingHex && existingHex.length === 64) {
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(existingHex.substr(i * 2, 2), 16);
    }
    return bytes;
  }

  // Generate cryptographically secure 256-bit random seed
  const newBytes = new Uint8Array(32);
  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(newBytes);
  } else {
    for (let i = 0; i < 32; i++) newBytes[i] = Math.floor(Math.random() * 256);
  }

  let hex = '';
  for (let i = 0; i < 32; i++) {
    hex += newBytes[i].toString(16).padStart(2, '0');
  }
  try {
    localStorage.setItem(SEED_STORAGE_KEY, hex);
  } catch (_) {
    // Ignore storage quota errors
  }

  return newBytes;
}

async function getEncryptionKey(): Promise<CryptoKey> {
  if (cachedCryptoKey) return cachedCryptoKey;

  const subtle = getSubtleCrypto();
  const seed = getOrGenerateDeviceSeed();
  const salt = new TextEncoder().encode('aotuc-guinee-transport-offline-salt-v1');

  const baseKey = await subtle.importKey(
    'raw',
    seed as any,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  cachedCryptoKey = await subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: 20000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return cachedCryptoKey;
}

export interface EncryptedPayload {
  cipher: ArrayBuffer;
  iv: number[];
}

/**
 * Encrypts arbitrary serializable data using AES-GCM (256-bit) with a unique 96-bit IV per item.
 */
export async function encryptOfflineData(data: any): Promise<EncryptedPayload> {
  const subtle = getSubtleCrypto();
  const key = await getEncryptionKey();

  const iv = new Uint8Array(12);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(iv);
  } else if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    globalThis.crypto.getRandomValues(iv);
  }

  const jsonString = JSON.stringify(data);
  const encoded = new TextEncoder().encode(jsonString);

  const cipher = await subtle.encrypt(
    { name: 'AES-GCM', iv: iv as any },
    key,
    encoded as any
  );

  return {
    cipher,
    iv: Array.from(iv),
  };
}

/**
 * Decrypts an encrypted payload using the local AES-GCM key and IV.
 */
export async function decryptOfflineData<T = any>(payload: EncryptedPayload): Promise<T> {
  const subtle = getSubtleCrypto();
  const key = await getEncryptionKey();

  const iv = new Uint8Array(payload.iv);
  const decrypted = await subtle.decrypt(
    { name: 'AES-GCM', iv: iv as any },
    key,
    payload.cipher as any
  );

  const decoded = new TextDecoder().decode(decrypted);
  return JSON.parse(decoded) as T;
}
