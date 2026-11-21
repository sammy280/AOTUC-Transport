import 'dart:convert';
import 'package:flutter/material.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/database/offline_database.dart';
import '../../../core/sync/sync_manager.dart';

class SyncManagementView extends StatefulWidget {
  final AuthService authService;
  final SyncManager? syncManager;

  const SyncManagementView({
    super.key,
    required this.authService,
    this.syncManager,
  });

  @override
  State<SyncManagementView> createState() => _SyncManagementViewState();
}

class _SyncManagementViewState extends State<SyncManagementView> {
  late final SyncManager _syncManager;
  bool _ownsSyncManager = false;

  String _selectedFilter = 'ALL'; // ALL | PENDING | SYNCING | SYNCED | CONFLICT | FAILED
  List<Map<String, dynamic>> _allDrafts = [];
  bool _isLoadingDrafts = true;
  String? _bannerMessage;
  bool _bannerIsError = false;

  @override
  void initState() {
    super.initState();
    final user = widget.authService.currentUser!;
    if (widget.syncManager != null) {
      _syncManager = widget.syncManager!;
    } else {
      _ownsSyncManager = true;
      _syncManager = SyncManager(
        backendBaseUrl: widget.authService.backendBaseUrl,
        authToken: widget.authService.accessToken ?? '',
        agentUserId: user.id,
        deviceId: widget.authService.deviceId,
        httpClient: widget.authService.httpClient,
      );
    }
    _syncManager.addListener(_onSyncManagerChanged);
    _initScreen();
  }

  Future<void> _initScreen() async {
    await _syncManager.initialize();
    await _reloadDrafts();
  }

  void _onSyncManagerChanged() {
    if (mounted) {
      _reloadDrafts();
    }
  }

  @override
  void dispose() {
    _syncManager.removeListener(_onSyncManagerChanged);
    if (_ownsSyncManager) {
      _syncManager.dispose();
    }
    super.dispose();
  }

  Future<void> _reloadDrafts() async {
    final user = widget.authService.currentUser;
    if (user == null) return;

    final rows = await OfflineDatabase.instance.getAllDraftsForAgent(
      agentUserId: user.id,
    );
    if (mounted) {
      setState(() {
        _allDrafts = rows;
        _isLoadingDrafts = false;
      });
    }
  }

  int _countByStatus(String status) {
    if (status == 'ALL') return _allDrafts.length;
    return _allDrafts
        .where((r) => OfflineDatabase.normalizeStatus(r['sync_status']?.toString()) == status)
        .length;
  }

  List<Map<String, dynamic>> get _filteredDrafts {
    if (_selectedFilter == 'ALL') return _allDrafts;
    return _allDrafts
        .where(
          (r) =>
              OfflineDatabase.normalizeStatus(r['sync_status']?.toString()) ==
              _selectedFilter,
        )
        .toList();
  }

  Future<void> _handleManualSync() async {
    final devId = await widget.authService.getOrCreateDeviceId();
    final summary = await _syncManager.synchronizePendingDrafts(
      devId,
      trigger: 'MANUAL',
    );
    await _reloadDrafts();
    if (mounted) {
      setState(() {
        _bannerMessage = summary.message;
        _bannerIsError =
            summary.conflicts > 0 || summary.failed > 0 || summary.networkFailed;
      });
    }
  }

  Future<void> _handleRetryAllFailed() async {
    final devId = await widget.authService.getOrCreateDeviceId();
    final summary = await _syncManager.retryAllFailedDrafts(devId);
    await _reloadDrafts();
    if (mounted) {
      setState(() {
        _bannerMessage = summary.message;
        _bannerIsError =
            summary.conflicts > 0 || summary.failed > 0 || summary.networkFailed;
      });
    }
  }

  Future<void> _handleRetrySingle(String clientId) async {
    final devId = await widget.authService.getOrCreateDeviceId();
    final summary = await _syncManager.retrySingleDraft(clientId, devId);
    await _reloadDrafts();
    if (mounted) {
      setState(() {
        _bannerMessage = summary.message;
        _bannerIsError =
            summary.conflicts > 0 || summary.failed > 0 || summary.networkFailed;
      });
    }
  }

  Future<void> _openConflictResolutionModal(Map<String, dynamic> row) async {
    final clientId = row['client_id'] as String;
    final entityType = (row['entity_type'] ?? '').toString().toUpperCase();
    final payload = Map<String, dynamic>.from(
      jsonDecode(row['payload_json'] as String) as Map<String, dynamic>,
    );

    final ninCtrl = TextEditingController(text: payload['nin']?.toString() ?? '');
    final phoneCtrl =
        TextEditingController(text: payload['phoneNumber']?.toString() ?? '');
    final licenseCtrl = TextEditingController(
      text: payload['drivingLicenseNumber']?.toString() ?? '',
    );
    final plateCtrl =
        TextEditingController(text: payload['plateNumber']?.toString() ?? '');
    final cardCtrl = TextEditingController(
      text: payload['registrationCardNumber']?.toString() ?? '',
    );
    final vinCtrl =
        TextEditingController(text: payload['chassisVin']?.toString() ?? '');

    final shouldRetry = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: const Text(
            'Résoudre le Conflit & Réessayer',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF2F2),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFFCA5A5)),
                  ),
                  child: Text(
                    row['error_message']?.toString() ??
                        'Conflit d identifiant détecté sur le serveur.',
                    style: const TextStyle(fontSize: 11, color: Color(0xFF991B1B)),
                  ),
                ),
                const SizedBox(height: 10),
                const Text(
                  'Le dossier existant sur le serveur n a pas été écrasé. Vous pouvez corriger une erreur de saisie ci-dessous tout en conservant les photos et coordonnées GPS :',
                  style: TextStyle(fontSize: 11, color: Colors.black87),
                ),
                const SizedBox(height: 12),
                if (entityType == 'DRIVER' || entityType == 'OWNER') ...[
                  TextField(
                    key: const Key('conflict_edit_nin_input'),
                    controller: ninCtrl,
                    decoration: const InputDecoration(
                      labelText: 'N° NIN',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    key: const Key('conflict_edit_phone_input'),
                    controller: phoneCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Téléphone (+224)',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ],
                if (entityType == 'DRIVER') ...[
                  const SizedBox(height: 8),
                  TextField(
                    key: const Key('conflict_edit_license_input'),
                    controller: licenseCtrl,
                    decoration: const InputDecoration(
                      labelText: 'N° Permis de Conduire',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ],
                if (entityType == 'VEHICLE') ...[
                  TextField(
                    key: const Key('conflict_edit_plate_input'),
                    controller: plateCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Plaque Immatriculation',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    key: const Key('conflict_edit_card_input'),
                    controller: cardCtrl,
                    decoration: const InputDecoration(
                      labelText: 'N° Carte Grise',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    key: const Key('conflict_edit_vin_input'),
                    controller: vinCtrl,
                    decoration: const InputDecoration(
                      labelText: 'N° Châssis (VIN)',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ],
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Conserver en l état'),
            ),
            ElevatedButton(
              key: const Key('confirm_conflict_retry_button'),
              onPressed: () => Navigator.of(ctx).pop(true),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF009460),
                foregroundColor: Colors.white,
              ),
              child: const Text('Enregistrer & Synchroniser'),
            ),
          ],
        );
      },
    );

    if (shouldRetry == true) {
      if (entityType == 'DRIVER' || entityType == 'OWNER') {
        payload['nin'] = ninCtrl.text.trim().toUpperCase();
        payload['phoneNumber'] = phoneCtrl.text.trim();
      }
      if (entityType == 'DRIVER') {
        payload['drivingLicenseNumber'] = licenseCtrl.text.trim().toUpperCase();
      }
      if (entityType == 'VEHICLE') {
        payload['plateNumber'] = plateCtrl.text.trim().toUpperCase();
        payload['registrationCardNumber'] = cardCtrl.text.trim().toUpperCase();
        payload['chassisVin'] = vinCtrl.text.trim().toUpperCase();
      }

      final devId = await widget.authService.getOrCreateDeviceId();
      final summary = await _syncManager.resolveConflictAndRetry(
        clientId: clientId,
        updatedPayload: payload,
        syncDeviceId: devId,
      );
      await _reloadDrafts();
      if (mounted) {
        setState(() {
          _bannerMessage = summary.message;
          _bannerIsError =
              summary.conflicts > 0 || summary.failed > 0 || summary.networkFailed;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.authService.currentUser!;
    final pendingCount = _countByStatus('PENDING');
    final syncingCount = _countByStatus('SYNCING');
    final syncedCount = _countByStatus('SYNCED');
    final conflictCount = _countByStatus('CONFLICT');
    final failedCount = _countByStatus('FAILED');

    return SingleChildScrollView(
      padding: const EdgeInsets.all(14.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 1. Header Card: Connectivity, Progress, Last Synced Timestamp & Actions
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFF0B1E36),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    const Icon(Icons.sync_lock, color: Color(0xFFFCD116), size: 22),
                    const SizedBox(width: 8),
                    const Expanded(
                      child: Text(
                        'CONSOLE DE SYNCHRONISATION HORS-LIGNE',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    Container(
                      key: const Key('sync_connectivity_badge'),
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: _syncManager.isOnline
                            ? const Color(0xFF065F46)
                            : const Color(0xFF991B1B),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        _syncManager.isOnline ? 'EN LIGNE' : 'HORS-LIGNE',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  'Agent : ${user.fullName} • Ordre garanti : PROPRIÉTAIRE → CHAUFFEUR → VÉHICULE → DOCUMENTS',
                  style: const TextStyle(color: Colors.white70, fontSize: 11),
                ),
                const SizedBox(height: 4),
                Text(
                  key: const Key('last_sync_timestamp_text'),
                  _syncManager.lastSyncedAt != null
                      ? 'Dernière synchronisation réussie : ${_formatTimestamp(_syncManager.lastSyncedAt!)}'
                      : 'Dernière synchronisation réussie : Aucune dans cette session',
                  style: const TextStyle(
                    color: Color(0xFFFCD116),
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                if (_syncManager.isSyncing) ...[
                  const SizedBox(height: 10),
                  LinearProgressIndicator(
                    key: const Key('sync_progress_indicator'),
                    value: _syncManager.totalInBatch > 0
                        ? _syncManager.processedInBatch / _syncManager.totalInBatch
                        : null,
                    backgroundColor: Colors.white24,
                    color: const Color(0xFFFCD116),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Synchronisation en cours (${_syncManager.processedInBatch}/${_syncManager.totalInBatch})...',
                    style: const TextStyle(color: Colors.white, fontSize: 11),
                  ),
                ],
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    ElevatedButton.icon(
                      key: const Key('sync_now_button'),
                      onPressed: _syncManager.isSyncing ? null : _handleManualSync,
                      icon: const Icon(Icons.cloud_sync, size: 16),
                      label: Text(
                        _syncManager.isSyncing
                            ? 'Synchronisation...'
                            : 'Synchroniser Maintenant ($pendingCount)',
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF009460),
                        foregroundColor: Colors.white,
                      ),
                    ),
                    if (failedCount > 0)
                      OutlinedButton.icon(
                        key: const Key('retry_all_failed_button'),
                        onPressed:
                            _syncManager.isSyncing ? null : _handleRetryAllFailed,
                        icon: const Icon(
                          Icons.refresh,
                          size: 16,
                          color: Color(0xFFFCD116),
                        ),
                        label: Text(
                          'Réessayer les Échecs ($failedCount)',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFFFCD116),
                          ),
                        ),
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: Color(0xFFFCD116)),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),

          // 2. Status Feedback Banner
          if (_bannerMessage != null)
            Container(
              key: const Key('sync_screen_banner'),
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: _bannerIsError
                    ? const Color(0xFFFEF2F2)
                    : const Color(0xFFECFDF5),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: _bannerIsError
                      ? const Color(0xFFDC2626)
                      : const Color(0xFF10B981),
                ),
              ),
              child: Text(
                _bannerMessage!,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: _bannerIsError
                      ? const Color(0xFF991B1B)
                      : const Color(0xFF065F46),
                ),
              ),
            ),

          // 3. Filter Chips for All 5 Statuses
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              _buildFilterChip('ALL', 'Tous (${_allDrafts.length})'),
              _buildFilterChip('PENDING', 'En attente ($pendingCount)'),
              _buildFilterChip('SYNCING', 'En cours ($syncingCount)'),
              _buildFilterChip('SYNCED', 'Synchronisés ($syncedCount)'),
              _buildFilterChip('CONFLICT', 'Conflits ($conflictCount)'),
              _buildFilterChip('FAILED', 'Échecs ($failedCount)'),
            ],
          ),
          const SizedBox(height: 12),

          // 4. Records List
          if (_isLoadingDrafts)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(24.0),
                child: CircularProgressIndicator(),
              ),
            )
          else if (_filteredDrafts.isEmpty)
            Container(
              key: const Key('sync_empty_state'),
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: const Text(
                'Aucun dossier dans cette catégorie de synchronisation.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: Colors.black54),
              ),
            )
          else
            ..._filteredDrafts.map(_buildDraftCard),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String statusKey, String label) {
    final isSelected = _selectedFilter == statusKey;
    return ChoiceChip(
      key: Key('filter_sync_$statusKey'),
      label: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.bold,
          color: isSelected ? Colors.white : const Color(0xFF0B1E36),
        ),
      ),
      selected: isSelected,
      selectedColor: const Color(0xFF0B1E36),
      backgroundColor: Colors.white,
      onSelected: (_) {
        setState(() {
          _selectedFilter = statusKey;
        });
      },
    );
  }

  Widget _buildDraftCard(Map<String, dynamic> row) {
    final clientId = row['client_id'] as String;
    final entityType = (row['entity_type'] ?? '').toString().toUpperCase();
    final status = OfflineDatabase.normalizeStatus(row['sync_status']?.toString());
    final createdAt = (row['created_at'] ?? '').toString();
    final agentName =
        row['agent_name']?.toString() ?? widget.authService.currentUser?.fullName ?? 'Agent';
    final serverRecordId = row['server_record_id']?.toString();
    final errorCode = row['error_code']?.toString();
    final errorMessage = row['error_message']?.toString();
    final retryCount = (row['retry_count'] as int?) ?? 0;

    final payload =
        jsonDecode(row['payload_json'] as String) as Map<String, dynamic>;
    final docs = (payload['documents'] as List<dynamic>?) ?? [];
    final hasGps = payload['latitude'] != null && payload['longitude'] != null;

    return Card(
      key: Key('sync_card_$clientId'),
      margin: const EdgeInsets.only(bottom: 10),
      elevation: 1,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: BorderSide(color: _statusBorderColor(status)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Icon(_entityIcon(entityType), size: 18, color: const Color(0xFF0B1E36)),
                    const SizedBox(width: 6),
                    Text(
                      _entityLabel(entityType),
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                        color: Color(0xFF0B1E36),
                      ),
                    ),
                  ],
                ),
                Container(
                  key: Key('sync_status_badge_$clientId'),
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: _statusBgColor(status),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    _statusFrenchLabel(status),
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: _statusTextColor(status),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              _buildRecordPrimaryTitle(entityType, payload),
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 4),
            Text(
              _buildRecordSubtitle(entityType, payload, docs.length, hasGps),
              style: const TextStyle(fontSize: 11, color: Colors.black87),
            ),
            const SizedBox(height: 4),
            Text(
              'Créé le : ${_formatTimestamp(createdAt)} • Agent : $agentName${retryCount > 0 ? ' • Tentatives : $retryCount' : ''}',
              style: const TextStyle(fontSize: 10, color: Colors.black54),
            ),
            if (serverRecordId != null && serverRecordId.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 4.0),
                child: Text(
                  'ID PostgreSQL Serveur : $serverRecordId',
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF065F46),
                  ),
                ),
              ),
            if ((status == 'CONFLICT' || status == 'FAILED') &&
                errorMessage != null &&
                errorMessage.isNotEmpty) ...[
              const SizedBox(height: 8),
              Container(
                key: Key('sync_error_box_$clientId'),
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: status == 'CONFLICT'
                      ? const Color(0xFFFFFBEB)
                      : const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(
                    color: status == 'CONFLICT'
                        ? const Color(0xFFF59E0B)
                        : const Color(0xFFFCA5A5),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      status == 'CONFLICT'
                          ? 'Conflit détecté (${errorCode ?? "CONFLICT"}) — Dossier serveur non écrasé :'
                          : 'Motif de l échec (${errorCode ?? "ERROR"}) :',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: status == 'CONFLICT'
                            ? const Color(0xFF92400E)
                            : const Color(0xFF991B1B),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      errorMessage,
                      style: TextStyle(
                        fontSize: 11,
                        color: status == 'CONFLICT'
                            ? const Color(0xFF78350F)
                            : const Color(0xFF7F1D1D),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            if (status == 'PENDING' || status == 'FAILED' || status == 'CONFLICT') ...[
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 6,
                alignment: WrapAlignment.end,
                children: [
                  if (status == 'CONFLICT' || status == 'FAILED')
                    OutlinedButton.icon(
                      key: Key('resolve_conflict_$clientId'),
                      onPressed: _syncManager.isSyncing
                          ? null
                          : () => _openConflictResolutionModal(row),
                      icon: const Icon(Icons.edit_note, size: 15),
                      label: const Text(
                        'Corriger & Réessayer',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ElevatedButton.icon(
                    key: Key('retry_draft_$clientId'),
                    onPressed: _syncManager.isSyncing
                        ? null
                        : () => _handleRetrySingle(clientId),
                    icon: const Icon(Icons.sync, size: 15),
                    label: const Text(
                      'Réessayer',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0B1E36),
                      foregroundColor: Colors.white,
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _buildRecordPrimaryTitle(String entityType, Map<String, dynamic> p) {
    if (entityType == 'DRIVER') {
      return '${p['firstName'] ?? ''} ${p['lastName'] ?? ''} — NIN: ${p['nin'] ?? ''}';
    }
    if (entityType == 'OWNER') {
      final biz = p['businessName']?.toString();
      if (biz != null && biz.isNotEmpty) {
        return '$biz (${p['firstName'] ?? ''} ${p['lastName'] ?? ''}) — NIN: ${p['nin'] ?? ''}';
      }
      return '${p['firstName'] ?? ''} ${p['lastName'] ?? ''} — NIN: ${p['nin'] ?? ''}';
    }
    if (entityType == 'VEHICLE') {
      return 'Plaque ${p['plateNumber'] ?? ''} — ${p['make'] ?? ''} ${p['model'] ?? ''}';
    }
    if (entityType == 'DOCUMENT') {
      return '${p['category'] ?? 'Document'} (${p['originalName'] ?? 'fichier'})';
    }
    return entityType;
  }

  String _buildRecordSubtitle(
    String entityType,
    Map<String, dynamic> p,
    int docCount,
    bool hasGps,
  ) {
    final extras = <String>[];
    if (entityType == 'DRIVER') {
      extras.add('Permis: ${p['drivingLicenseNumber'] ?? '-'}');
      extras.add('Tél: ${p['phoneNumber'] ?? '-'}');
    } else if (entityType == 'OWNER') {
      extras.add('Type: ${p['ownerType'] ?? 'INDIVIDU'}');
      extras.add('Tél: ${p['phoneNumber'] ?? '-'}');
    } else if (entityType == 'VEHICLE') {
      extras.add('Carte Grise: ${p['registrationCardNumber'] ?? '-'}');
      extras.add('VIN: ${p['chassisVin'] ?? '-'}');
    }
    if (docCount > 0) extras.add('$docCount pièce(s) jointe(s)');
    if (hasGps) extras.add('GPS acquis');
    return extras.join(' • ');
  }

  IconData _entityIcon(String entityType) {
    switch (entityType) {
      case 'DRIVER':
        return Icons.badge;
      case 'OWNER':
        return Icons.business_center;
      case 'VEHICLE':
        return Icons.directions_bus;
      case 'DOCUMENT':
        return Icons.description;
      default:
        return Icons.folder;
    }
  }

  String _entityLabel(String entityType) {
    switch (entityType) {
      case 'DRIVER':
        return 'CHAUFFEUR';
      case 'OWNER':
        return 'PROPRIÉTAIRE';
      case 'VEHICLE':
        return 'VÉHICULE';
      case 'DOCUMENT':
        return 'DOCUMENT';
      default:
        return entityType;
    }
  }

  String _statusFrenchLabel(String status) {
    switch (status) {
      case 'PENDING':
        return 'EN ATTENTE';
      case 'SYNCING':
        return 'SYNCHRONISATION...';
      case 'SYNCED':
        return 'SYNCHRONISÉ';
      case 'CONFLICT':
        return 'CONFLIT DÉTECTÉ';
      case 'FAILED':
        return 'ÉCHEC';
      default:
        return status;
    }
  }

  Color _statusBgColor(String status) {
    switch (status) {
      case 'PENDING':
        return const Color(0xFFFEF3C7);
      case 'SYNCING':
        return const Color(0xFFDBEAFE);
      case 'SYNCED':
        return const Color(0xFFD1FAE5);
      case 'CONFLICT':
        return const Color(0xFFFFEDD5);
      case 'FAILED':
        return const Color(0xFFFEE2E2);
      default:
        return const Color(0xFFF1F5F9);
    }
  }

  Color _statusTextColor(String status) {
    switch (status) {
      case 'PENDING':
        return const Color(0xFF92400E);
      case 'SYNCING':
        return const Color(0xFF1E40AF);
      case 'SYNCED':
        return const Color(0xFF065F46);
      case 'CONFLICT':
        return const Color(0xFF9A3412);
      case 'FAILED':
        return const Color(0xFF991B1B);
      default:
        return Colors.black87;
    }
  }

  Color _statusBorderColor(String status) {
    switch (status) {
      case 'CONFLICT':
        return const Color(0xFFF97316);
      case 'FAILED':
        return const Color(0xFFEF4444);
      case 'SYNCED':
        return const Color(0xFF10B981);
      default:
        return const Color(0xFFCBD5E1);
    }
  }

  String _formatTimestamp(String rawIso) {
    final dt = DateTime.tryParse(rawIso)?.toLocal();
    if (dt == null) return rawIso;
    final y = dt.year.toString().padLeft(4, '0');
    final m = dt.month.toString().padLeft(2, '0');
    final d = dt.day.toString().padLeft(2, '0');
    final hh = dt.hour.toString().padLeft(2, '0');
    final mm = dt.minute.toString().padLeft(2, '0');
    return '$d/$m/$y à $hh:$mm';
  }
}
