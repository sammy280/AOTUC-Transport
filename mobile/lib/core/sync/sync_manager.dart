import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../database/offline_database.dart';
import '../services/media_and_gps_service.dart';

class SyncBatchSummary {
  final int totalItems;
  final int accepted;
  final int duplicates;
  final int conflicts;
  final int failed;
  final bool wasSkippedDuplicateCall;
  final bool networkFailed;
  final String message;
  final DateTime timestamp;

  const SyncBatchSummary({
    required this.totalItems,
    required this.accepted,
    required this.duplicates,
    required this.conflicts,
    required this.failed,
    this.wasSkippedDuplicateCall = false,
    this.networkFailed = false,
    required this.message,
    required this.timestamp,
  });
}

class SyncManager extends ChangeNotifier {
  final String backendBaseUrl;
  final String authToken;
  final String agentUserId;
  final String? deviceId;
  final http.Client _httpClient;

  // Mutex / In-flight lock to prevent simultaneous duplicate synchronization
  static final Map<String, Future<SyncBatchSummary>> _activeSyncByAgent = {};

  bool _isSyncing = false;
  bool _isOnline = true;
  int _totalInBatch = 0;
  int _processedInBatch = 0;
  String? _lastSyncedAt;
  String? _lastSummaryMessage;
  bool _lastSyncHadError = false;
  int _httpPushCallCount = 0;

  SyncManager({
    required this.backendBaseUrl,
    required this.authToken,
    required this.agentUserId,
    this.deviceId,
    http.Client? httpClient,
  }) : _httpClient = httpClient ?? http.Client();

  bool get isSyncing => _isSyncing || _activeSyncByAgent.containsKey(agentUserId);
  bool get isOnline => _isOnline;
  int get totalInBatch => _totalInBatch;
  int get processedInBatch => _processedInBatch;
  String? get lastSyncedAt => _lastSyncedAt;
  String? get lastSummaryMessage => _lastSummaryMessage;
  bool get lastSyncHadError => _lastSyncHadError;
  int get httpPushCallCount => _httpPushCallCount;

  /// Loads persisted sync metadata and recovers any records interrupted during a previous crash.
  Future<void> initialize() async {
    await OfflineDatabase.instance.recoverInterruptedSyncingDrafts(
      agentUserId: agentUserId,
    );
    _lastSyncedAt = await OfflineDatabase.instance.getLastSyncTimestamp(
      agentUserId: agentUserId,
    );
    notifyListeners();
  }

  /// Probes server connectivity and automatically synchronizes pending records when online.
  Future<bool> checkConnectivityAndAutoSync(String syncDeviceId) async {
    final wasOffline = !_isOnline;
    try {
      final uri = Uri.parse('$backendBaseUrl/api/v1/health');
      final response = await _httpClient
          .get(
            uri,
            headers: {
              'Authorization': 'Bearer $authToken',
              'X-Device-Id': syncDeviceId,
            },
          )
          .timeout(const Duration(seconds: 5));

      _isOnline = response.statusCode >= 200 && response.statusCode < 500;
    } catch (_) {
      _isOnline = false;
    }
    notifyListeners();

    if (_isOnline && wasOffline) {
      await onConnectivityChanged(
        isConnected: true,
        syncDeviceId: syncDeviceId,
      );
    }
    return _isOnline;
  }

  /// Called when network connectivity state changes.
  /// When connectivity returns (`isConnected == true`), automatically retries network-interrupted
  /// drafts and synchronizes all pending records for [agentUserId].
  Future<SyncBatchSummary?> onConnectivityChanged({
    required bool isConnected,
    required String syncDeviceId,
  }) async {
    _isOnline = isConnected;
    notifyListeners();

    if (!isConnected) return null;

    return await synchronizePendingDrafts(
      syncDeviceId,
      trigger: 'AUTO_RECONNECT',
    );
  }

  /// Pulls incremental server updates (Revocations, Public Keys, Lines, Communes, Unions).
  Future<bool> pullIncrementalUpdates() async {
    try {
      final uri = Uri.parse('$backendBaseUrl/api/v1/sync/pull');
      final response = await _httpClient.get(
        uri,
        headers: {
          'Authorization': 'Bearer $authToken',
          if (deviceId != null) 'X-Device-Id': deviceId!,
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        _isOnline = true;
        final data = jsonDecode(response.body)['data'];
        final revocations = (data['revocations'] as List<dynamic>?) ?? [];
        await OfflineDatabase.instance.saveRevocationsBatch(revocations);
        notifyListeners();
        return true;
      }
      return false;
    } catch (_) {
      _isOnline = false;
      notifyListeners();
      return false;
    }
  }

  /// Resolves cross-batch clientGeneratedId references (`ownerClientGeneratedId`,
  /// `driverClientGeneratedId`, `personClientGeneratedId`, `vehicleClientGeneratedId`)
  /// using previously synchronized records stored in SQLite.
  Future<Map<String, dynamic>> _preparePayloadWithResolvedRelationships(
    String entityType,
    Map<String, dynamic> rawPayload,
  ) async {
    final payload = Map<String, dynamic>.from(rawPayload);

    if (entityType == 'VEHICLE') {
      final ownerClientRef = payload['ownerClientGeneratedId']?.toString();
      if ((payload['ownerId'] == null || payload['ownerId'].toString().isEmpty) &&
          ownerClientRef != null &&
          ownerClientRef.isNotEmpty) {
        final resolvedOwnerId = await OfflineDatabase.instance.getResolvedServerId(
          clientId: ownerClientRef,
          agentUserId: agentUserId,
        );
        if (resolvedOwnerId != null && resolvedOwnerId.isNotEmpty) {
          payload['ownerId'] = resolvedOwnerId;
        }
      }

      final driverClientRef = payload['driverClientGeneratedId']?.toString();
      if ((payload['driverId'] == null || payload['driverId'].toString().isEmpty) &&
          driverClientRef != null &&
          driverClientRef.isNotEmpty) {
        final resolvedDriverId = await OfflineDatabase.instance.getResolvedServerId(
          clientId: driverClientRef,
          agentUserId: agentUserId,
        );
        if (resolvedDriverId != null && resolvedDriverId.isNotEmpty) {
          payload['driverId'] = resolvedDriverId;
        }
      }
    } else if (entityType == 'DOCUMENT') {
      final personClientRef = (payload['personClientGeneratedId'] ??
              payload['driverClientGeneratedId'] ??
              payload['ownerClientGeneratedId'])
          ?.toString();
      if ((payload['personId'] == null || payload['personId'].toString().isEmpty) &&
          personClientRef != null &&
          personClientRef.isNotEmpty) {
        final resolvedPersonId = await OfflineDatabase.instance.getResolvedPersonId(
          clientId: personClientRef,
          agentUserId: agentUserId,
        );
        if (resolvedPersonId != null && resolvedPersonId.isNotEmpty) {
          payload['personId'] = resolvedPersonId;
        }
      }

      final vehicleClientRef = payload['vehicleClientGeneratedId']?.toString();
      if ((payload['vehicleId'] == null || payload['vehicleId'].toString().isEmpty) &&
          vehicleClientRef != null &&
          vehicleClientRef.isNotEmpty) {
        final resolvedVehicleId = await OfflineDatabase.instance.getResolvedServerId(
          clientId: vehicleClientRef,
          agentUserId: agentUserId,
        );
        if (resolvedVehicleId != null && resolvedVehicleId.isNotEmpty) {
          payload['vehicleId'] = resolvedVehicleId;
        }
      }
    }

    return payload;
  }

  /// Verifies binary & SHA-256 integrity of any attached documents before uploading.
  Future<String?> _verifyDraftDocumentsIntegrity(
    String entityType,
    Map<String, dynamic> payload,
  ) async {
    if (entityType == 'DOCUMENT') {
      final ok = await MediaAndGpsService.verifyDocumentIntegrity(payload);
      if (!ok) {
        return 'Intégrité du fichier compromise (base64 ou empreinte SHA-256 invalide).';
      }
      return null;
    }

    final docs = payload['documents'];
    if (docs is List) {
      for (final d in docs) {
        if (d is Map) {
          final docMap = Map<String, dynamic>.from(d);
          final ok = await MediaAndGpsService.verifyDocumentIntegrity(docMap);
          if (!ok) {
            final name = docMap['originalName'] ?? docMap['category'] ?? 'Document';
            return 'Intégrité compromise pour la pièce jointe "$name" (empreinte SHA-256 invalide).';
          }
        }
      }
    }
    return null;
  }

  /// Synchronizes all pending offline drafts for [agentUserId] in strict dependency order:
  /// OWNER -> DRIVER -> VEHICLE -> DOCUMENT.
  /// Prevents simultaneous duplicate synchronization via an in-flight mutex.
  Future<SyncBatchSummary> synchronizePendingDrafts(
    String syncDeviceId, {
    String trigger = 'MANUAL',
    List<String>? onlyClientIds,
  }) async {
    // 1. Prevent simultaneous duplicate synchronization
    final existingFuture = _activeSyncByAgent[agentUserId];
    if (existingFuture != null) {
      final completed = await existingFuture;
      return SyncBatchSummary(
        totalItems: completed.totalItems,
        accepted: completed.accepted,
        duplicates: completed.duplicates,
        conflicts: completed.conflicts,
        failed: completed.failed,
        wasSkippedDuplicateCall: true,
        networkFailed: completed.networkFailed,
        message: completed.message,
        timestamp: completed.timestamp,
      );
    }

    final syncFuture = _executeSyncInternal(
      syncDeviceId,
      trigger: trigger,
      onlyClientIds: onlyClientIds,
    );
    _activeSyncByAgent[agentUserId] = syncFuture;

    try {
      return await syncFuture;
    } finally {
      _activeSyncByAgent.remove(agentUserId);
    }
  }

  Future<SyncBatchSummary> _executeSyncInternal(
    String syncDeviceId, {
    required String trigger,
    List<String>? onlyClientIds,
  }) async {
    _isSyncing = true;
    _processedInBatch = 0;
    _totalInBatch = 0;
    notifyListeners();

    try {
      // Recover any records left in SYNCING from an earlier crash
      await OfflineDatabase.instance.recoverInterruptedSyncingDrafts(
        agentUserId: agentUserId,
      );

      // If triggered by reconnection (or manual sync), re-queue drafts that failed purely due to a dropped connection
      if (trigger == 'AUTO_RECONNECT' || trigger == 'MANUAL') {
        final allDrafts = await OfflineDatabase.instance.getAllDraftsForAgent(
          agentUserId: agentUserId,
        );
        for (final row in allDrafts) {
          if (row['sync_status'] == 'FAILED' &&
              row['error_code'] == 'NETWORK_INTERRUPTED') {
            await OfflineDatabase.instance.resetDraftForRetry(
              clientId: row['client_id'] as String,
              agentUserId: agentUserId,
            );
          }
        }
      }

      var pending = await OfflineDatabase.instance.getPendingSyncDrafts(
        agentUserId: agentUserId,
      );

      if (onlyClientIds != null && onlyClientIds.isNotEmpty) {
        final targetSet = onlyClientIds.toSet();
        pending = pending
            .where((row) => targetSet.contains(row['client_id']?.toString()))
            .toList();
      }

      if (pending.isEmpty) {
        const msg = 'Aucun dossier en attente de synchronisation.';
        _lastSummaryMessage = msg;
        _lastSyncHadError = false;
        return SyncBatchSummary(
          totalItems: 0,
          accepted: 0,
          duplicates: 0,
          conflicts: 0,
          failed: 0,
          message: msg,
          timestamp: DateTime.now(),
        );
      }

      _totalInBatch = pending.length;
      notifyListeners();

      final validItemsToPush = <Map<String, dynamic>>[];
      int localIntegrityFailures = 0;

      // Validate document integrity and transition valid items to SYNCING
      for (final row in pending) {
        final clientId = row['client_id'] as String;
        final entityType = (row['entity_type'] as String).toUpperCase();
        final rawPayload =
            jsonDecode(row['payload_json'] as String) as Map<String, dynamic>;

        final integrityError = await _verifyDraftDocumentsIntegrity(
          entityType,
          rawPayload,
        );
        if (integrityError != null) {
          await OfflineDatabase.instance.markDraftFailed(
            clientId: clientId,
            errorCode: 'DOCUMENT_INTEGRITY_MISMATCH',
            message: integrityError,
          );
          localIntegrityFailures++;
          _processedInBatch++;
          notifyListeners();
          continue;
        }

        final preparedPayload = await _preparePayloadWithResolvedRelationships(
          entityType,
          rawPayload,
        );

        await OfflineDatabase.instance.markDraftSyncing(clientId);

        validItemsToPush.add({
          'clientGeneratedId': clientId,
          'entityType': entityType,
          'payload': preparedPayload,
          'createdOfflineAt': row['created_at'],
        });
      }

      if (validItemsToPush.isEmpty) {
        final msg =
            'Échec de vérification d intégrité sur $localIntegrityFailures dossier(s).';
        _lastSummaryMessage = msg;
        _lastSyncHadError = true;
        return SyncBatchSummary(
          totalItems: pending.length,
          accepted: 0,
          duplicates: 0,
          conflicts: 0,
          failed: localIntegrityFailures,
          message: msg,
          timestamp: DateTime.now(),
        );
      }

      _httpPushCallCount++;
      final uri = Uri.parse('$backendBaseUrl/api/v1/sync/push');
      final response = await _httpClient
          .post(
            uri,
            headers: {
              'Authorization': 'Bearer $authToken',
              'X-Device-Id': syncDeviceId,
              'Content-Type': 'application/json',
            },
            body: jsonEncode({
              'deviceId': syncDeviceId,
              'items': validItemsToPush,
            }),
          )
          .timeout(const Duration(seconds: 25));

      if (response.statusCode == 200) {
        _isOnline = true;
        final report = jsonDecode(response.body)['data'] as Map<String, dynamic>;
        final results = (report['results'] as List<dynamic>?) ?? [];
        final syncedAtIso =
            report['syncedAt']?.toString() ?? DateTime.now().toIso8601String();

        int acceptedCount = 0;
        int duplicateCount = 0;
        int conflictCount = 0;
        int failedCount = localIntegrityFailures;

        for (final rawRes in results) {
          final res = rawRes as Map<String, dynamic>;
          final clientId = res['clientGeneratedId'] as String;
          final status = (res['status'] ?? '').toString().toUpperCase();
          final serverId = res['serverRecordId']?.toString();
          final personId = res['personId']?.toString();

          if (status == 'SUCCESS') {
            await OfflineDatabase.instance.markDraftSynced(
              clientId,
              serverRecordId: serverId,
              personRecordId: personId,
              syncedAt: syncedAtIso,
            );
            acceptedCount++;
          } else if (status == 'ALREADY_SYNCED' || status == 'DUPLICATE') {
            await OfflineDatabase.instance.markDraftSynced(
              clientId,
              serverRecordId: serverId,
              personRecordId: personId,
              syncedAt: syncedAtIso,
            );
            duplicateCount++;
          } else if (status == 'CONFLICT') {
            await OfflineDatabase.instance.markDraftConflict(
              clientId: clientId,
              conflictCode:
                  (res['conflictCode'] ?? 'SYNC_CONFLICT').toString(),
              message: (res['message'] ??
                      'Conflit détecté sur le serveur AOTUC.')
                  .toString(),
              serverRecordId: serverId,
            );
            conflictCount++;
          } else {
            await OfflineDatabase.instance.markDraftFailed(
              clientId: clientId,
              errorCode: (res['errorCode'] ?? 'SYNC_ERROR').toString(),
              message: (res['error'] ??
                      res['message'] ??
                      'Erreur lors de la validation du dossier.')
                  .toString(),
            );
            failedCount++;
          }
          _processedInBatch++;
          notifyListeners();
        }

        if (acceptedCount > 0 || duplicateCount > 0) {
          _lastSyncedAt = syncedAtIso;
          await OfflineDatabase.instance.setLastSyncTimestamp(
            agentUserId: agentUserId,
            timestampIso: syncedAtIso,
          );
        }

        final hasIssues = conflictCount > 0 || failedCount > 0;
        _lastSyncHadError = hasIssues;
        final summaryMsg = _buildSummaryMessage(
          accepted: acceptedCount,
          duplicates: duplicateCount,
          conflicts: conflictCount,
          failed: failedCount,
        );
        _lastSummaryMessage = summaryMsg;

        return SyncBatchSummary(
          totalItems: pending.length,
          accepted: acceptedCount,
          duplicates: duplicateCount,
          conflicts: conflictCount,
          failed: failedCount,
          message: summaryMsg,
          timestamp: DateTime.now(),
        );
      } else {
        // Non-200 HTTP response -> preserve all items safely as FAILED for retry
        final serverMsg =
            'Le serveur AOTUC a répondu avec le code ${response.statusCode}. Vos dossiers restent protégés hors-ligne.';
        for (final item in validItemsToPush) {
          await OfflineDatabase.instance.markDraftFailed(
            clientId: item['clientGeneratedId'] as String,
            errorCode: 'HTTP_${response.statusCode}',
            message: serverMsg,
          );
        }
        _lastSyncHadError = true;
        _lastSummaryMessage = serverMsg;
        return SyncBatchSummary(
          totalItems: pending.length,
          accepted: 0,
          duplicates: 0,
          conflicts: 0,
          failed: pending.length,
          networkFailed: true,
          message: serverMsg,
          timestamp: DateTime.now(),
        );
      }
    } catch (_) {
      // Interrupted upload or network drop -> preserve all SYNCING records with NETWORK_INTERRUPTED
      _isOnline = false;
      const netMsg =
          'Connexion interrompue pendant la synchronisation. Tous les dossiers et documents restent enregistrés hors-ligne.';
      final allRows = await OfflineDatabase.instance.getAllDraftsForAgent(
        agentUserId: agentUserId,
      );
      int interruptedCount = 0;
      for (final row in allRows) {
        if (row['sync_status'] == 'SYNCING') {
          await OfflineDatabase.instance.markDraftFailed(
            clientId: row['client_id'] as String,
            errorCode: 'NETWORK_INTERRUPTED',
            message: netMsg,
          );
          interruptedCount++;
        }
      }
      _lastSyncHadError = true;
      _lastSummaryMessage = netMsg;
      return SyncBatchSummary(
        totalItems: interruptedCount,
        accepted: 0,
        duplicates: 0,
        conflicts: 0,
        failed: interruptedCount,
        networkFailed: true,
        message: netMsg,
        timestamp: DateTime.now(),
      );
    } finally {
      _isSyncing = false;
      notifyListeners();
    }
  }

  /// Retries a single failed/pending/conflicted record (and automatically includes any
  /// unsynchronized parent OWNER/DRIVER/VEHICLE records it depends on).
  Future<SyncBatchSummary> retrySingleDraft(
    String clientId,
    String syncDeviceId,
  ) async {
    final allRows = await OfflineDatabase.instance.getAllDraftsForAgent(
      agentUserId: agentUserId,
    );

    final targetRow = allRows.where((r) => r['client_id'] == clientId).firstOrNull;
    if (targetRow == null) {
      return SyncBatchSummary(
        totalItems: 0,
        accepted: 0,
        duplicates: 0,
        conflicts: 0,
        failed: 0,
        message: 'Dossier introuvable.',
        timestamp: DateTime.now(),
      );
    }

    final idsToSync = <String>{clientId};
    final payload =
        jsonDecode(targetRow['payload_json'] as String) as Map<String, dynamic>;

    // Include any unsynchronized parent dependency (OWNER / DRIVER / VEHICLE)
    for (final depKey in [
      'ownerClientGeneratedId',
      'driverClientGeneratedId',
      'personClientGeneratedId',
      'vehicleClientGeneratedId',
    ]) {
      final depClientId = payload[depKey]?.toString();
      if (depClientId != null && depClientId.isNotEmpty) {
        final depRow =
            allRows.where((r) => r['client_id'] == depClientId).firstOrNull;
        if (depRow != null && depRow['sync_status'] != 'SYNCED') {
          await OfflineDatabase.instance.resetDraftForRetry(
            clientId: depClientId,
            agentUserId: agentUserId,
          );
          idsToSync.add(depClientId);
        }
      }
    }

    await OfflineDatabase.instance.resetDraftForRetry(
      clientId: clientId,
      agentUserId: agentUserId,
    );

    return await synchronizePendingDrafts(
      syncDeviceId,
      trigger: 'SINGLE_RETRY',
      onlyClientIds: idsToSync.toList(),
    );
  }

  /// Resets all FAILED records for [agentUserId] to PENDING and synchronizes them in order.
  Future<SyncBatchSummary> retryAllFailedDrafts(String syncDeviceId) async {
    final allRows = await OfflineDatabase.instance.getAllDraftsForAgent(
      agentUserId: agentUserId,
    );
    for (final row in allRows) {
      if (row['sync_status'] == 'FAILED') {
        await OfflineDatabase.instance.resetDraftForRetry(
          clientId: row['client_id'] as String,
          agentUserId: agentUserId,
        );
      }
    }
    return await synchronizePendingDrafts(syncDeviceId, trigger: 'BATCH_RETRY');
  }

  /// Updates a conflicted/failed draft's fields (without overwriting any server record)
  /// and retries synchronizing it.
  Future<SyncBatchSummary> resolveConflictAndRetry({
    required String clientId,
    required Map<String, dynamic> updatedPayload,
    required String syncDeviceId,
  }) async {
    await OfflineDatabase.instance.updateDraftPayload(
      clientId: clientId,
      agentUserId: agentUserId,
      payloadJson: jsonEncode(updatedPayload),
      resetToPending: true,
    );
    return await retrySingleDraft(clientId, syncDeviceId);
  }

  /// Legacy compatibility helper returning count of newly accepted records.
  Future<int> pushPendingDrafts(String syncDeviceId) async {
    final summary = await synchronizePendingDrafts(syncDeviceId);
    return summary.accepted + summary.duplicates;
  }

  String _buildSummaryMessage({
    required int accepted,
    required int duplicates,
    required int conflicts,
    required int failed,
  }) {
    final parts = <String>[];
    if (accepted > 0) parts.add('$accepted synchronisé(s)');
    if (duplicates > 0) parts.add('$duplicates déjà à jour');
    if (conflicts > 0) parts.add('$conflicts conflit(s) à vérifier');
    if (failed > 0) parts.add('$failed échec(s)');
    if (parts.isEmpty) return 'Synchronisation terminée.';
    return 'Synchronisation : ${parts.join(' • ')}.';
  }
}
