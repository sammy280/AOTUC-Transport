import 'dart:async';
import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';
import '../security/local_crypto_service.dart';

class OfflineDatabase {
  static final OfflineDatabase instance = OfflineDatabase._init();
  static Database? _database;

  // In-memory store fallback for headless unit/widget tests where native SQLite is not loaded
  static bool _useInMemoryTestStore = false;
  static final List<Map<String, dynamic>> _memoryDrafts = [];
  static final Map<String, Map<String, dynamic>> _memoryRevocations = {};
  static final Map<String, Map<String, dynamic>> _memoryPublicKeys = {};
  static final List<Map<String, dynamic>> _memoryInspectionLogs = [];
  static final Map<String, Map<String, dynamic>> _memorySyncMeta = {};

  OfflineDatabase._init();

  static void enableInMemoryTestMode() {
    _useInMemoryTestStore = true;
    _memoryDrafts.clear();
    _memoryRevocations.clear();
    _memoryPublicKeys.clear();
    _memoryInspectionLogs.clear();
    _memorySyncMeta.clear();
  }

  /// Simulates an application restart / cold boot while preserving durable SQLite data.
  static Future<void> simulateAppRestart() async {
    if (!_useInMemoryTestStore && _database != null) {
      await _database!.close();
      _database = null;
    }
  }

  static int _entityPriority(String entityType) {
    switch (entityType.toUpperCase()) {
      case 'OWNER':
        return 1;
      case 'DRIVER':
        return 2;
      case 'VEHICLE':
        return 3;
      case 'DOCUMENT':
        return 4;
      default:
        return 99;
    }
  }

  static String normalizeStatus(String? raw) {
    final s = (raw ?? 'PENDING').toUpperCase();
    if (s == 'QUEUED') return 'PENDING';
    return s;
  }

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDB('aotuc_offline.db');
    return _database!;
  }

  Future<Database> _initDB(String filePath) async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, filePath);

    return await openDatabase(
      path,
      version: 3,
      onCreate: _createDB,
      onUpgrade: _upgradeDB,
    );
  }

  Future _createDB(Database db, int version) async {
    // 1. Offline drafts queue scoped by agent_user_id and encrypted with AES-256-GCM
    await db.execute('''
      CREATE TABLE offline_drafts (
        client_id TEXT PRIMARY KEY,
        agent_user_id TEXT NOT NULL,
        agent_name TEXT,
        entity_type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        is_encrypted INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT,
        synced_at TEXT,
        sync_status TEXT NOT NULL DEFAULT 'PENDING',
        server_record_id TEXT,
        person_record_id TEXT,
        error_code TEXT,
        error_message TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0
      )
    ''');

    // 2. Per-agent synchronization metadata (last successful sync timestamps)
    await db.execute('''
      CREATE TABLE sync_metadata (
        agent_user_id TEXT PRIMARY KEY,
        last_synced_at TEXT,
        last_pull_at TEXT
      )
    ''');

    // 3. Cached Ed25519 Public Keys for offline roadside verification
    await db.execute('''
      CREATE TABLE public_keys (
        key_id TEXT PRIMARY KEY,
        algorithm TEXT NOT NULL,
        public_key_pem TEXT NOT NULL,
        valid_from TEXT,
        cached_at TEXT NOT NULL
      )
    ''');

    // 4. Local Revocation Blacklist Snapshot
    await db.execute('''
      CREATE TABLE revocations (
        credential_id TEXT PRIMARY KEY,
        credential_type TEXT NOT NULL,
        revocation_reason TEXT NOT NULL,
        revoked_at TEXT NOT NULL
      )
    ''');

    // 5. Inspection Audit Log
    await db.execute('''
      CREATE TABLE inspection_logs (
        id TEXT PRIMARY KEY,
        scanned_qr TEXT NOT NULL,
        result TEXT NOT NULL,
        reason TEXT,
        timestamp TEXT NOT NULL,
        latitude REAL,
        longitude REAL
      )
    ''');
  }

  Future _upgradeDB(Database db, int oldVersion, int newVersion) async {
    if (oldVersion < 2) {
      await db.execute(
        "ALTER TABLE offline_drafts ADD COLUMN agent_user_id TEXT NOT NULL DEFAULT 'legacy'",
      );
      await db.execute(
        'ALTER TABLE offline_drafts ADD COLUMN is_encrypted INTEGER NOT NULL DEFAULT 0',
      );
    }
    if (oldVersion < 3) {
      final alterStatements = [
        'ALTER TABLE offline_drafts ADD COLUMN agent_name TEXT',
        'ALTER TABLE offline_drafts ADD COLUMN updated_at TEXT',
        'ALTER TABLE offline_drafts ADD COLUMN synced_at TEXT',
        'ALTER TABLE offline_drafts ADD COLUMN server_record_id TEXT',
        'ALTER TABLE offline_drafts ADD COLUMN person_record_id TEXT',
        'ALTER TABLE offline_drafts ADD COLUMN error_code TEXT',
        'ALTER TABLE offline_drafts ADD COLUMN error_message TEXT',
        'ALTER TABLE offline_drafts ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0',
      ];
      for (final stmt in alterStatements) {
        try {
          await db.execute(stmt);
        } catch (_) {
          // Column may already exist
        }
      }
      await db.execute('''
        CREATE TABLE IF NOT EXISTS sync_metadata (
          agent_user_id TEXT PRIMARY KEY,
          last_synced_at TEXT,
          last_pull_at TEXT
        )
      ''');
    }
  }

  /// Inserts an encrypted draft strictly bound to [agentUserId].
  /// Never overwrites or discards unsynchronized records from other agents.
  Future<int> insertDraft({
    required String clientId,
    required String agentUserId,
    String? agentName,
    required String entityType,
    required String payloadJson,
    String? createdAt,
  }) async {
    final encryptedPayload = await LocalCryptoService.encryptPayload(
      payloadJson,
      agentUserId: agentUserId,
    );

    final nowIso = createdAt ?? DateTime.now().toIso8601String();
    final row = <String, dynamic>{
      'client_id': clientId,
      'agent_user_id': agentUserId,
      'agent_name': agentName,
      'entity_type': entityType.toUpperCase(),
      'payload_json': encryptedPayload,
      'is_encrypted': 1,
      'created_at': nowIso,
      'updated_at': nowIso,
      'synced_at': null,
      'sync_status': 'PENDING',
      'server_record_id': null,
      'person_record_id': null,
      'error_code': null,
      'error_message': null,
      'retry_count': 0,
    };

    if (_useInMemoryTestStore) {
      _memoryDrafts.removeWhere((d) => d['client_id'] == clientId);
      _memoryDrafts.add(row);
      return 1;
    }

    final db = await instance.database;
    return await db.insert(
      'offline_drafts',
      row,
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  /// Updates the encrypted payload of an existing draft (e.g., to resolve a conflict)
  /// while preserving its `client_id`, `created_at`, and agent ownership.
  Future<int> updateDraftPayload({
    required String clientId,
    required String agentUserId,
    required String payloadJson,
    bool resetToPending = true,
  }) async {
    final encryptedPayload = await LocalCryptoService.encryptPayload(
      payloadJson,
      agentUserId: agentUserId,
    );
    final nowIso = DateTime.now().toIso8601String();

    if (_useInMemoryTestStore) {
      for (final d in _memoryDrafts) {
        if (d['client_id'] == clientId && d['agent_user_id'] == agentUserId) {
          d['payload_json'] = encryptedPayload;
          d['updated_at'] = nowIso;
          if (resetToPending) {
            d['sync_status'] = 'PENDING';
            d['error_code'] = null;
            d['error_message'] = null;
          }
          return 1;
        }
      }
      return 0;
    }

    final db = await instance.database;
    return await db.update(
      'offline_drafts',
      {
        'payload_json': encryptedPayload,
        'updated_at': nowIso,
        if (resetToPending) ...{
          'sync_status': 'PENDING',
          'error_code': null,
          'error_message': null,
        },
      },
      where: 'client_id = ? AND agent_user_id = ?',
      whereArgs: [clientId, agentUserId],
    );
  }

  /// Returns raw stored rows in SQLite (used by security tests to verify ciphertext at rest).
  Future<List<Map<String, dynamic>>> getRawDraftRowsForTest() async {
    if (_useInMemoryTestStore) {
      return List<Map<String, dynamic>>.from(_memoryDrafts);
    }
    final db = await instance.database;
    return await db.query('offline_drafts');
  }

  Future<List<Map<String, dynamic>>> _decryptAgentRows(
    List<Map<String, dynamic>> rows,
    String agentUserId,
  ) async {
    final decryptedRows = <Map<String, dynamic>>[];
    for (final row in rows) {
      try {
        final storedPayload = row['payload_json'] as String;
        final isEncrypted = (row['is_encrypted'] as int? ?? 1) == 1;
        final clearJson = isEncrypted
            ? await LocalCryptoService.decryptPayload(
                storedPayload,
                agentUserId: agentUserId,
              )
            : storedPayload;

        decryptedRows.add({
          ...row,
          'sync_status': normalizeStatus(row['sync_status']?.toString()),
          'payload_json': clearJson,
        });
      } catch (_) {
        // Skip records that fail authenticated decryption for this agentUserId
      }
    }
    return decryptedRows;
  }

  /// Retrieves and decrypts pending drafts belonging ONLY to [agentUserId],
  /// sorted in relationship order: OWNER -> DRIVER -> VEHICLE -> DOCUMENT.
  Future<List<Map<String, dynamic>>> getPendingSyncDrafts({
    required String agentUserId,
  }) async {
    List<Map<String, dynamic>> rows;

    if (_useInMemoryTestStore) {
      rows = _memoryDrafts
          .where(
            (d) =>
                (d['sync_status'] == 'PENDING' || d['sync_status'] == 'QUEUED') &&
                d['agent_user_id'] == agentUserId,
          )
          .toList();
    } else {
      final db = await instance.database;
      rows = await db.query(
        'offline_drafts',
        where: "sync_status IN ('PENDING', 'QUEUED') AND agent_user_id = ?",
        whereArgs: [agentUserId],
        orderBy: 'created_at ASC',
      );
    }

    final decrypted = await _decryptAgentRows(rows, agentUserId);
    decrypted.sort((a, b) {
      final pA = _entityPriority((a['entity_type'] ?? '').toString());
      final pB = _entityPriority((b['entity_type'] ?? '').toString());
      if (pA != pB) return pA - pB;
      return (a['created_at'] ?? '')
          .toString()
          .compareTo((b['created_at'] ?? '').toString());
    });
    return decrypted;
  }

  /// Retrieves and decrypts ALL drafts (PENDING, SYNCING, SYNCED, CONFLICT, FAILED)
  /// belonging ONLY to [agentUserId] for the Synchronization Management Screen.
  Future<List<Map<String, dynamic>>> getAllDraftsForAgent({
    required String agentUserId,
    String? statusFilter,
  }) async {
    List<Map<String, dynamic>> rows;

    if (_useInMemoryTestStore) {
      rows = _memoryDrafts
          .where((d) => d['agent_user_id'] == agentUserId)
          .toList();
    } else {
      final db = await instance.database;
      rows = await db.query(
        'offline_drafts',
        where: 'agent_user_id = ?',
        whereArgs: [agentUserId],
        orderBy: 'created_at DESC',
      );
    }

    final decrypted = await _decryptAgentRows(rows, agentUserId);
    decrypted.sort(
      (a, b) => (b['created_at'] ?? '')
          .toString()
          .compareTo((a['created_at'] ?? '').toString()),
    );

    if (statusFilter != null && statusFilter.isNotEmpty && statusFilter != 'ALL') {
      final normalizedTarget = normalizeStatus(statusFilter);
      return decrypted
          .where((d) => normalizeStatus(d['sync_status']?.toString()) == normalizedTarget)
          .toList();
    }
    return decrypted;
  }

  /// Recovers any records stuck in 'SYNCING' after an unexpected app crash or network drop.
  Future<int> recoverInterruptedSyncingDrafts({required String agentUserId}) async {
    final nowIso = DateTime.now().toIso8601String();
    if (_useInMemoryTestStore) {
      int count = 0;
      for (final d in _memoryDrafts) {
        if (d['agent_user_id'] == agentUserId && d['sync_status'] == 'SYNCING') {
          d['sync_status'] = 'PENDING';
          d['updated_at'] = nowIso;
          count++;
        }
      }
      return count;
    }

    final db = await instance.database;
    return await db.update(
      'offline_drafts',
      {
        'sync_status': 'PENDING',
        'updated_at': nowIso,
      },
      where: "agent_user_id = ? AND sync_status = 'SYNCING'",
      whereArgs: [agentUserId],
    );
  }

  Future<int> markDraftSyncing(String clientId) async {
    final nowIso = DateTime.now().toIso8601String();
    if (_useInMemoryTestStore) {
      for (final d in _memoryDrafts) {
        if (d['client_id'] == clientId) {
          d['sync_status'] = 'SYNCING';
          d['updated_at'] = nowIso;
          return 1;
        }
      }
      return 0;
    }

    final db = await instance.database;
    return await db.update(
      'offline_drafts',
      {
        'sync_status': 'SYNCING',
        'updated_at': nowIso,
      },
      where: 'client_id = ?',
      whereArgs: [clientId],
    );
  }

  Future<int> markDraftSynced(
    String clientId, {
    String? serverRecordId,
    String? personRecordId,
    String? syncedAt,
  }) async {
    final nowIso = syncedAt ?? DateTime.now().toIso8601String();
    if (_useInMemoryTestStore) {
      for (final d in _memoryDrafts) {
        if (d['client_id'] == clientId) {
          d['sync_status'] = 'SYNCED';
          d['synced_at'] = nowIso;
          d['updated_at'] = nowIso;
          if (serverRecordId != null) d['server_record_id'] = serverRecordId;
          if (personRecordId != null) d['person_record_id'] = personRecordId;
          d['error_code'] = null;
          d['error_message'] = null;
          return 1;
        }
      }
      return 0;
    }

    final db = await instance.database;
    return await db.update(
      'offline_drafts',
      {
        'sync_status': 'SYNCED',
        'synced_at': nowIso,
        'updated_at': nowIso,
        if (serverRecordId != null) 'server_record_id': serverRecordId,
        if (personRecordId != null) 'person_record_id': personRecordId,
        'error_code': null,
        'error_message': null,
      },
      where: 'client_id = ?',
      whereArgs: [clientId],
    );
  }

  Future<int> markDraftConflict({
    required String clientId,
    required String conflictCode,
    required String message,
    String? serverRecordId,
  }) async {
    final nowIso = DateTime.now().toIso8601String();
    if (_useInMemoryTestStore) {
      for (final d in _memoryDrafts) {
        if (d['client_id'] == clientId) {
          d['sync_status'] = 'CONFLICT';
          d['updated_at'] = nowIso;
          d['error_code'] = conflictCode;
          d['error_message'] = message;
          if (serverRecordId != null) d['server_record_id'] = serverRecordId;
          d['retry_count'] = ((d['retry_count'] as int?) ?? 0) + 1;
          return 1;
        }
      }
      return 0;
    }

    final db = await instance.database;
    return await db.rawUpdate(
      '''
      UPDATE offline_drafts
      SET sync_status = 'CONFLICT',
          updated_at = ?,
          error_code = ?,
          error_message = ?,
          server_record_id = COALESCE(?, server_record_id),
          retry_count = COALESCE(retry_count, 0) + 1
      WHERE client_id = ?
      ''',
      [nowIso, conflictCode, message, serverRecordId, clientId],
    );
  }

  Future<int> markDraftFailed({
    required String clientId,
    required String errorCode,
    required String message,
  }) async {
    final nowIso = DateTime.now().toIso8601String();
    if (_useInMemoryTestStore) {
      for (final d in _memoryDrafts) {
        if (d['client_id'] == clientId) {
          d['sync_status'] = 'FAILED';
          d['updated_at'] = nowIso;
          d['error_code'] = errorCode;
          d['error_message'] = message;
          d['retry_count'] = ((d['retry_count'] as int?) ?? 0) + 1;
          return 1;
        }
      }
      return 0;
    }

    final db = await instance.database;
    return await db.rawUpdate(
      '''
      UPDATE offline_drafts
      SET sync_status = 'FAILED',
          updated_at = ?,
          error_code = ?,
          error_message = ?,
          retry_count = COALESCE(retry_count, 0) + 1
      WHERE client_id = ?
      ''',
      [nowIso, errorCode, message, clientId],
    );
  }

  Future<int> resetDraftForRetry({
    required String clientId,
    required String agentUserId,
  }) async {
    final nowIso = DateTime.now().toIso8601String();
    if (_useInMemoryTestStore) {
      for (final d in _memoryDrafts) {
        if (d['client_id'] == clientId && d['agent_user_id'] == agentUserId) {
          d['sync_status'] = 'PENDING';
          d['updated_at'] = nowIso;
          d['error_code'] = null;
          d['error_message'] = null;
          return 1;
        }
      }
      return 0;
    }

    final db = await instance.database;
    return await db.update(
      'offline_drafts',
      {
        'sync_status': 'PENDING',
        'updated_at': nowIso,
        'error_code': null,
        'error_message': null,
      },
      where: 'client_id = ? AND agent_user_id = ?',
      whereArgs: [clientId, agentUserId],
    );
  }

  /// Looks up a previously resolved PostgreSQL UUID for a clientGeneratedId.
  Future<String?> getResolvedServerId({
    required String clientId,
    required String agentUserId,
  }) async {
    if (_useInMemoryTestStore) {
      for (final d in _memoryDrafts) {
        if (d['client_id'] == clientId && d['agent_user_id'] == agentUserId) {
          return d['server_record_id']?.toString();
        }
      }
      return null;
    }

    final db = await instance.database;
    final rows = await db.query(
      'offline_drafts',
      columns: ['server_record_id'],
      where: 'client_id = ? AND agent_user_id = ?',
      whereArgs: [clientId, agentUserId],
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return rows.first['server_record_id']?.toString();
  }

  /// Looks up a previously resolved PostgreSQL `personId` for an offline DRIVER or OWNER draft.
  Future<String?> getResolvedPersonId({
    required String clientId,
    required String agentUserId,
  }) async {
    if (_useInMemoryTestStore) {
      for (final d in _memoryDrafts) {
        if (d['client_id'] == clientId && d['agent_user_id'] == agentUserId) {
          return d['person_record_id']?.toString();
        }
      }
      return null;
    }

    final db = await instance.database;
    final rows = await db.query(
      'offline_drafts',
      columns: ['person_record_id'],
      where: 'client_id = ? AND agent_user_id = ?',
      whereArgs: [clientId, agentUserId],
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return rows.first['person_record_id']?.toString();
  }

  Future<void> setLastSyncTimestamp({
    required String agentUserId,
    required String timestampIso,
  }) async {
    if (_useInMemoryTestStore) {
      _memorySyncMeta[agentUserId] = {
        ...(_memorySyncMeta[agentUserId] ?? {}),
        'agent_user_id': agentUserId,
        'last_synced_at': timestampIso,
      };
      return;
    }

    final db = await instance.database;
    await db.insert(
      'sync_metadata',
      {
        'agent_user_id': agentUserId,
        'last_synced_at': timestampIso,
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<String?> getLastSyncTimestamp({required String agentUserId}) async {
    if (_useInMemoryTestStore) {
      return _memorySyncMeta[agentUserId]?['last_synced_at']?.toString();
    }

    final db = await instance.database;
    final rows = await db.query(
      'sync_metadata',
      where: 'agent_user_id = ?',
      whereArgs: [agentUserId],
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return rows.first['last_synced_at']?.toString();
  }

  /// Saves or refreshes trusted Ed25519 public keys in SQLite `public_keys`.
  Future<void> savePublicKeysBatch(List<dynamic> publicKeys) async {
    final nowIso = DateTime.now().toIso8601String();
    if (_useInMemoryTestStore) {
      for (final rawKey in publicKeys) {
        if (rawKey is Map) {
          final keyId = (rawKey['keyId'] ?? rawKey['key_id'])?.toString();
          final pem = (rawKey['publicKeyPem'] ?? rawKey['public_key_pem'])?.toString();
          if (keyId != null && keyId.isNotEmpty && pem != null && pem.isNotEmpty) {
            _memoryPublicKeys[keyId] = {
              'key_id': keyId,
              'algorithm': (rawKey['algorithm'] ?? 'Ed25519').toString(),
              'public_key_pem': pem,
              'valid_from': (rawKey['validFrom'] ?? rawKey['valid_from'])?.toString(),
              'cached_at': (rawKey['cachedAt'] ?? rawKey['cached_at'] ?? nowIso).toString(),
            };
          }
        }
      }
      return;
    }

    final db = await instance.database;
    final batch = db.batch();
    for (final rawKey in publicKeys) {
      if (rawKey is Map) {
        final keyId = (rawKey['keyId'] ?? rawKey['key_id'])?.toString();
        final pem = (rawKey['publicKeyPem'] ?? rawKey['public_key_pem'])?.toString();
        if (keyId != null && keyId.isNotEmpty && pem != null && pem.isNotEmpty) {
          batch.insert(
            'public_keys',
            {
              'key_id': keyId,
              'algorithm': (rawKey['algorithm'] ?? 'Ed25519').toString(),
              'public_key_pem': pem,
              'valid_from': (rawKey['validFrom'] ?? rawKey['valid_from'])?.toString(),
              'cached_at': (rawKey['cachedAt'] ?? rawKey['cached_at'] ?? nowIso).toString(),
            },
            conflictAlgorithm: ConflictAlgorithm.replace,
          );
        }
      }
    }
    await batch.commit(noResult: true);
  }

  /// Retrieves a specific public key by [keyId] from SQLite `public_keys`.
  Future<Map<String, dynamic>?> getPublicKey(String keyId) async {
    if (_useInMemoryTestStore) {
      final found = _memoryPublicKeys[keyId];
      return found != null ? Map<String, dynamic>.from(found) : null;
    }

    final db = await instance.database;
    final rows = await db.query(
      'public_keys',
      where: 'key_id = ?',
      whereArgs: [keyId],
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return Map<String, dynamic>.from(rows.first);
  }

  /// Returns all cached public keys from SQLite `public_keys`.
  Future<List<Map<String, dynamic>>> getAllPublicKeys() async {
    if (_useInMemoryTestStore) {
      return _memoryPublicKeys.values
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    }

    final db = await instance.database;
    final rows = await db.query('public_keys', orderBy: 'cached_at DESC');
    return rows.map((e) => Map<String, dynamic>.from(e)).toList();
  }

  /// Clears cached public keys (used in tests for unavailable key verification).
  Future<void> clearPublicKeys() async {
    if (_useInMemoryTestStore) {
      _memoryPublicKeys.clear();
      return;
    }
    final db = await instance.database;
    await db.delete('public_keys');
  }

  Future<void> saveRevocationsBatch(List<dynamic> revocations) async {
    if (_useInMemoryTestStore) {
      for (final rev in revocations) {
        if (rev is Map) {
          final credId = (rev['credentialId'] ?? rev['credential_id'])?.toString();
          final serial = (rev['serialNumber'] ?? rev['serial_number'])?.toString();
          final cType =
              (rev['credentialType'] ?? rev['type'] ?? 'DRIVER_BADGE').toString();
          final reason =
              (rev['reason'] ?? rev['revocationReason'] ?? 'Révoqué').toString();
          final revokedAt =
              (rev['revokedAt'] ?? DateTime.now().toIso8601String()).toString();

          for (final key in {credId, serial}) {
            if (key != null && key.trim().isNotEmpty) {
              _memoryRevocations[key.trim()] = {
                'credential_id': key.trim(),
                'credential_type': cType,
                'revocation_reason': reason,
                'revoked_at': revokedAt,
              };
            }
          }
        }
      }
      return;
    }

    final db = await instance.database;
    final batch = db.batch();
    for (final rev in revocations) {
      if (rev is Map) {
        final credId = (rev['credentialId'] ?? rev['credential_id'])?.toString();
        final serial = (rev['serialNumber'] ?? rev['serial_number'])?.toString();
        final cType =
            (rev['credentialType'] ?? rev['type'] ?? 'DRIVER_BADGE').toString();
        final reason =
            (rev['reason'] ?? rev['revocationReason'] ?? 'Révoqué').toString();
        final revokedAt =
            (rev['revokedAt'] ?? DateTime.now().toIso8601String()).toString();

        for (final key in {credId, serial}) {
          if (key != null && key.trim().isNotEmpty) {
            batch.insert(
              'revocations',
              {
                'credential_id': key.trim(),
                'credential_type': cType,
                'revocation_reason': reason,
                'revoked_at': revokedAt,
              },
              conflictAlgorithm: ConflictAlgorithm.replace,
            );
          }
        }
      }
    }
    await batch.commit(noResult: true);
  }

  Future<Map<String, dynamic>?> getRevocationRecord(String credentialId) async {
    final trimmed = credentialId.trim();
    if (_useInMemoryTestStore) {
      final rec = _memoryRevocations[trimmed];
      return rec != null ? Map<String, dynamic>.from(rec) : null;
    }
    final db = await instance.database;
    final result = await db.query(
      'revocations',
      where: 'credential_id = ?',
      whereArgs: [trimmed],
      limit: 1,
    );
    if (result.isEmpty) return null;
    return Map<String, dynamic>.from(result.first);
  }

  Future<int> getRevocationsCount() async {
    if (_useInMemoryTestStore) {
      return _memoryRevocations.length;
    }
    final db = await instance.database;
    final rows = await db.rawQuery('SELECT COUNT(*) AS cnt FROM revocations');
    if (rows.isEmpty) return 0;
    return (rows.first['cnt'] as int?) ?? 0;
  }

  Future<bool> isCredentialRevoked(String credentialId) async {
    final rec = await getRevocationRecord(credentialId);
    return rec != null;
  }

  Future<void> recordInspectionLog({
    required String id,
    required String scannedQr,
    required String result,
    String? reason,
    double? latitude,
    double? longitude,
  }) async {
    final row = <String, dynamic>{
      'id': id,
      'scanned_qr': scannedQr,
      'result': result,
      'reason': reason,
      'timestamp': DateTime.now().toIso8601String(),
      'latitude': latitude,
      'longitude': longitude,
    };
    if (_useInMemoryTestStore) {
      _memoryInspectionLogs.insert(0, row);
      return;
    }
    final db = await instance.database;
    await db.insert(
      'inspection_logs',
      row,
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<List<Map<String, dynamic>>> getRecentInspectionLogs({int limit = 15}) async {
    if (_useInMemoryTestStore) {
      return _memoryInspectionLogs
          .take(limit)
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    }
    final db = await instance.database;
    final rows = await db.query(
      'inspection_logs',
      orderBy: 'timestamp DESC',
      limit: limit,
    );
    return rows.map((e) => Map<String, dynamic>.from(e)).toList();
  }

  Future close() async {
    if (_useInMemoryTestStore) return;
    final db = await instance.database;
    await db.close();
  }
}
