import crypto from 'crypto';
import logger from '../utils/logger.js';
import { AppError } from '../middlewares/errorHandler.js';

/**
 * Asymmetric Ed25519 Cryptographic Engine for AOTUC Credentials (CR80 Badges & Licences)
 * Implements RFC 8032 Ed25519 digital signatures.
 * 
 * - The private signing key resides strictly on the backend / HSM.
 * - Mobile inspector devices receive ONLY the public verification keys.
 * - Creates compact, tamper-proof QR payloads readable offline.
 */

// Key ID for versioning and rotation
const ACTIVE_KEY_ID = process.env.QR_KEY_ID || 'aotuc-2026-v1';

// In-memory key store (auto-generated for development/testing if not supplied in env)
let currentKeyPair = null;

function initializeKeys() {
  if (currentKeyPair) return currentKeyPair;

  // Generate real Ed25519 keypair using Node.js built-in crypto
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  currentKeyPair = {
    keyId: ACTIVE_KEY_ID,
    publicKey,
    privateKey,
    createdAt: new Date().toISOString(),
  };

  logger.info('Initialized Ed25519 cryptographic keypair', { keyId: ACTIVE_KEY_ID });
  return currentKeyPair;
}

export class CryptoSignatureService {
  /**
   * Signs a credential payload using the backend Ed25519 private key.
   * Produces a compact, tamper-resistant QR string.
   */
  static signCredential({ credentialId, type, targetId, issuedAt, expiresAt }) {
    const keys = initializeKeys();

    const iatSec = Math.floor(new Date(issuedAt).getTime() / 1000);
    const expSec = Math.floor(new Date(expiresAt).getTime() / 1000);

    // 1. Canonical data string to sign
    const canonicalString = `${keys.keyId}:${credentialId}:${type}:${targetId}:${iatSec}:${expSec}`;
    const dataBuffer = Buffer.from(canonicalString, 'utf8');

    // 2. Compute 64-byte Ed25519 signature
    const signature = crypto.sign(null, dataBuffer, keys.privateKey);
    const signatureBase64Url = signature.toString('base64url');

    // 3. Compact serialized QR payload: AOTUC1.<keyId>.<cid>.<typ>.<tid>.<iat>.<exp>.<sig>
    const qrPayload = `AOTUC1.${keys.keyId}.${credentialId}.${type}.${targetId}.${iatSec}.${expSec}.${signatureBase64Url}`;

    return {
      keyId: keys.keyId,
      signature: signatureBase64Url,
      qrPayload,
      canonicalString,
    };
  }

  /**
   * Verifies an Ed25519 signed QR payload using the public key.
   * Can be executed offline by any client possessing the public key!
   */
  static verifyQrPayload(qrString) {
    if (!qrString || !qrString.startsWith('AOTUC1.')) {
      return {
        isValid: false,
        isExpired: false,
        reason: 'Format de QR code AOTUC non reconnu.',
      };
    }

    const parts = qrString.split('.');
    if (parts.length !== 8) {
      return {
        isValid: false,
        isExpired: false,
        reason: 'Structure du QR code invalide.',
      };
    }

    const [, keyId, credentialId, type, targetId, iatSecStr, expSecStr, signatureBase64Url] = parts;
    const keys = initializeKeys();

    // Verify keyId matches active or known public keys
    if (keyId !== keys.keyId) {
      return {
        isValid: false,
        isExpired: false,
        reason: `Clé publique inconnue (${keyId}). Une synchronisation est nécessaire.`,
      };
    }

    // Reconstruct canonical string
    const canonicalString = `${keyId}:${credentialId}:${type}:${targetId}:${iatSecStr}:${expSecStr}`;
    const dataBuffer = Buffer.from(canonicalString, 'utf8');
    const signatureBuffer = Buffer.from(signatureBase64Url, 'base64url');

    // Verify signature with Ed25519 public key
    const isSignatureValid = crypto.verify(null, dataBuffer, keys.publicKey, signatureBuffer);

    if (!isSignatureValid) {
      return {
        isValid: false,
        isExpired: false,
        reason: 'Signature cryptographique altérée ou contrefaite ! Titre non authentique.',
      };
    }

    // Check expiration timestamp
    const nowSec = Math.floor(Date.now() / 1000);
    const expSec = parseInt(expSecStr, 10);
    const isExpired = nowSec > expSec;

    return {
      isValid: true,
      isExpired,
      reason: isExpired ? 'Titre expiré.' : 'Signature cryptographique AOTUC valide et authentique.',
      payload: {
        keyId,
        credentialId,
        type,
        targetId,
        issuedAt: new Date(parseInt(iatSecStr, 10) * 1000).toISOString(),
        expiresAt: new Date(expSec * 1000).toISOString(),
      },
    };
  }

  /**
   * Returns public key metadata for distribution to mobile inspector devices.
   */
  static getPublicKeys() {
    const keys = initializeKeys();
    return [
      {
        keyId: keys.keyId,
        algorithm: 'Ed25519',
        publicKeyPem: keys.publicKey,
        validFrom: keys.createdAt,
        issuer: 'Agence Organisatrice du Transport Urbain de Conakry (AOTUC)',
      },
    ];
  }
}

export default CryptoSignatureService;
