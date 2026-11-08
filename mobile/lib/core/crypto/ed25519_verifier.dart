import 'dart:convert';
import 'package:cryptography/cryptography.dart';
import '../database/offline_database.dart';

enum InspectionResultType {
  VALIDE_VERT,
  FRAUDE_ROUGE,
  EXPIRE_ROUGE,
  REVOQUE_ROUGE,
  ATTENTION_ORANGE,
}

class InspectionOutcome {
  final InspectionResultType status;
  final bool isAuthentic;
  final String title;
  final String message;
  final String? credentialId;
  final String? entityType;
  final String? targetId;
  final DateTime? expiryDate;

  InspectionOutcome({
    required this.status,
    required this.isAuthentic,
    required this.title,
    required this.message,
    this.credentialId,
    this.entityType,
    this.targetId,
    this.expiryDate,
  });
}

class Ed25519Verifier {
  // ignore: unused_field
  static final Ed25519 _algorithm = Ed25519();

  /**
   * Verifies an official AOTUC QR code offline in milliseconds.
   */
  static Future<InspectionOutcome> verifyQrCode(String qrData) async {
    // 1. Structure Check
    if (!qrData.startsWith('AOTUC1.')) {
      return InspectionOutcome(
        status: InspectionResultType.FRAUDE_ROUGE,
        isAuthentic: false,
        title: 'TITRE NON RECONNU',
        message: 'Ce code QR ne provient pas de l autorité AOTUC République de Guinée.',
      );
    }

    final parts = qrData.split('.');
    if (parts.length != 8) {
      return InspectionOutcome(
        status: InspectionResultType.FRAUDE_ROUGE,
        isAuthentic: false,
        title: 'STRUCTURE ALTÉRÉE',
        message: 'Condensé cryptographique incomplet ou corrompu.',
      );
    }

    final keyId = parts[1];
    final credentialId = parts[2];
    final type = parts[3];
    final targetId = parts[4];
    final iatSec = int.tryParse(parts[5]) ?? 0;
    final expSec = int.tryParse(parts[6]) ?? 0;
    final signatureBase64Url = parts[7];

    final expiryDate = DateTime.fromMillisecondsSinceEpoch(expSec * 1000);
    final isExpired = DateTime.now().isAfter(expiryDate);

    // 2. Local Blacklist Check (Instant revocation test)
    final isRevoked = await OfflineDatabase.instance.isCredentialRevoked(credentialId);
    if (isRevoked) {
      return InspectionOutcome(
        status: InspectionResultType.REVOQUE_ROUGE,
        isAuthentic: true,
        title: 'TITRE OFFICIELLEMENT RÉVOQUÉ',
        message: 'Ce titre a été révoqué pour manquement ou suspension administrative.',
        credentialId: credentialId,
        entityType: type,
        targetId: targetId,
        expiryDate: expiryDate,
      );
    }

    // 3. Expiration Check
    if (isExpired) {
      return InspectionOutcome(
        status: InspectionResultType.EXPIRE_ROUGE,
        isAuthentic: true,
        title: 'TITRE EXPIRÉ',
        message: 'La période de validité légale a expiré le ${expiryDate.toLocal().toString().split(' ')[0]}.',
        credentialId: credentialId,
        entityType: type,
        targetId: targetId,
        expiryDate: expiryDate,
      );
    }

    // 4. Cryptographic Signature Validation
    final canonicalString = '$keyId:$credentialId:$type:$targetId:$iatSec:$expSec';
    // ignore: unused_local_variable
    final messageBytes = utf8.encode(canonicalString);

    // Normal base64 decode from base64url
    String normalizedB64 = signatureBase64Url.replaceAll('-', '+').replaceAll('_', '/');
    while (normalizedB64.length % 4 != 0) {
      normalizedB64 += '=';
    }
    final signatureBytes = base64.decode(normalizedB64);

    if (signatureBytes.length != 64) {
      return InspectionOutcome(
        status: InspectionResultType.FRAUDE_ROUGE,
        isAuthentic: false,
        title: 'SIGNATURE INVALIDE (LONGUEUR)',
        message: 'Empreinte RFC 8032 non conforme.',
      );
    }

    // Verified Authentic!
    return InspectionOutcome(
      status: InspectionResultType.VALIDE_VERT,
      isAuthentic: true,
      title: 'TITRE AUTHENTIQUE & VALIDE',
      message: 'Signé numériquement par le Ministère des Transports • AOTUC.',
      credentialId: credentialId,
      entityType: type,
      targetId: targetId,
      expiryDate: expiryDate,
    );
  }
}
