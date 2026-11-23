import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:uuid/uuid.dart';
import '../auth/auth_service.dart';
import '../database/offline_database.dart';

class ReferenceCatalog {
  final List<Map<String, dynamic>> owners;
  final List<Map<String, dynamic>> drivers;
  final List<Map<String, dynamic>> lines;
  final List<Map<String, dynamic>> unions;

  const ReferenceCatalog({
    this.owners = const [],
    this.drivers = const [],
    this.lines = const [],
    this.unions = const [],
  });
}

class RegistrationSubmissionResult {
  final bool success;
  final String mode; // 'ONLINE' | 'OFFLINE_QUEUED' | 'REJECTED'
  final String? recordId;
  final String message;

  const RegistrationSubmissionResult({
    required this.success,
    required this.mode,
    this.recordId,
    required this.message,
  });
}

class RegistrationApiService {
  final AuthService authService;
  final http.Client _httpClient;

  RegistrationApiService({
    required this.authService,
    http.Client? httpClient,
  }) : _httpClient = httpClient ?? authService.httpClient;

  Map<String, String> _buildHeaders(String? deviceId) {
    return {
      'Content-Type': 'application/json',
      if (authService.accessToken != null)
        'Authorization': 'Bearer ${authService.accessToken}',
      if (deviceId != null) 'X-Device-Id': deviceId,
    };
  }

  /// Loads Owners, Drivers, Transport Lines, and Unions from both the backend API
  /// and the current agent's local offline drafts so relationships work online and offline.
  Future<ReferenceCatalog> loadReferenceCatalog() async {
    final user = authService.currentUser;
    if (user == null) return const ReferenceCatalog();

    final devId = await authService.getOrCreateDeviceId();
    final headers = _buildHeaders(devId);
    final baseUrl = authService.backendBaseUrl;

    final owners = <Map<String, dynamic>>[];
    final drivers = <Map<String, dynamic>>[];
    final lines = <Map<String, dynamic>>[];
    final unions = <Map<String, dynamic>>[];

    // 1. Include agent's local queued owners & drivers so offline-created owners/drivers
    // can immediately be linked to a vehicle
    final localDrafts = await OfflineDatabase.instance.getPendingSyncDrafts(
      agentUserId: user.id,
    );

    for (final row in localDrafts) {
      final entityType = row['entity_type'] as String;
      final clientId = row['client_id'] as String;
      final payload = jsonDecode(row['payload_json'] as String) as Map<String, dynamic>;

      if (entityType == 'OWNER') {
        final fullName = payload['ownerType'] == 'ENTREPRISE' &&
                (payload['businessName']?.toString().isNotEmpty ?? false)
            ? '${payload['businessName']} (${payload['firstName']} ${payload['lastName']})'
            : '${payload['firstName']} ${payload['lastName']}';
        owners.add({
          'id': null,
          'clientGeneratedId': clientId,
          'label': '$fullName • NIN: ${payload['nin']} (Hors-ligne)',
          'nin': payload['nin'],
          'phoneNumber': payload['phoneNumber'],
          'isOfflineDraft': true,
        });
      } else if (entityType == 'DRIVER') {
        drivers.add({
          'id': null,
          'clientGeneratedId': clientId,
          'label':
              '${payload['firstName']} ${payload['lastName']} • Permis: ${payload['drivingLicenseNumber']} (Hors-ligne)',
          'nin': payload['nin'],
          'drivingLicenseNumber': payload['drivingLicenseNumber'],
          'isOfflineDraft': true,
        });
      } else if (entityType == 'UNION' || entityType == 'TRANSPORT_UNION') {
        unions.add({
          'id': clientId,
          'clientGeneratedId': clientId,
          'code': payload['code'],
          'name': payload['name'],
          'label': '${payload['code']} — ${payload['name']} (Hors-ligne)',
          'registrationNumber': payload['registrationNumber'],
          'status': payload['status'] ?? 'ACTIF',
          'communeId': payload['communeId'],
          'isOfflineDraft': true,
        });
      }
    }

    // 2. Fetch live server records if online
    try {
      final ownersRes = await _httpClient
          .get(Uri.parse('$baseUrl/api/v1/registration/owners?limit=50'), headers: headers)
          .timeout(const Duration(seconds: 5));
      if (ownersRes.statusCode == 200) {
        final body = jsonDecode(ownersRes.body) as Map<String, dynamic>;
        final items = (body['data']?['items'] as List<dynamic>?) ?? [];
        for (final item in items) {
          final person = item['person'] as Map<String, dynamic>? ?? {};
          final display = item['ownerType'] == 'ENTREPRISE' &&
                  (item['businessName']?.toString().isNotEmpty ?? false)
              ? '${item['businessName']} (${person['firstName']} ${person['lastName']})'
              : '${person['firstName']} ${person['lastName']}';
          owners.add({
            'id': item['id'],
            'clientGeneratedId': null,
            'label': '$display • NIN: ${person['nin']}',
            'nin': person['nin'],
            'phoneNumber': person['phoneNumber'],
            'isOfflineDraft': false,
          });
        }
      }
    } catch (_) {}

    try {
      final driversRes = await _httpClient
          .get(Uri.parse('$baseUrl/api/v1/registration/drivers?limit=50'), headers: headers)
          .timeout(const Duration(seconds: 5));
      if (driversRes.statusCode == 200) {
        final body = jsonDecode(driversRes.body) as Map<String, dynamic>;
        final items = (body['data']?['items'] as List<dynamic>?) ?? [];
        for (final item in items) {
          final person = item['person'] as Map<String, dynamic>? ?? {};
          drivers.add({
            'id': item['id'],
            'clientGeneratedId': null,
            'label':
                '${person['firstName']} ${person['lastName']} • Permis: ${item['drivingLicenseNumber']}',
            'nin': person['nin'],
            'drivingLicenseNumber': item['drivingLicenseNumber'],
            'isOfflineDraft': false,
          });
        }
      }
    } catch (_) {}

    try {
      final syncRes = await _httpClient
          .get(Uri.parse('$baseUrl/api/v1/sync/pull'), headers: headers)
          .timeout(const Duration(seconds: 5));
      if (syncRes.statusCode == 200) {
        final data = (jsonDecode(syncRes.body) as Map<String, dynamic>)['data'] ?? {};
        for (final l in (data['lines'] as List<dynamic>? ?? [])) {
          lines.add(Map<String, dynamic>.from(l as Map));
        }
        for (final u in (data['unions'] as List<dynamic>? ?? [])) {
          unions.add(Map<String, dynamic>.from(u as Map));
        }
        if (unions.isNotEmpty) {
          await OfflineDatabase.instance.saveUnionsBatch(unions);
        }
      }
    } catch (_) {}

    // If offline or network failed, populate unions from local SQLite database cache
    if (unions.isEmpty) {
      try {
        final cached = await OfflineDatabase.instance.getCachedUnions();
        for (final u in cached) {
          unions.add({
            'id': u['id'],
            'code': u['code'],
            'name': u['name'],
            'registrationNumber': u['registration_number'],
            'status': u['status'],
            'communeId': u['commune_id'],
          });
        }
      } catch (_) {}
    }

    return ReferenceCatalog(
      owners: owners,
      drivers: drivers,
      lines: lines,
      unions: unions,
    );
  }

  /// Searches existing drivers, owners, and vehicles (online + local offline drafts)
  /// so the agent can verify whether a person or vehicle is already registered.
  Future<List<Map<String, dynamic>>> searchExistingRecords(String rawQuery) async {
    final q = rawQuery.trim().toLowerCase();
    if (q.isEmpty) return [];

    final user = authService.currentUser;
    if (user == null) return [];

    final matches = <Map<String, dynamic>>[];

    // 1. Search local offline drafts
    final localDrafts = await OfflineDatabase.instance.getPendingSyncDrafts(
      agentUserId: user.id,
    );
    for (final row in localDrafts) {
      final entityType = row['entity_type'] as String;
      final payload = jsonDecode(row['payload_json'] as String) as Map<String, dynamic>;
      final serialized = jsonEncode(payload).toLowerCase();

      if (serialized.contains(q)) {
        if (entityType == 'DRIVER') {
          final docs = payload['documents'] as List<dynamic>? ?? [];
          String? photoBase64;
          for (final doc in docs) {
            if (doc is Map && doc['category'] == 'PHOTO_PORTRAIT') {
              photoBase64 = doc['base64Data']?.toString();
              break;
            }
          }
          final emergPhone = payload['emergencyContactPhone']?.toString();
          final emergName = payload['emergencyContactName']?.toString();
          final emergRel = payload['emergencyContactRelation']?.toString();
          final emergText = (emergPhone != null && emergPhone.isNotEmpty)
              ? ' • Urgence: $emergPhone${(emergName != null && emergName.isNotEmpty) ? ' ($emergName)' : ''}'
              : '';
          matches.add({
            'type': 'CHAUFFEUR (Hors-ligne)',
            'title': '${payload['firstName']} ${payload['lastName']}',
            'subtitle':
                'NIN: ${payload['nin']} • Permis: ${payload['drivingLicenseNumber']} • Tél: ${payload['phoneNumber']}$emergText',
            'emergencyContactPhone': emergPhone,
            'emergencyContactName': emergName,
            'emergencyContactRelation': emergRel,
            'photoBase64': photoBase64,
          });
        } else if (entityType == 'OWNER') {
          matches.add({
            'type': 'PROPRIÉTAIRE (Hors-ligne)',
            'title': payload['businessName']?.toString().isNotEmpty == true
                ? '${payload['businessName']} (${payload['firstName']} ${payload['lastName']})'
                : '${payload['firstName']} ${payload['lastName']}',
            'subtitle': 'NIN: ${payload['nin']} • Tél: ${payload['phoneNumber']}',
          });
        } else if (entityType == 'VEHICLE') {
          matches.add({
            'type': 'VÉHICULE (Hors-ligne)',
            'title': '${payload['plateNumber']} — ${payload['make']} ${payload['model']}',
            'subtitle':
                'Carte Grise: ${payload['registrationCardNumber']} • VIN: ${payload['chassisVin']}',
          });
        } else if (entityType == 'UNION' || entityType == 'TRANSPORT_UNION') {
          matches.add({
            'type': 'SYNDICAT (Hors-ligne)',
            'title': '${payload['code']} — ${payload['name']}',
            'subtitle':
                'Agrément: ${payload['registrationNumber'] ?? "En attente"} • Représentant: ${payload['presidentName'] ?? "N/A"}${payload['fonction'] != null ? " (${payload['fonction']})" : ""}',
          });
        }
      }
    }

    // 2. Search live backend endpoints if reachable
    final devId = await authService.getOrCreateDeviceId();
    final headers = _buildHeaders(devId);
    final baseUrl = authService.backendBaseUrl;
    final encoded = Uri.encodeQueryComponent(rawQuery.trim());

    try {
      final drvRes = await _httpClient
          .get(Uri.parse('$baseUrl/api/v1/registration/drivers?search=$encoded'), headers: headers)
          .timeout(const Duration(seconds: 5));
      if (drvRes.statusCode == 200) {
        final items =
            ((jsonDecode(drvRes.body) as Map<String, dynamic>)['data']?['items'] as List?) ?? [];
        for (final d in items) {
          final p = d['person'] as Map<String, dynamic>? ?? {};
          final emergPhone = d['emergencyContactPhone']?.toString();
          final emergName = d['emergencyContactName']?.toString();
          final emergRel = d['emergencyContactRelation']?.toString();
          final emergText = (emergPhone != null && emergPhone.isNotEmpty)
              ? ' • Urgence: $emergPhone${(emergName != null && emergName.isNotEmpty) ? ' ($emergName)' : ''}'
              : '';
          matches.add({
            'type': 'CHAUFFEUR (Serveur)',
            'title': '${p['firstName']} ${p['lastName']}',
            'subtitle':
                'NIN: ${p['nin']} • Permis: ${d['drivingLicenseNumber']} • Tél: ${p['phoneNumber']}$emergText',
            'emergencyContactPhone': emergPhone,
            'emergencyContactName': emergName,
            'emergencyContactRelation': emergRel,
          });
        }
      }
    } catch (_) {}

    try {
      final ownRes = await _httpClient
          .get(Uri.parse('$baseUrl/api/v1/registration/owners?search=$encoded'), headers: headers)
          .timeout(const Duration(seconds: 5));
      if (ownRes.statusCode == 200) {
        final items =
            ((jsonDecode(ownRes.body) as Map<String, dynamic>)['data']?['items'] as List?) ?? [];
        for (final o in items) {
          final p = o['person'] as Map<String, dynamic>? ?? {};
          matches.add({
            'type': 'PROPRIÉTAIRE (Serveur)',
            'title': o['businessName']?.toString().isNotEmpty == true
                ? '${o['businessName']} (${p['firstName']} ${p['lastName']})'
                : '${p['firstName']} ${p['lastName']}',
            'subtitle': 'NIN: ${p['nin']} • Tél: ${p['phoneNumber']}',
          });
        }
      }
    } catch (_) {}

    try {
      final vehRes = await _httpClient
          .get(Uri.parse('$baseUrl/api/v1/registration/vehicles?search=$encoded'), headers: headers)
          .timeout(const Duration(seconds: 5));
      if (vehRes.statusCode == 200) {
        final items =
            ((jsonDecode(vehRes.body) as Map<String, dynamic>)['data']?['items'] as List?) ?? [];
        for (final v in items) {
          matches.add({
            'type': 'VÉHICULE (Serveur)',
            'title': '${v['plateNumber']} — ${v['make']} ${v['model']}',
            'subtitle':
                'Carte Grise: ${v['registrationCardNumber']} • VIN: ${v['chassisVin']}',
          });
        }
      }
    } catch (_) {}

    try {
      final unionRes = await _httpClient
          .get(Uri.parse('$baseUrl/api/v1/unions?search=$encoded'), headers: headers)
          .timeout(const Duration(seconds: 5));
      if (unionRes.statusCode == 200) {
        final items =
            ((jsonDecode(unionRes.body) as Map<String, dynamic>)['data']?['items'] as List?) ?? [];
        for (final u in items) {
          matches.add({
            'type': 'SYNDICAT (Serveur)',
            'title': '${u['code']} — ${u['name']}',
            'subtitle':
                'Agrément: ${u['registrationNumber'] ?? "N/A"} • Représentant: ${u['presidentName'] ?? "N/A"}${u['fonction'] != null ? " (${u['fonction']})" : ""}',
          });
        }
      }
    } catch (_) {}

    return matches;
  }

  /// Checks local offline drafts for duplicates before saving or submitting.
  Future<String?> checkLocalDuplicate({
    required String entityType,
    required Map<String, dynamic> payload,
  }) async {
    final user = authService.currentUser;
    if (user == null) return null;

    final drafts = await OfflineDatabase.instance.getPendingSyncDrafts(
      agentUserId: user.id,
    );

    final nin = payload['nin']?.toString().trim().toUpperCase();
    final phone = payload['phoneNumber']?.toString().replaceAll(RegExp(r'\s+'), '');
    final license = payload['drivingLicenseNumber']?.toString().trim().toUpperCase();
    final plate = payload['plateNumber']?.toString().trim().toUpperCase();
    final card = payload['registrationCardNumber']?.toString().trim().toUpperCase();
    final vin = payload['chassisVin']?.toString().trim().toUpperCase();

    for (final row in drafts) {
      final rowType = row['entity_type'] as String;
      final existing = jsonDecode(row['payload_json'] as String) as Map<String, dynamic>;

      if (entityType == 'DRIVER' && rowType == 'DRIVER') {
        if (nin != null && nin.isNotEmpty && existing['nin'] == nin) {
          return 'Doublon détecté : un chauffeur avec le NIN "$nin" est déjà dans votre file hors-ligne.';
        }
        if (license != null &&
            license.isNotEmpty &&
            existing['drivingLicenseNumber'] == license) {
          return 'Doublon détecté : le permis "$license" est déjà enregistré dans votre file hors-ligne.';
        }
        final existingPhone =
            existing['phoneNumber']?.toString().replaceAll(RegExp(r'\s+'), '');
        if (phone != null && phone.isNotEmpty && existingPhone == phone) {
          return 'Doublon détecté : un chauffeur avec le numéro "$phone" existe déjà dans votre file.';
        }
      }

      if (entityType == 'OWNER' && rowType == 'OWNER') {
        if (nin != null && nin.isNotEmpty && existing['nin'] == nin) {
          return 'Doublon détecté : un propriétaire avec le NIN "$nin" est déjà dans votre file hors-ligne.';
        }
      }

      if (entityType == 'VEHICLE' && rowType == 'VEHICLE') {
        if (plate != null && plate.isNotEmpty && existing['plateNumber'] == plate) {
          return 'Doublon détecté : le véhicule immatriculé "$plate" est déjà dans votre file hors-ligne.';
        }
        if (card != null &&
            card.isNotEmpty &&
            existing['registrationCardNumber'] == card) {
          return 'Doublon détecté : la carte grise "$card" est déjà enregistrée dans votre file.';
        }
        if (vin != null && vin.isNotEmpty && existing['chassisVin'] == vin) {
          return 'Doublon détecté : le châssis VIN "$vin" est déjà enregistré dans votre file.';
        }
      }

      if ((entityType == 'UNION' || entityType == 'TRANSPORT_UNION') &&
          (rowType == 'UNION' || rowType == 'TRANSPORT_UNION')) {
        final code = payload['code']?.toString().trim().toUpperCase();
        final name = payload['name']?.toString().trim().toUpperCase();
        final existingCode = existing['code']?.toString().trim().toUpperCase();
        final existingName = existing['name']?.toString().trim().toUpperCase();
        if (code != null && code.isNotEmpty && existingCode == code) {
          return 'Doublon détecté : un syndicat avec le sigle "$code" est déjà dans votre file hors-ligne.';
        }
        if (name != null && name.isNotEmpty && existingName == name) {
          return 'Doublon détecté : un syndicat nommé "$name" est déjà dans votre file hors-ligne.';
        }
      }
    }

    return null;
  }

  /// Submits a registration (DRIVER, OWNER, VEHICLE, or UNION).
  /// - If [preferOffline] is false and server is reachable (and parent references are server UUIDs),
  ///   submits directly to `/api/v1/registration/*` or `/api/v1/unions`.
  /// - If server returns 409 Conflict or 400 Validation Error, rejects immediately with the server message.
  /// - If network is offline or [preferOffline] is true (or vehicle references an offline-queued owner),
  ///   stores the record encrypted with AES-256-GCM in SQLite ready for `/api/v1/sync/push`.
  Future<RegistrationSubmissionResult> submitRegistration({
    required String entityType,
    required Map<String, dynamic> payload,
    bool preferOffline = false,
  }) async {
    final user = authService.currentUser;
    if (user == null || !user.canRegisterFieldRecords) {
      return const RegistrationSubmissionResult(
        success: false,
        mode: 'REJECTED',
        message: 'Accès refusé : votre rôle ne vous autorise pas à enregistrer des dossiers.',
      );
    }

    // 0. If DRIVER has emergencyContactPhone, ensure it is distinct from primary phoneNumber
    if (entityType == 'DRIVER') {
      final primaryPhone =
          payload['phoneNumber']?.toString().replaceAll(RegExp(r'[\s\-\.\(\)]'), '') ?? '';
      final emergencyPhone =
          payload['emergencyContactPhone']?.toString().replaceAll(RegExp(r'[\s\-\.\(\)]'), '') ?? '';
      if (emergencyPhone.isNotEmpty && primaryPhone.isNotEmpty && emergencyPhone == primaryPhone) {
        return const RegistrationSubmissionResult(
          success: false,
          mode: 'REJECTED',
          message:
              "Le numéro d'urgence doit être différent du numéro de téléphone principal du chauffeur.",
        );
      }
    }

    // 1. Check local duplicates first
    final localDupError = await checkLocalDuplicate(
      entityType: entityType,
      payload: payload,
    );
    if (localDupError != null) {
      return RegistrationSubmissionResult(
        success: false,
        mode: 'REJECTED',
        message: localDupError,
      );
    }

    // If a vehicle references an offline owner draft (ownerId is null, ownerClientGeneratedId is set),
    // it must be queued in the offline batch so the owner and vehicle sync together in order.
    final requiresBatchSync = entityType == 'VEHICLE' &&
        (payload['ownerId'] == null || payload['ownerId'].toString().isEmpty) &&
        payload['ownerClientGeneratedId'] != null;

    if (!preferOffline && !requiresBatchSync) {
      final endpointPath = entityType == 'DRIVER'
          ? '/api/v1/registration/drivers'
          : entityType == 'OWNER'
              ? '/api/v1/registration/owners'
              : (entityType == 'UNION' || entityType == 'TRANSPORT_UNION')
                  ? '/api/v1/unions'
                  : '/api/v1/registration/vehicles';

      try {
        final devId = await authService.getOrCreateDeviceId();
        final response = await _httpClient
            .post(
              Uri.parse('${authService.backendBaseUrl}$endpointPath'),
              headers: _buildHeaders(devId),
              body: jsonEncode(payload),
            )
            .timeout(const Duration(seconds: 10));

        if (response.statusCode == 401 || response.statusCode == 403) {
          await authService.handleHttpStatusRejection(response);
        }

        final body = jsonDecode(response.body) as Map<String, dynamic>;

        if (response.statusCode == 201 && body['success'] == true) {
          final data = body['data'] as Map<String, dynamic>? ?? {};
          return RegistrationSubmissionResult(
            success: true,
            mode: 'ONLINE',
            recordId: data['id']?.toString(),
            message: body['message']?.toString() ?? 'Enregistrement validé sur le serveur AOTUC.',
          );
        }

        // Server explicitly rejected due to duplicate (409) or validation error (400/403)
        final errorMsg = body['message']?.toString() ??
            'Enregistrement refusé par le serveur (code ${response.statusCode}).';
        return RegistrationSubmissionResult(
          success: false,
          mode: 'REJECTED',
          message: errorMsg,
        );
      } catch (_) {
        // Network unreachable -> fall through to encrypted offline SQLite storage
      }
    }

    // 2. Store encrypted in SQLite for offline synchronization
    final clientId = const Uuid().v4();
    await OfflineDatabase.instance.insertDraft(
      clientId: clientId,
      agentUserId: user.id,
      agentName: user.fullName,
      entityType: entityType,
      payloadJson: jsonEncode(payload),
    );

    return RegistrationSubmissionResult(
      success: true,
      mode: 'OFFLINE_QUEUED',
      recordId: clientId,
      message:
          'Enregistré hors-ligne (chiffré AES-256) et prêt pour synchronisation vers PostgreSQL.',
    );
  }
}
