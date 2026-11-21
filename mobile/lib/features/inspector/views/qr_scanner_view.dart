import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/crypto/ed25519_verifier.dart';
import '../../../core/database/offline_database.dart';
import '../../../core/services/media_and_gps_service.dart';
import '../../../core/sync/sync_manager.dart';

class QrScannerView extends StatefulWidget {
  final AuthService? authService;

  const QrScannerView({
    super.key,
    this.authService,
  });

  @override
  State<QrScannerView> createState() => _QrScannerViewState();
}

class _QrScannerViewState extends State<QrScannerView> {
  MobileScannerController? _scannerController;
  bool _cameraPermissionGranted = false;
  bool _isCheckingPermission = true;
  String _cameraPermissionMessage =
      'Vérification de la permission d accès à la caméra...';
  bool _isCameraActive = true;
  bool _torchEnabled = false;

  int _cachedKeysCount = 0;
  int _cachedRevocationsCount = 0;
  bool _isSyncingSecurityData = false;
  String? _syncStatusBanner;
  bool _syncBannerIsError = false;

  InspectionOutcome? _outcome;
  bool _isVerifying = false;
  String? _lastScannedRawValue;

  final TextEditingController _manualQrCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _initializeScannerAndSecurityCache();
  }

  @override
  void dispose() {
    _scannerController?.dispose();
    _manualQrCtrl.dispose();
    super.dispose();
  }

  Future<void> _initializeScannerAndSecurityCache() async {
    await _requestAndCheckCameraPermission();
    await _reloadLocalSecurityCacheCounts();

    // When online and authenticated, perform a background pull of public keys & revocations
    if (widget.authService != null) {
      await _refreshKeysAndRevocations(silentIfOffline: true);
    }
  }

  Future<void> _requestAndCheckCameraPermission() async {
    if (mounted) {
      setState(() {
        _isCheckingPermission = true;
      });
    }

    final perm = await MediaAndGpsService.requestCameraPermission();
    if (!mounted) return;

    if (perm.isGranted) {
      _scannerController ??= MobileScannerController(
        formats: const [BarcodeFormat.qrCode],
        detectionSpeed: DetectionSpeed.noDuplicates,
        autoStart: true,
      );
    }

    setState(() {
      _cameraPermissionGranted = perm.isGranted;
      _cameraPermissionMessage = perm.message;
      _isCheckingPermission = false;
    });
  }

  Future<void> _reloadLocalSecurityCacheCounts() async {
    final keys = await OfflineDatabase.instance.getAllPublicKeys();
    final revCount = await OfflineDatabase.instance.getRevocationsCount();
    if (mounted) {
      setState(() {
        _cachedKeysCount = keys.length;
        _cachedRevocationsCount = revCount;
      });
    }
  }

  Future<void> _refreshKeysAndRevocations({bool silentIfOffline = false}) async {
    final auth = widget.authService;
    if (auth == null) return;

    if (mounted) {
      setState(() {
        _isSyncingSecurityData = true;
        if (!silentIfOffline) _syncStatusBanner = null;
      });
    }

    try {
      final syncManager = SyncManager(
        backendBaseUrl: auth.backendBaseUrl,
        authToken: auth.accessToken ?? '',
        agentUserId: auth.currentUser?.id ?? 'inspector',
        deviceId: auth.deviceId,
        httpClient: auth.httpClient,
      );

      final ok = await syncManager.pullIncrementalUpdates();
      await _reloadLocalSecurityCacheCounts();

      if (mounted) {
        setState(() {
          _isSyncingSecurityData = false;
          if (ok) {
            _syncBannerIsError = false;
            _syncStatusBanner =
                '✓ Clés publiques Ed25519 ($_cachedKeysCount) et liste de révocations ($_cachedRevocationsCount) synchronisées.';
          } else if (!silentIfOffline) {
            _syncBannerIsError = true;
            _syncStatusBanner =
                'Mode hors-ligne : utilisation des clés publiques ($_cachedKeysCount) et révocations ($_cachedRevocationsCount) en cache SQLite.';
          }
        });
      }
    } catch (_) {
      await _reloadLocalSecurityCacheCounts();
      if (mounted) {
        setState(() {
          _isSyncingSecurityData = false;
          if (!silentIfOffline) {
            _syncBannerIsError = true;
            _syncStatusBanner =
                'Serveur injoignable : contrôle effectué à partir du cache hors-ligne.';
          }
        });
      }
    }
  }

  Future<void> _handleBarcodeCapture(BarcodeCapture capture) async {
    if (_isVerifying) return;
    for (final barcode in capture.barcodes) {
      final raw = barcode.rawValue?.trim();
      if (raw != null && raw.isNotEmpty) {
        if (raw == _lastScannedRawValue && _outcome != null) {
          return;
        }
        await _verifyQrPayload(raw);
        break;
      }
    }
  }

  Future<void> _verifyQrPayload(String qrPayload) async {
    final trimmed = qrPayload.trim();
    if (trimmed.isEmpty) return;

    setState(() {
      _isVerifying = true;
      _lastScannedRawValue = trimmed;
    });

    final result = await Ed25519Verifier.verifyQrCode(trimmed);

    if (mounted) {
      setState(() {
        _outcome = result;
        _isVerifying = false;
      });
    }
  }

  void _resetCurrentScan() {
    setState(() {
      _outcome = null;
      _lastScannedRawValue = null;
      _manualQrCtrl.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(14.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 1. Official Roadside Control & Offline Cryptographic Cache Header
          Card(
            elevation: 0,
            color: const Color(0xFFF1F5F9),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: const BorderSide(color: Color(0xFFE2E8F0)),
            ),
            child: Padding(
              padding: const EdgeInsets.all(12.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      const CircleAvatar(
                        backgroundColor: Color(0xFF0B1E36),
                        child: Icon(Icons.shield_outlined, color: Colors.white),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'CONTRÔLE ROUTIER & VÉRIFICATION QR AOTUC',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 12,
                                color: Color(0xFF0B1E36),
                              ),
                            ),
                            Text(
                              key: const Key('security_cache_summary_text'),
                              'Clés Ed25519 en cache : $_cachedKeysCount • Révocations : $_cachedRevocationsCount',
                              style: const TextStyle(
                                color: Colors.black87,
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                      TextButton.icon(
                        key: const Key('refresh_keys_revocations_button'),
                        onPressed: _isSyncingSecurityData
                            ? null
                            : () => _refreshKeysAndRevocations(
                                  silentIfOffline: false,
                                ),
                        icon: const Icon(Icons.sync, size: 15),
                        label: Text(
                          _isSyncingSecurityData ? 'Sync...' : 'Actualiser Clés',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                  if (_cachedKeysCount == 0)
                    Container(
                      key: const Key('no_cached_keys_warning'),
                      margin: const EdgeInsets.only(top: 8),
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFFBEB),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFFF59E0B)),
                      ),
                      child: const Row(
                        children: [
                          Icon(
                            Icons.warning_amber_rounded,
                            color: Color(0xFFD97706),
                            size: 16,
                          ),
                          SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              'Aucune clé publique Ed25519 en cache local. Synchronisez les clés de sécurité avant de valider un titre.',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF92400E),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),

          if (_syncStatusBanner != null) ...[
            const SizedBox(height: 8),
            Container(
              key: const Key('scanner_sync_banner'),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: _syncBannerIsError
                    ? const Color(0xFFFFFBEB)
                    : const Color(0xFFECFDF5),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: _syncBannerIsError
                      ? const Color(0xFFF59E0B)
                      : const Color(0xFF10B981),
                ),
              ),
              child: Text(
                _syncStatusBanner!,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: _syncBannerIsError
                      ? const Color(0xFF92400E)
                      : const Color(0xFF065F46),
                ),
              ),
            ),
          ],

          const SizedBox(height: 12),

          // 2. Real Camera QR Scanner Viewport (with Permission Gate)
          _buildCameraScannerViewport(),

          const SizedBox(height: 12),

          // 3. Hardware 2D Reader / Manual QR Code Verification Input
          Card(
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
              side: const BorderSide(color: Color(0xFFCBD5E1)),
            ),
            child: Padding(
              padding: const EdgeInsets.all(10.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'LECTEUR OPTIQUE EXTERNE / VÉRIFICATION DIRECTE DU CODE QR',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF0B1E36),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          key: const Key('manual_qr_input'),
                          controller: _manualQrCtrl,
                          onSubmitted: _verifyQrPayload,
                          decoration: const InputDecoration(
                            hintText: 'Scannez ou collez un code AOTUC1...',
                            prefixIcon: Icon(Icons.qr_code_2, size: 18),
                            border: OutlineInputBorder(),
                            contentPadding: EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 8,
                            ),
                          ),
                          style: const TextStyle(fontSize: 11),
                        ),
                      ),
                      const SizedBox(width: 8),
                      ElevatedButton.icon(
                        key: const Key('verify_qr_submit_button'),
                        onPressed: _isVerifying
                            ? null
                            : () => _verifyQrPayload(_manualQrCtrl.text),
                        icon: const Icon(Icons.verified_user, size: 16),
                        label: const Text(
                          'Vérifier',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF0B1E36),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 12,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 14),

          // 4. Cryptographic Verification Result Decision Card (French)
          if (_outcome != null) _buildOutcomeCard(_outcome!),
        ],
      ),
    );
  }

  Widget _buildCameraScannerViewport() {
    if (_isCheckingPermission) {
      return Container(
        height: 230,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: const Color(0xFF0F172A),
          borderRadius: BorderRadius.circular(16),
        ),
        child: const Text(
          'Initialisation du capteur caméra...',
          style: TextStyle(color: Color(0xFFFCD116), fontSize: 12),
        ),
      );
    }

    if (!_cameraPermissionGranted) {
      return Container(
        key: const Key('camera_permission_denied_card'),
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: const Color(0xFFFEF2F2),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFDC2626), width: 2),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.no_photography_outlined,
              color: Color(0xFFDC2626),
              size: 40,
            ),
            const SizedBox(height: 8),
            const Text(
              'ACCÈS À LA CAMÉRA REFUSÉ',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 13,
                color: Color(0xFF991B1B),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              _cameraPermissionMessage,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 11, color: Color(0xFF7F1D1D)),
            ),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              key: const Key('request_camera_permission_button'),
              onPressed: _requestAndCheckCameraPermission,
              icon: const Icon(Icons.camera_alt, size: 16),
              label: const Text(
                'Autoriser l Accès à la Caméra',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0B1E36),
                foregroundColor: Colors.white,
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      key: const Key('live_mobile_scanner_viewport'),
      height: 250,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Colors.black,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF0B1E36), width: 3),
      ),
      child: Stack(
        alignment: Alignment.center,
        children: [
          if (_isCameraActive && _scannerController != null)
            MobileScanner(
              controller: _scannerController!,
              onDetect: _handleBarcodeCapture,
              placeholderBuilder: (context, child) {
                return const Center(
                  child: Icon(
                    Icons.qr_code_scanner,
                    color: Colors.white38,
                    size: 72,
                  ),
                );
              },
              errorBuilder: (context, error, child) {
                return Center(
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.videocam_off_outlined,
                          color: Colors.white70,
                          size: 36,
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Capteur caméra indisponible (${error.errorCode.name}). Utilisez le lecteur QR ci-dessous.',
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: Colors.white70,
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            )
          else
            const Center(
              child: Text(
                'Caméra en pause',
                style: TextStyle(color: Colors.white70, fontSize: 12),
              ),
            ),

          // Viewfinder target reticle
          IgnorePointer(
            child: Container(
              width: 175,
              height: 175,
              decoration: BoxDecoration(
                border: Border.all(color: const Color(0xFFFCD116), width: 2.5),
                borderRadius: BorderRadius.circular(14),
              ),
            ),
          ),

          // Top camera controls (Torch & Pause/Resume)
          Positioned(
            top: 8,
            right: 8,
            child: Row(
              children: [
                IconButton(
                  key: const Key('toggle_torch_button'),
                  onPressed: () async {
                    try {
                      await _scannerController?.toggleTorch();
                      if (mounted) {
                        setState(() {
                          _torchEnabled = !_torchEnabled;
                        });
                      }
                    } catch (_) {}
                  },
                  icon: Icon(
                    _torchEnabled ? Icons.flash_on : Icons.flash_off,
                    color: _torchEnabled ? const Color(0xFFFCD116) : Colors.white,
                    size: 20,
                  ),
                  tooltip: 'Activer/Désactiver le flash',
                ),
                IconButton(
                  key: const Key('toggle_camera_scan_button'),
                  onPressed: () async {
                    setState(() {
                      _isCameraActive = !_isCameraActive;
                    });
                    try {
                      if (_isCameraActive) {
                        await _scannerController?.start();
                      } else {
                        await _scannerController?.stop();
                      }
                    } catch (_) {}
                  },
                  icon: Icon(
                    _isCameraActive
                        ? Icons.pause_circle_outline
                        : Icons.play_circle_outline,
                    color: Colors.white,
                    size: 20,
                  ),
                  tooltip: _isCameraActive
                      ? 'Mettre la caméra en pause'
                      : 'Reprendre le scan caméra',
                ),
              ],
            ),
          ),

          // Bottom guidance pill
          Positioned(
            bottom: 10,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
              decoration: BoxDecoration(
                color: Colors.black87,
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Text(
                'Scannez un Badge Chauffeur (CR80) ou une Licence de Transport AOTUC',
                style: TextStyle(color: Colors.white, fontSize: 10),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOutcomeCard(InspectionOutcome outcome) {
    final isGreen = outcome.status == InspectionResultType.VALIDE_VERT;
    final isOrange = outcome.status == InspectionResultType.ATTENTION_ORANGE;

    final bgColor = isGreen
        ? const Color(0xFFECFDF5)
        : isOrange
            ? const Color(0xFFFFFBEB)
            : const Color(0xFFFEF2F2);
    final borderColor = isGreen
        ? const Color(0xFF10B981)
        : isOrange
            ? const Color(0xFFF59E0B)
            : const Color(0xFFEF4444);
    final headerColor = isGreen
        ? const Color(0xFF065F46)
        : isOrange
            ? const Color(0xFF92400E)
            : const Color(0xFF991B1B);
    final iconData = isGreen
        ? Icons.verified
        : isOrange
            ? Icons.warning_amber_rounded
            : Icons.gpp_bad;

    return Container(
      key: const Key('verification_result_card'),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: borderColor, width: 2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(iconData, color: headerColor, size: 28),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  outcome.title,
                  key: const Key('verification_result_title'),
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                    color: headerColor,
                  ),
                ),
              ),
              TextButton.icon(
                key: const Key('reset_scan_button'),
                onPressed: _resetCurrentScan,
                icon: const Icon(Icons.refresh, size: 14),
                label: const Text(
                  'Nouveau Contrôle',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            outcome.message,
            key: const Key('verification_result_message'),
            style: const TextStyle(fontSize: 12, color: Colors.black87),
          ),
          if (outcome.credentialId != null) ...[
            const Divider(height: 18),
            _buildDetailRow(
              'Nature du Titre',
              outcome.entityTypeLabel ?? outcome.entityType ?? 'Titre AOTUC',
            ),
            _buildDetailRow('N° Série Officiel', outcome.credentialId!),
            if (outcome.targetId != null)
              _buildDetailRow('Identifiant Titulaire / Véhicule', outcome.targetId!),
            if (outcome.keyId != null)
              _buildDetailRow('Clé Cryptographique Ed25519', outcome.keyId!),
            if (outcome.expiryDate != null)
              _buildDetailRow(
                'Date d Expiration Légale',
                _formatDateFr(outcome.expiryDate!),
              ),
            if (outcome.revocationReason != null)
              _buildDetailRow('Motif de Révocation', outcome.revocationReason!),
            _buildDetailRow(
              'Authenticité Signature RFC 8032',
              outcome.isAuthentic ? 'CERTIFIÉE AUTHENTIQUE' : 'NON CERTIFIÉE',
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            '$label :',
            style: const TextStyle(fontSize: 11, color: Colors.black54),
          ),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );
  }

  String _formatDateFr(DateTime dt) {
    final local = dt.toLocal();
    final d = local.day.toString().padLeft(2, '0');
    final m = local.month.toString().padLeft(2, '0');
    final y = local.year.toString().padLeft(4, '0');
    return '$d/$m/$y';
  }
}
