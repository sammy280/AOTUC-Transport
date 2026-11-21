import 'dart:convert';
import 'package:cryptography/cryptography.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';

class CapturedDocument {
  final String category;
  final String label;
  final String originalName;
  final String mimeType;
  final String base64Data;
  final int sizeBytes;
  final String? fileHashSha256;

  const CapturedDocument({
    required this.category,
    required this.label,
    required this.originalName,
    required this.mimeType,
    required this.base64Data,
    required this.sizeBytes,
    this.fileHashSha256,
  });

  Map<String, dynamic> toJson() => {
        'category': category,
        'originalName': originalName,
        'mimeType': mimeType,
        'base64Data': base64Data,
        'sizeBytes': sizeBytes,
        if (fileHashSha256 != null) 'fileHashSha256': fileHashSha256,
      };
}

class GpsLocationResult {
  final String status; // 'OK', 'PERMISSION_DENIED', 'GPS_DISABLED', 'NO_FIX', 'ERROR'
  final double? latitude;
  final double? longitude;
  final DateTime? capturedAt;
  final String message;

  const GpsLocationResult({
    required this.status,
    this.latitude,
    this.longitude,
    this.capturedAt,
    required this.message,
  });

  bool get hasCoordinates => status == 'OK' && latitude != null && longitude != null;
}

class CameraPermissionResult {
  final String status; // 'GRANTED', 'PERMISSION_DENIED', 'DENIED', 'ERROR'
  final String message;

  const CameraPermissionResult({
    required this.status,
    required this.message,
  });

  bool get isGranted => status == 'GRANTED';
}

class MediaAndGpsService {
  static const MethodChannel _locationChannel =
      MethodChannel('gn.gov.aotuc/location');
  static const MethodChannel _cameraChannel =
      MethodChannel('gn.gov.aotuc/camera');

  static final ImagePicker _picker = ImagePicker();

  static Future<CapturedDocument?> Function({
    required String category,
    required String label,
    required ImageSource source,
  })? _testMediaOverride;

  static Future<GpsLocationResult> Function()? _testGpsOverride;
  static Future<CameraPermissionResult> Function()? _testCameraPermissionOverride;

  static void setTestOverrides({
    Future<CapturedDocument?> Function({
      required String category,
      required String label,
      required ImageSource source,
    })? mediaOverride,
    Future<GpsLocationResult> Function()? gpsOverride,
    Future<CameraPermissionResult> Function()? cameraPermissionOverride,
  }) {
    _testMediaOverride = mediaOverride;
    _testGpsOverride = gpsOverride;
    _testCameraPermissionOverride = cameraPermissionOverride;
  }

  /// Requests Android runtime camera permission for QR code scanning and photo capture.
  static Future<CameraPermissionResult> requestCameraPermission() async {
    if (_testCameraPermissionOverride != null) {
      return await _testCameraPermissionOverride!();
    }
    if (_testMediaOverride != null) {
      return const CameraPermissionResult(
        status: 'GRANTED',
        message: 'Permission caméra accordée.',
      );
    }
    try {
      final raw =
          await _cameraChannel.invokeMethod<dynamic>('requestCameraPermission');
      if (raw is Map) {
        final status = (raw['status'] ?? 'PERMISSION_DENIED').toString();
        final message = (raw['message'] ?? 'Statut caméra inconnu.').toString();
        return CameraPermissionResult(status: status, message: message);
      }
      return const CameraPermissionResult(
        status: 'GRANTED',
        message: 'Permission caméra accordée.',
      );
    } on MissingPluginException {
      // On desktop/headless test environments without the native channel, default to granted unless overridden
      return const CameraPermissionResult(
        status: 'GRANTED',
        message: 'Permission caméra accordée.',
      );
    } catch (e) {
      return CameraPermissionResult(
        status: 'PERMISSION_DENIED',
        message: 'Impossible d accéder à la caméra : $e',
      );
    }
  }

  /// Computes lowercase hex SHA-256 hash of a binary buffer for document integrity verification.
  static Future<String> computeSha256Hex(List<int> bytes) async {
    final hash = await Sha256().hash(bytes);
    return hash.bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  }

  /// Verifies that a document map has valid non-empty base64 data and matches its SHA-256 hash if present.
  static Future<bool> verifyDocumentIntegrity(Map<String, dynamic> doc) async {
    try {
      final rawB64 = (doc['base64Data'] ?? '').toString().trim();
      if (rawB64.isEmpty) return false;
      final cleanB64 = rawB64.replaceFirst(RegExp(r'^data:[^;]+;base64,'), '');
      final bytes = base64Decode(cleanB64);
      if (bytes.isEmpty) return false;

      final expectedHash = doc['fileHashSha256']?.toString().trim().toLowerCase();
      if (expectedHash != null && expectedHash.isNotEmpty) {
        final actualHash = await computeSha256Hex(bytes);
        if (actualHash != expectedHash) return false;
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Captures an image from the device camera or selects from storage using `image_picker`.
  static Future<CapturedDocument?> pickDocumentImage({
    required String category,
    required String label,
    required ImageSource source,
  }) async {
    if (_testMediaOverride != null) {
      final doc = await _testMediaOverride!(
        category: category,
        label: label,
        source: source,
      );
      if (doc != null && doc.fileHashSha256 == null) {
        final bytes = base64Decode(doc.base64Data);
        final sha = await computeSha256Hex(bytes);
        return CapturedDocument(
          category: doc.category,
          label: doc.label,
          originalName: doc.originalName,
          mimeType: doc.mimeType,
          base64Data: doc.base64Data,
          sizeBytes: doc.sizeBytes,
          fileHashSha256: sha,
        );
      }
      return doc;
    }

    final XFile? file = await _picker.pickImage(
      source: source,
      imageQuality: 80,
      maxWidth: 1600,
      maxHeight: 1600,
    );

    if (file == null) return null;

    final bytes = await file.readAsBytes();
    final sha256 = await computeSha256Hex(bytes);
    final ext = file.name.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
    final mime = ext == 'png' ? 'image/png' : 'image/jpeg';

    return CapturedDocument(
      category: category,
      label: label,
      originalName: file.name.isNotEmpty ? file.name : '${category.toLowerCase()}.$ext',
      mimeType: mime,
      base64Data: base64Encode(bytes),
      sizeBytes: bytes.length,
      fileHashSha256: sha256,
    );
  }

  /// Requests location permission and captures GPS coordinates from the device.
  static Future<GpsLocationResult> captureCurrentGps() async {
    if (_testGpsOverride != null) {
      return _testGpsOverride!();
    }

    try {
      final raw = await _locationChannel.invokeMethod<dynamic>('getCurrentLocation');
      if (raw is Map) {
        final status = (raw['status'] ?? 'ERROR').toString();
        if (status == 'OK') {
          final lat = (raw['latitude'] as num).toDouble();
          final lng = (raw['longitude'] as num).toDouble();
          final tsMs = raw['timestamp'] as int?;
          final dt = tsMs != null
              ? DateTime.fromMillisecondsSinceEpoch(tsMs)
              : DateTime.now();
          return GpsLocationResult(
            status: 'OK',
            latitude: lat,
            longitude: lng,
            capturedAt: dt,
            message:
                'Position GPS verrouillée (${lat.toStringAsFixed(5)}, ${lng.toStringAsFixed(5)})',
          );
        }
        return GpsLocationResult(
          status: status,
          message: (raw['message'] ?? 'Position GPS non disponible.').toString(),
        );
      }
      return const GpsLocationResult(
        status: 'NO_FIX',
        message: 'Service GPS indisponible sur cet environnement.',
      );
    } on MissingPluginException {
      return const GpsLocationResult(
        status: 'NO_FIX',
        message: 'Capteur GPS matériel non détecté sur cet appareil.',
      );
    } catch (e) {
      return GpsLocationResult(
        status: 'ERROR',
        message: 'Impossible d acquérir le signal GPS: $e',
      );
    }
  }
}
