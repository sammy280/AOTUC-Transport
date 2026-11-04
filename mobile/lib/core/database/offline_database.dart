import 'dart:async';
import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';

class OfflineDatabase {
  static final OfflineDatabase instance = OfflineDatabase._init();
  static Database? _database;

  OfflineDatabase._init();

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
      version: 1,
      onCreate: _createDB,
    );
  }

  Future _createDB(Database db, int version) async {
    // 1. Offline drafts queue for field enrolment
    await db.execute('''
      CREATE TABLE offline_drafts (
        client_id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'QUEUED'
      )
    ''');

    // 2. Cached Ed25519 Public Keys for offline roadside verification
    await db.execute('''
      CREATE TABLE public_keys (
        key_id TEXT PRIMARY KEY,
        algorithm TEXT NOT NULL,
        public_key_pem TEXT NOT NULL,
        valid_from TEXT,
        cached_at TEXT NOT NULL
      )
    ''');

    // 3. Local Revocation Blacklist Snapshot
    await db.execute('''
      CREATE TABLE revocations (
        credential_id TEXT PRIMARY KEY,
        credential_type TEXT NOT NULL,
        revocation_reason TEXT NOT NULL,
        revoked_at TEXT NOT NULL
      )
    ''');

    // 4. Inspection Audit Log (Saved locally, synced when network restores)
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

  // --- Draft operations ---
  Future<int> insertDraft({
    required String clientId,
    required String entityType,
    required String payloadJson,
  }) async {
    final db = await instance.database;
    return await db.insert(
      'offline_drafts',
      {
        'client_id': clientId,
        'entity_type': entityType,
        'payload_json': payloadJson,
        'created_at': DateTime.now().toIso8601String(),
        'sync_status': 'QUEUED',
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<List<Map<String, dynamic>>> getPendingSyncDrafts() async {
    final db = await instance.database;
    return await db.query(
      'offline_drafts',
      where: 'sync_status = ?',
      whereArgs: ['QUEUED'],
      orderBy: 'created_at ASC',
    );
  }

  Future<int> markDraftSynced(String clientId) async {
    final db = await instance.database;
    return await db.update(
      'offline_drafts',
      {'sync_status': 'SYNCED'},
      where: 'client_id = ?',
      whereArgs: [clientId],
    );
  }

  // --- Revocation checks ---
  Future<bool> isCredentialRevoked(String credentialId) async {
    final db = await instance.database;
    final result = await db.query(
      'revocations',
      where: 'credential_id = ?',
      whereArgs: [credentialId],
    );
    return result.isNotEmpty;
  }

  Future close() async {
    final db = await instance.database;
    db.close();
  }
}
