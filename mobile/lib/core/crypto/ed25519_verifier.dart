import 'dart:convert';
import 'package:cryptography/cryptography.dart';
import 'package:uuid/uuid.dart';
import '../database/offline_database.dart';

// ignore_for_file: constant_identifier_names
enum InspectionResultType {
  VALIDE_VERT,
  FRAUDE_ROUGE,
  EXPIRE_ROUGE,
  REVOQUE_ROUGE,
  ATTENTION_ORANGE,
}

class InspectionOutcome {
  final InspectionResultType status;
  final String code;
  final bool isAuthentic;
  final String title;
  final String message;
  final String? credentialId;
  final String? entityType;
  final String? entityTypeLabel;
  final String? targetId;
  final String? keyId;
  final DateTime? issuedDate;
  final DateTime? expiryDate;
  final String? revocationReason;

  const InspectionOutcome({
    required this.status,
    this.code = 'UNKNOWN',
    required this.isAuthentic,
    required this.title,
    required this.message,
    this.credentialId,
    this.entityType,
    this.entityTypeLabel,
    this.targetId,
    this.keyId,
    this.issuedDate,
    this.expiryDate,
    this.revocationReason,
  });
}

class Ed25519Verifier {
  static final Ed25519 _algorithm = Ed25519();

  // RFC 8410 ASN.1 DER prefix for a 32-byte Ed25519 SubjectPublicKeyInfo (SPKI)
  static const List<int> _ed25519SpkiHeader = [
    0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
  ];

  /// Maximum age of cached offline public key data before requiring key refresh (default 365 days).
  static Duration maxOfflineKeyAge = const Duration(days: 365);

  /// Encodes a 32-byte raw Ed25519 public key into standard X.509 SPKI PEM format
  /// matching Node.js `crypto.generateKeyPairSync('ed25519', { publicKeyEncoding: { type: 'spki', format: 'pem' } })`.
  static String encodeRawPublicKeyToSpkiPem(List<int> raw32Bytes) {
    final der = <int>[..._ed25519SpkiHeader, ...raw32Bytes];
    final b64 = base64Encode(der);
    return '-----BEGIN PUBLIC KEY-----\n$b64\n-----END PUBLIC KEY-----';
  }

  /// Extracts the 32-byte raw Ed25519 public key from an SPKI PEM or raw base64 string.
  /// Returns `null` if the key is corrupted or not a valid 32-byte Ed25519 key.
  static List<int>? extractRawEd25519PublicKey(String pemOrBase64) {
    try {
      final cleaned = pemOrBase64
          .replaceAll('-----BEGIN PUBLIC KEY-----', '')
          .replaceAll('-----END PUBLIC KEY-----', '')
          .replaceAll(RegExp(r'\s+'), '');
      if (cleaned.isEmpty) return null;

      final bytes = base64Decode(cleaned);
      if (bytes.length == 32) {
        return bytes;
      }
      if (bytes.length == 44) {
        // Verify RFC 8410 Ed25519 OID header (30 2a 30 05 06 03 2b 65 70 03 21 00)
        for (int i = 0; i < _ed25519SpkiHeader.length; i++) {
          if (bytes[i] != _ed25519SpkiHeader[i]) {
            return null;
          }
        }
        return bytes.sublist(12, 44);
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  static String? _frenchLabelForCredentialType(String rawType) {
    switch (rawType.trim().toUpperCase()) {
      case 'DRIVER_BADGE':
      case 'BADGE':
        return 'Badge Professionnel Chauffeur';
      case 'TRANSPORT_LICENCE':
      case 'LICENCE':
        return 'Licence de Transport Urbain';
      default:
        return null;
    }
  }

  static List<int>? _decodeBase64UrlSignature(String sigB64Url) {
    try {
      if (sigB64Url.trim().isEmpty) return null;
      String normalized = sigB64Url.trim().replaceAll('-', '+').replaceAll('_', '/');
      while (normalized.length % 4 != 0) {
        normalized += '=';
      }
      final decoded = base64Decode(normalized);
      if (decoded.length != 64) return null;
      return decoded;
    } catch (_) {
      return null;
    }
  }

  /// Signs a credential payload using an Ed25519 keyPair (compatible with backend `CryptoSignatureService.signCredential`).
  static Future<String> signCredentialWithKeyPair({
    required SimpleKeyPair keyPair,
    required String keyId,
    required String credentialId,
    required String type,
    required String targetId,
    required DateTime issuedAt,
    required DateTime expiresAt,
  }) async {
    final iatSec = issuedAt.millisecondsSinceEpoch ~/ 1000;
    final expSec = expiresAt.millisecondsSinceEpoch ~/ 1000;
    final canonical = '$keyId:$credentialId:$type:$targetId:$iatSec:$expSec';
    final sig = await _algorithm.sign(
      utf8.encode(canonical),
      keyPair: keyPair,
    );
    final sigB64Url = base64Url.encode(sig.bytes).replaceAll('=', '');
    return 'AOTUC1.$keyId.$credentialId.$type.$targetId.$iatSec.$expSec.$sigB64Url';
  }

  /// Verifies an official AOTUC QR code (Driver Badge or Transport Licence) 100% offline
  /// using cached Ed25519 public keys and the local SQLite revocation registry.
  static Future<InspectionOutcome> verifyQrCode(String rawQrData) async {
    final qrData = rawQrData.trim();

    // 1. Structural & Format Validation
    if (qrData.isEmpty || !qrData.startsWith('AOTUC1.')) {
      const outcome = InspectionOutcome(
        status: InspectionResultType.FRAUDE_ROUGE,
        code: 'MALFORMED_QR',
        isAuthentic: false,
        title: 'CODE QR NON RECONNU OU MALFORMÉ',
        message:
            'Ce code QR ne respecte pas le format officiel AOTUC République de Guinée (préfixe AOTUC1 manquant).',
      );
      await _logOutcome(qrData, outcome);
      return outcome;
    }

    final parts = qrData.split('.');
    if (parts.length != 8 || parts.any((p) => p.trim().isEmpty)) {
      const outcome = InspectionOutcome(
        status: InspectionResultType.FRAUDE_ROUGE,
        code: 'MALFORMED_QR',
        isAuthentic: false,
        title: 'STRUCTURE DU CODE QR ALTÉRÉE',
        message:
            'Le condensé cryptographique du code QR est incomplet, tronqué ou malformé.',
      );
      await _logOutcome(qrData, outcome);
      return outcome;
    }

    final keyId = parts[1].trim();
    final credentialId = parts[2].trim();
    final rawType = parts[3].trim().toUpperCase();
    final targetId = parts[4].trim();
    final iatSec = int.tryParse(parts[5].trim());
    final expSec = int.tryParse(parts[6].trim());
    final signatureBase64Url = parts[7].trim();

    final typeLabel = _frenchLabelForCredentialType(rawType);
    if (typeLabel == null ||
        iatSec == null ||
        expSec == null ||
        iatSec <= 0 ||
        expSec <= 0 ||
        expSec < iatSec) {
      const outcome = InspectionOutcome(
        status: InspectionResultType.FRAUDE_ROUGE,
        code: 'MALFORMED_QR',
        isAuthentic: false,
        title: 'DONNÉES DU CODE QR INVALIDES',
        message:
            'Le type de titre ou les horodatages du code QR sont invalides ou corrompus.',
      );
      await _logOutcome(qrData, outcome);
      return outcome;
    }

    final signatureBytes = _decodeBase64UrlSignature(signatureBase64Url);
    if (signatureBytes == null) {
      final outcome = InspectionOutcome(
        status: InspectionResultType.FRAUDE_ROUGE,
        code: 'INVALID_SIGNATURE',
        isAuthentic: false,
        title: 'SIGNATURE NUMÉRIQUE INVALIDE',
        message:
            'L empreinte cryptographique Ed25519 est absente ou sa longueur est non conforme (64 octets requis).',
        credentialId: credentialId,
        entityType: rawType,
        entityTypeLabel: typeLabel,
        targetId: targetId,
        keyId: keyId,
      );
      await _logOutcome(qrData, outcome);
      return outcome;
    }

    final issuedDate = DateTime.fromMillisecondsSinceEpoch(iatSec * 1000);
    final expiryDate = DateTime.fromMillisecondsSinceEpoch(expSec * 1000);

    // 2. Trusted Public Key Lookup & Key Validity Check (SQLite `public_keys`)
    // NEVER report a credential as valid if key verification cannot be completed reliably!
    final allKeys = await OfflineDatabase.instance.getAllPublicKeys();
    if (allKeys.isEmpty) {
      final outcome = InspectionOutcome(
        status: InspectionResultType.ATTENTION_ORANGE,
        code: 'NO_KEYS_AVAILABLE',
        isAuthentic: false,
        title: 'VÉRIFICATION IMPOSSIBLE — CLÉS ABSENTES',
        message:
            'Aucune clé publique AOTUC n est enregistrée sur ce terminal. Synchronisez les clés de sécurité avant de valider ce titre.',
        credentialId: credentialId,
        entityType: rawType,
        entityTypeLabel: typeLabel,
        targetId: targetId,
        keyId: keyId,
        issuedDate: issuedDate,
        expiryDate: expiryDate,
      );
      await _logOutcome(qrData, outcome);
      return outcome;
    }

    final keyRecord = await OfflineDatabase.instance.getPublicKey(keyId);
    if (keyRecord == null) {
      final outcome = InspectionOutcome(
        status: InspectionResultType.ATTENTION_ORANGE,
        code: 'UNKNOWN_KEY',
        isAuthentic: false,
        title: 'CLÉ DE SIGNATURE INCONNUE',
        message:
            'Ce titre est signé par une clé publique inconnue sur ce terminal ("$keyId"). Synchronisez les clés AOTUC ou refusez le titre.',
        credentialId: credentialId,
        entityType: rawType,
        entityTypeLabel: typeLabel,
        targetId: targetId,
        keyId: keyId,
        issuedDate: issuedDate,
        expiryDate: expiryDate,
      );
      await _logOutcome(qrData, outcome);
      return outcome;
    }

    // Check if cached key data is expired, corrupted, or uses an unsupported algorithm
    final algorithmName = (keyRecord['algorithm'] ?? '').toString().toUpperCase();
    final pem = (keyRecord['public_key_pem'] ?? '').toString();
    final cachedAtRaw = keyRecord['cached_at']?.toString();
    final validFromRaw = keyRecord['valid_from']?.toString();

    bool isKeyDataExpired = false;
    if (cachedAtRaw != null) {
      final cachedAt = DateTime.tryParse(cachedAtRaw);
      if (cachedAt != null &&
          DateTime.now().difference(cachedAt) > maxOfflineKeyAge) {
        isKeyDataExpired = true;
      }
    }
    if (validFromRaw != null && validFromRaw.toUpperCase().contains('EXPIRED')) {
      isKeyDataExpired = true;
    }

    final rawPublicKeyBytes =
        algorithmName == 'ED25519' ? extractRawEd25519PublicKey(pem) : null;

    if (isKeyDataExpired || rawPublicKeyBytes == null) {
      final outcome = InspectionOutcome(
        status: InspectionResultType.ATTENTION_ORANGE,
        code: 'KEY_EXPIRED_OR_INVALID',
        isAuthentic: false,
        title: 'CLÉ DE SÉCURITÉ EXPIRÉE OU INVALIDE',
        message:
            'Les données de la clé publique "$keyId" sont expirées ou corrompues. Une actualisation en ligne avec le serveur AOTUC est requise.',
        credentialId: credentialId,
        entityType: rawType,
        entityTypeLabel: typeLabel,
        targetId: targetId,
        keyId: keyId,
        issuedDate: issuedDate,
        expiryDate: expiryDate,
      );
      await _logOutcome(qrData, outcome);
      return outcome;
    }

    // 3. Real RFC 8032 Ed25519 Cryptographic Signature Verification
    final canonicalString =
        '$keyId:$credentialId:$rawType:$targetId:$iatSec:$expSec';
    final messageBytes = utf8.encode(canonicalString);
    final publicKey = SimplePublicKey(
      rawPublicKeyBytes,
      type: KeyPairType.ed25519,
    );
    final signature = Signature(signatureBytes, publicKey: publicKey);

    bool isSignatureValid = false;
    try {
      isSignatureValid = await _algorithm.verify(
        messageBytes,
        signature: signature,
      );
    } catch (_) {
      isSignatureValid = false;
    }

    if (!isSignatureValid) {
      final outcome = InspectionOutcome(
        status: InspectionResultType.FRAUDE_ROUGE,
        code: 'INVALID_SIGNATURE',
        isAuthentic: false,
        title: 'SIGNATURE NUMÉRIQUE INVALIDE — CONTREFAÇON',
        message:
            'La signature cryptographique Ed25519 ne correspond pas aux données du titre. Ce document est falsifié ou contrefait.',
        credentialId: credentialId,
        entityType: rawType,
        entityTypeLabel: typeLabel,
        targetId: targetId,
        keyId: keyId,
        issuedDate: issuedDate,
        expiryDate: expiryDate,
      );
      await _logOutcome(qrData, outcome);
      return outcome;
    }

    // 4. Local Revocation Blacklist Check (SQLite `revocations`)
    final revocation =
        await OfflineDatabase.instance.getRevocationRecord(credentialId) ??
            await OfflineDatabase.instance.getRevocationRecord(targetId);

    if (revocation != null) {
      final reason =
          (revocation['revocation_reason'] ?? 'Suspension administrative AOTUC')
              .toString();
      final outcome = InspectionOutcome(
        status: InspectionResultType.REVOQUE_ROUGE,
        code: 'REVOKED_CREDENTIAL',
        isAuthentic: true,
        title: 'TITRE OFFICIELLEMENT RÉVOQUÉ',
        message:
            'Ce $typeLabel ($credentialId) a été révoqué ou suspendu par l AOTUC. Motif : « $reason ».',
        credentialId: credentialId,
        entityType: rawType,
        entityTypeLabel: typeLabel,
        targetId: targetId,
        keyId: keyId,
        issuedDate: issuedDate,
        expiryDate: expiryDate,
        revocationReason: reason,
      );
      await _logOutcome(qrData, outcome);
      return outcome;
    }

    // 5. Credential Expiration Check
    if (DateTime.now().isAfter(expiryDate)) {
      final expFormatted = _formatDateFr(expiryDate);
      final outcome = InspectionOutcome(
        status: InspectionResultType.EXPIRE_ROUGE,
        code: 'EXPIRED_CREDENTIAL',
        isAuthentic: true,
        title: 'TITRE EXPIRÉ',
        message:
            'La période de validité réglementaire de ce $typeLabel ($credentialId) a expiré le $expFormatted.',
        credentialId: credentialId,
        entityType: rawType,
        entityTypeLabel: typeLabel,
        targetId: targetId,
        keyId: keyId,
        issuedDate: issuedDate,
        expiryDate: expiryDate,
      );
      await _logOutcome(qrData, outcome);
      return outcome;
    }

    // 6. Authentic, Non-Revoked & Valid Credential!
    final isLicence = rawType.contains('LICENCE');
    final validTitle = isLicence
        ? 'LICENCE DE TRANSPORT AUTHENTIQUE & VALIDE'
        : 'BADGE CHAUFFEUR AUTHENTIQUE & VALIDE';
    final expFormatted = _formatDateFr(expiryDate);

    final outcome = InspectionOutcome(
      status: InspectionResultType.VALIDE_VERT,
      code: 'VALID_CREDENTIAL',
      isAuthentic: true,
      title: validTitle,
      message:
          '$typeLabel ($credentialId) certifié conforme par signature Ed25519 AOTUC • Valide jusqu au $expFormatted.',
      credentialId: credentialId,
      entityType: rawType,
      entityTypeLabel: typeLabel,
      targetId: targetId,
      keyId: keyId,
      issuedDate: issuedDate,
      expiryDate: expiryDate,
    );
    await _logOutcome(qrData, outcome);
    return outcome;
  }

  static Future<void> _logOutcome(String qrData, InspectionOutcome outcome) async {
    try {
      await OfflineDatabase.instance.recordInspectionLog(
        id: const Uuid().v4(),
        scannedQr: qrData.length > 250 ? qrData.substring(0, 250) : qrData,
        result: outcome.code,
        reason: '${outcome.title}: ${outcome.message}',
      );
    } catch (_) {
      // Non-blocking audit log write
    }
  }

  static String _formatDateFr(DateTime dt) {
    final local = dt.toLocal();
    final d = local.day.toString().padLeft(2, '0');
    final m = local.month.toString().padLeft(2, '0');
    final y = local.year.toString().padLeft(4, '0');
    return '$d/$m/$y';
  }
}
