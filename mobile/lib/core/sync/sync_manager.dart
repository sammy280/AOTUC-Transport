import 'dart:convert';
import 'package:http/http.dart' as http;
import '../database/offline_database.dart';

class SyncManager {
  final String backendBaseUrl;
  final String authToken;

  SyncManager({
    required this.backendBaseUrl,
    required this.authToken,
  });

  /**
   * Pulls incremental server updates (Revocations, Public Keys).
   */
  Future<bool> pullIncrementalUpdates() async {
    try {
      final uri = Uri.parse('$backendBaseUrl/api/v1/sync/pull');
      final response = await http.get(
        uri,
        headers: {
          'Authorization': 'Bearer $authToken',
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body)['data'];
        final revocations = data['revocations'] as List<dynamic>;

        final db = await OfflineDatabase.instance.database;
        final batch = db.batch();

        for (final rev in revocations) {
          batch.insert(
            'revocations',
            {
              'credential_id': rev['credentialId'],
              'credential_type': rev['credentialType'],
              'revocation_reason': rev['revocationReason'],
              'revoked_at': rev['revokedAt'],
            },
          );
        }

        await batch.commit(noResult: true);
        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  /**
   * Pushes all pending offline drafts to the backend API.
   */
  Future<int> pushPendingDrafts(String deviceId) async {
    final pending = await OfflineDatabase.instance.getPendingSyncDrafts();
    if (pending.isEmpty) return 0;

    final items = pending.map((row) {
      return {
        'clientGeneratedId': row['client_id'],
        'entityType': row['entity_type'],
        'payload': jsonDecode(row['payload_json']),
        'createdOfflineAt': row['created_at'],
      };
    }).toList();

    try {
      final uri = Uri.parse('$backendBaseUrl/api/v1/sync/push');
      final response = await http.post(
        uri,
        headers: {
          'Authorization': 'Bearer $authToken',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'deviceId': deviceId,
          'items': items,
        }),
      );

      if (response.statusCode == 200) {
        final report = jsonDecode(response.body)['data'];
        final results = report['results'] as List<dynamic>;

        for (final res in results) {
          if (res['status'] == 'SUCCESS' || res['status'] == 'ALREADY_SYNCED') {
            await OfflineDatabase.instance.markDraftSynced(res['clientGeneratedId']);
          }
        }
        return report['accepted'] as int;
      }
      return 0;
    } catch (_) {
      return 0;
    }
  }
}
