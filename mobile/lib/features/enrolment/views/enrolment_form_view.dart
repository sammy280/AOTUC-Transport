import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../../core/auth/auth_models.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/database/offline_database.dart';
import '../../../core/services/media_and_gps_service.dart';
import '../../../core/services/registration_api_service.dart';
import '../../../core/sync/sync_manager.dart';

class EnrolmentFormView extends StatefulWidget {
  final AuthService authService;
  final RegistrationApiService? apiService;

  const EnrolmentFormView({
    super.key,
    required this.authService,
    this.apiService,
  });

  @override
  State<EnrolmentFormView> createState() => _EnrolmentFormViewState();
}

class _EnrolmentFormViewState extends State<EnrolmentFormView> {
  static const List<String> _allCommunes = [
    'Kaloum',
    'Dixinn',
    'Matam',
    'Ratoma',
    'Matoto',
  ];

  late final RegistrationApiService _apiService;

  // Sub-navigation: 0 = Driver, 1 = Owner, 2 = Vehicle, 3 = Search
  int _activeSection = 0;

  int _pendingCount = 0;
  bool _isSubmitting = false;
  bool _isSyncing = false;
  String? _statusMessage;
  bool _statusIsError = false;

  // Reference Catalog (Owners, Drivers, Lines, Unions)
  ReferenceCatalog _catalog = const ReferenceCatalog();

  // Shared GPS State
  GpsLocationResult? _currentGps;
  bool _isCapturingGps = false;

  // --- 1. DRIVER FORM CONTROLLERS & STATE ---
  final _driverFormKey = GlobalKey<FormState>();
  final _drvFirstNameCtrl = TextEditingController();
  final _drvLastNameCtrl = TextEditingController();
  final _drvNinCtrl = TextEditingController();
  final _drvPhoneCtrl = TextEditingController(text: '+224 ');
  final _drvEmergencyPhoneCtrl = TextEditingController(text: '+224 ');
  final _drvEmergencyNameCtrl = TextEditingController();
  String _drvEmergencyRelation = 'Famille';
  final _drvEmailCtrl = TextEditingController();
  final _drvDobCtrl = TextEditingController(text: '1990-01-15');
  final _drvAddressCtrl = TextEditingController();
  final _drvLicenseCtrl = TextEditingController();
  final _drvLicenseExpCtrl = TextEditingController(text: '2029-12-31');
  String _drvLicenseCategory = 'B';
  String? _drvSelectedCommune;
  String? _drvSelectedUnionId;
  final Map<String, CapturedDocument> _driverDocs = {};

  // --- 2. OWNER FORM CONTROLLERS & STATE ---
  final _ownerFormKey = GlobalKey<FormState>();
  String _ownerType = 'INDIVIDU'; // INDIVIDU | ENTREPRISE
  final _ownFirstNameCtrl = TextEditingController();
  final _ownLastNameCtrl = TextEditingController();
  final _ownBusinessNameCtrl = TextEditingController();
  final _ownTaxNumberCtrl = TextEditingController();
  final _ownNinCtrl = TextEditingController();
  final _ownPhoneCtrl = TextEditingController(text: '+224 ');
  final _ownEmailCtrl = TextEditingController();
  final _ownAddressCtrl = TextEditingController();
  String? _ownSelectedCommune;
  String? _ownSelectedUnionId;
  final Map<String, CapturedDocument> _ownerDocs = {};

  // --- 3. VEHICLE FORM CONTROLLERS & STATE ---
  final _vehicleFormKey = GlobalKey<FormState>();
  final _vehPlateCtrl = TextEditingController();
  final _vehCardCtrl = TextEditingController();
  final _vehVinCtrl = TextEditingController();
  String _vehType = 'TAXI_COLLECTIF';
  final _vehMakeCtrl = TextEditingController();
  final _vehModelCtrl = TextEditingController();
  final _vehYearCtrl = TextEditingController(text: '2020');
  final _vehSeatsCtrl = TextEditingController(text: '5');
  final _vehInspCertCtrl = TextEditingController();
  final _vehInspCenterCtrl = TextEditingController(text: 'Centre Technique Conakry');
  final _vehInspExpCtrl = TextEditingController(text: '2027-12-31');
  int? _selectedOwnerIndex;
  int? _selectedDriverIndex;
  String? _selectedLineId;
  final Map<String, CapturedDocument> _vehicleDocs = {};

  // --- 4. SEARCH & DUPLICATE CHECK STATE ---
  final _searchCtrl = TextEditingController();
  bool _isSearching = false;
  List<Map<String, dynamic>> _searchResults = [];

  @override
  void initState() {
    super.initState();
    _apiService =
        widget.apiService ?? RegistrationApiService(authService: widget.authService);
    final user = widget.authService.currentUser;
    if (user != null) {
      _drvSelectedCommune = user.assignedCommuneName ?? _allCommunes.first;
      _ownSelectedCommune = user.assignedCommuneName ?? _allCommunes.first;
    }
    _refreshOutboxAndCatalog();
  }

  @override
  void dispose() {
    _drvFirstNameCtrl.dispose();
    _drvLastNameCtrl.dispose();
    _drvNinCtrl.dispose();
    _drvPhoneCtrl.dispose();
    _drvEmergencyPhoneCtrl.dispose();
    _drvEmergencyNameCtrl.dispose();
    _drvEmailCtrl.dispose();
    _drvDobCtrl.dispose();
    _drvAddressCtrl.dispose();
    _drvLicenseCtrl.dispose();
    _drvLicenseExpCtrl.dispose();
    _ownFirstNameCtrl.dispose();
    _ownLastNameCtrl.dispose();
    _ownBusinessNameCtrl.dispose();
    _ownTaxNumberCtrl.dispose();
    _ownNinCtrl.dispose();
    _ownPhoneCtrl.dispose();
    _ownEmailCtrl.dispose();
    _ownAddressCtrl.dispose();
    _vehPlateCtrl.dispose();
    _vehCardCtrl.dispose();
    _vehVinCtrl.dispose();
    _vehMakeCtrl.dispose();
    _vehModelCtrl.dispose();
    _vehYearCtrl.dispose();
    _vehSeatsCtrl.dispose();
    _vehInspCertCtrl.dispose();
    _vehInspCenterCtrl.dispose();
    _vehInspExpCtrl.dispose();
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _refreshOutboxAndCatalog() async {
    final user = widget.authService.currentUser;
    if (user == null) return;

    final drafts = await OfflineDatabase.instance.getPendingSyncDrafts(
      agentUserId: user.id,
    );
    final catalog = await _apiService.loadReferenceCatalog();

    if (mounted) {
      setState(() {
        _pendingCount = drafts.length;
        _catalog = catalog;
        if (_catalog.owners.isNotEmpty && _selectedOwnerIndex == null) {
          _selectedOwnerIndex = 0;
        }
      });
    }
  }

  Future<void> _handleCaptureGps() async {
    setState(() {
      _isCapturingGps = true;
    });
    final fix = await MediaAndGpsService.captureCurrentGps();
    if (mounted) {
      setState(() {
        _currentGps = fix;
        _isCapturingGps = false;
      });
    }
  }

  Future<void> _handlePickDocument({
    required Map<String, CapturedDocument> targetMap,
    required String category,
    required String label,
    required ImageSource source,
  }) async {
    if (source == ImageSource.camera) {
      final perm = await MediaAndGpsService.requestCameraPermission();
      if (!perm.isGranted) {
        if (mounted) {
          setState(() {
            _statusIsError = true;
            _statusMessage = perm.message.isNotEmpty
                ? perm.message
                : 'Accès à la caméra refusé. Veuillez autoriser la caméra pour prendre la photo.';
          });
        }
        return;
      }
    }

    final doc = await MediaAndGpsService.pickDocumentImage(
      category: category,
      label: label,
      source: source,
    );
    if (doc != null && mounted) {
      setState(() {
        targetMap[category] = doc;
      });
    }
  }

  Future<void> _syncDraftsNow() async {
    final user = widget.authService.currentUser;
    final token = widget.authService.accessToken;
    if (user == null || token == null) return;

    setState(() {
      _isSyncing = true;
      _statusMessage = null;
    });

    try {
      final devId = await widget.authService.getOrCreateDeviceId();
      final syncManager = SyncManager(
        backendBaseUrl: widget.authService.backendBaseUrl,
        authToken: token,
        agentUserId: user.id,
        deviceId: devId,
        httpClient: widget.authService.httpClient,
      );
      final summary = await syncManager.synchronizePendingDrafts(devId);
      await _refreshOutboxAndCatalog();

      if (mounted) {
        setState(() {
          _statusIsError =
              summary.conflicts > 0 || summary.failed > 0 || summary.networkFailed;
          _statusMessage = summary.message;
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _isSyncing = false;
        });
      }
    }
  }

  Future<void> _submitDriver({required bool preferOffline}) async {
    if (!_driverFormKey.currentState!.validate()) return;
    final user = widget.authService.currentUser!;

    setState(() {
      _isSubmitting = true;
      _statusMessage = null;
    });

    final effectiveCommune = user.isCommuneRestricted
        ? (user.assignedCommuneName ?? _drvSelectedCommune)
        : (_drvSelectedCommune ?? _allCommunes.first);

    final rawEmergencyPhone = _drvEmergencyPhoneCtrl.text.trim();
    final cleanedEmergencyPhone =
        (rawEmergencyPhone.isEmpty || rawEmergencyPhone == '+224') ? null : rawEmergencyPhone;

    final payload = <String, dynamic>{
      'firstName': _drvFirstNameCtrl.text.trim(),
      'lastName': _drvLastNameCtrl.text.trim(),
      'nin': _drvNinCtrl.text.trim().toUpperCase(),
      'phoneNumber': _drvPhoneCtrl.text.trim(),
      'emergencyContactPhone': cleanedEmergencyPhone,
      'emergencyContactName': _drvEmergencyNameCtrl.text.trim().isEmpty
          ? null
          : _drvEmergencyNameCtrl.text.trim(),
      'emergencyContactRelation':
          cleanedEmergencyPhone != null ? _drvEmergencyRelation : null,
      'email': _drvEmailCtrl.text.trim().isEmpty ? null : _drvEmailCtrl.text.trim(),
      'dateOfBirth': _drvDobCtrl.text.trim().isEmpty ? null : _drvDobCtrl.text.trim(),
      'address': _drvAddressCtrl.text.trim().isEmpty ? null : _drvAddressCtrl.text.trim(),
      'commune': effectiveCommune,
      'communeId': user.communeId,
      'drivingLicenseNumber': _drvLicenseCtrl.text.trim().toUpperCase(),
      'licenseCategory': _drvLicenseCategory,
      'licenseExpirationDate': _drvLicenseExpCtrl.text.trim(),
      'unionId': _drvSelectedUnionId ?? user.unionId,
      'registeredByUserId': user.id,
      if (_currentGps?.hasCoordinates == true) ...{
        'latitude': _currentGps!.latitude,
        'longitude': _currentGps!.longitude,
        'gpsCapturedAt': _currentGps!.capturedAt?.toIso8601String(),
      },
      'documents': _driverDocs.values.map((d) => d.toJson()).toList(),
    };

    final res = await _apiService.submitRegistration(
      entityType: 'DRIVER',
      payload: payload,
      preferOffline: preferOffline,
    );

    await _refreshOutboxAndCatalog();

    if (mounted) {
      setState(() {
        _isSubmitting = false;
        _statusIsError = !res.success;
        _statusMessage = res.message;
        if (res.success) {
          _drvFirstNameCtrl.clear();
          _drvLastNameCtrl.clear();
          _drvNinCtrl.clear();
          _drvPhoneCtrl.text = '+224 ';
          _drvEmergencyPhoneCtrl.text = '+224 ';
          _drvEmergencyNameCtrl.clear();
          _drvEmergencyRelation = 'Famille';
          _drvEmailCtrl.clear();
          _drvAddressCtrl.clear();
          _drvLicenseCtrl.clear();
          _driverDocs.clear();
        }
      });
    }
  }

  Future<void> _submitOwner({required bool preferOffline}) async {
    if (!_ownerFormKey.currentState!.validate()) return;
    final user = widget.authService.currentUser!;

    setState(() {
      _isSubmitting = true;
      _statusMessage = null;
    });

    final effectiveCommune = user.isCommuneRestricted
        ? (user.assignedCommuneName ?? _ownSelectedCommune)
        : (_ownSelectedCommune ?? _allCommunes.first);

    final payload = <String, dynamic>{
      'ownerType': _ownerType,
      'firstName': _ownFirstNameCtrl.text.trim(),
      'lastName': _ownLastNameCtrl.text.trim(),
      'businessName':
          _ownerType == 'ENTREPRISE' ? _ownBusinessNameCtrl.text.trim() : null,
      'taxNumber': _ownerType == 'ENTREPRISE' ? _ownTaxNumberCtrl.text.trim() : null,
      'nin': _ownNinCtrl.text.trim().toUpperCase(),
      'phoneNumber': _ownPhoneCtrl.text.trim(),
      'email': _ownEmailCtrl.text.trim().isEmpty ? null : _ownEmailCtrl.text.trim(),
      'address': _ownAddressCtrl.text.trim().isEmpty ? null : _ownAddressCtrl.text.trim(),
      'commune': effectiveCommune,
      'communeId': user.communeId,
      'unionId': _ownSelectedUnionId,
      'registeredByUserId': user.id,
      if (_currentGps?.hasCoordinates == true) ...{
        'latitude': _currentGps!.latitude,
        'longitude': _currentGps!.longitude,
        'gpsCapturedAt': _currentGps!.capturedAt?.toIso8601String(),
      },
      'documents': _ownerDocs.values.map((d) => d.toJson()).toList(),
    };

    final res = await _apiService.submitRegistration(
      entityType: 'OWNER',
      payload: payload,
      preferOffline: preferOffline,
    );

    await _refreshOutboxAndCatalog();

    if (mounted) {
      setState(() {
        _isSubmitting = false;
        _statusIsError = !res.success;
        _statusMessage = res.message;
        if (res.success) {
          _ownFirstNameCtrl.clear();
          _ownLastNameCtrl.clear();
          _ownBusinessNameCtrl.clear();
          _ownTaxNumberCtrl.clear();
          _ownNinCtrl.clear();
          _ownPhoneCtrl.text = '+224 ';
          _ownEmailCtrl.clear();
          _ownAddressCtrl.clear();
          _ownerDocs.clear();
        }
      });
    }
  }

  Future<void> _submitVehicle({required bool preferOffline}) async {
    if (!_vehicleFormKey.currentState!.validate()) return;
    final user = widget.authService.currentUser!;

    if (_catalog.owners.isEmpty ||
        _selectedOwnerIndex == null ||
        _selectedOwnerIndex! >= _catalog.owners.length) {
      setState(() {
        _statusIsError = true;
        _statusMessage =
            'Veuillez d abord enregistrer ou sélectionner un propriétaire pour ce véhicule.';
      });
      return;
    }

    setState(() {
      _isSubmitting = true;
      _statusMessage = null;
    });

    final chosenOwner = _catalog.owners[_selectedOwnerIndex!];
    final chosenDriver = (_selectedDriverIndex != null &&
            _selectedDriverIndex! >= 0 &&
            _selectedDriverIndex! < _catalog.drivers.length)
        ? _catalog.drivers[_selectedDriverIndex!]
        : null;

    final payload = <String, dynamic>{
      'ownerId': chosenOwner['id'],
      'ownerClientGeneratedId': chosenOwner['clientGeneratedId'],
      'ownerNin': chosenOwner['nin'],
      'driverId': chosenDriver?['id'],
      'driverClientGeneratedId': chosenDriver?['clientGeneratedId'],
      'transportLineId': _selectedLineId,
      'plateNumber': _vehPlateCtrl.text.trim().toUpperCase(),
      'registrationCardNumber': _vehCardCtrl.text.trim().toUpperCase(),
      'chassisVin': _vehVinCtrl.text.trim().toUpperCase(),
      'vehicleType': _vehType,
      'make': _vehMakeCtrl.text.trim(),
      'model': _vehModelCtrl.text.trim(),
      'year': int.tryParse(_vehYearCtrl.text.trim()) ?? 2020,
      'seatingCapacity': int.tryParse(_vehSeatsCtrl.text.trim()) ?? 5,
      'inspectionCertificateNumber': _vehInspCertCtrl.text.trim().isEmpty
          ? null
          : _vehInspCertCtrl.text.trim().toUpperCase(),
      'inspectionCenter': _vehInspCenterCtrl.text.trim(),
      'inspectionExpirationDate': _vehInspExpCtrl.text.trim(),
      'communeId': user.communeId,
      'registeredByUserId': user.id,
      if (_currentGps?.hasCoordinates == true) ...{
        'latitude': _currentGps!.latitude,
        'longitude': _currentGps!.longitude,
        'gpsCapturedAt': _currentGps!.capturedAt?.toIso8601String(),
      },
      'documents': _vehicleDocs.values.map((d) => d.toJson()).toList(),
    };

    final res = await _apiService.submitRegistration(
      entityType: 'VEHICLE',
      payload: payload,
      preferOffline: preferOffline,
    );

    await _refreshOutboxAndCatalog();

    if (mounted) {
      setState(() {
        _isSubmitting = false;
        _statusIsError = !res.success;
        _statusMessage = res.message;
        if (res.success) {
          _vehPlateCtrl.clear();
          _vehCardCtrl.clear();
          _vehVinCtrl.clear();
          _vehMakeCtrl.clear();
          _vehModelCtrl.clear();
          _vehInspCertCtrl.clear();
          _vehicleDocs.clear();
        }
      });
    }
  }

  Future<void> _runSearch() async {
    setState(() {
      _isSearching = true;
    });
    final found = await _apiService.searchExistingRecords(_searchCtrl.text);
    if (mounted) {
      setState(() {
        _searchResults = found;
        _isSearching = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.authService.currentUser;

    if (user == null || !user.canRegisterFieldRecords) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Card(
            color: const Color(0xFFFEF2F2),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: const BorderSide(color: Color(0xFFDC2626)),
            ),
            child: Padding(
              padding: const EdgeInsets.all(20.0),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.lock_person, size: 42, color: Color(0xFFDC2626)),
                  const SizedBox(height: 12),
                  const Text(
                    'Accès Restreint — Enrôlement Terrain',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 15,
                      color: Color(0xFF991B1B),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Votre rôle (${user?.primaryRoleLabel ?? "Non autorisé"}) ne dispose pas de la permission "drivers.create" requise.',
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 12, color: Color(0xFF991B1B)),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(14.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 1. Outbox Queue & Sync Header
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFCBD5E1)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.outbox, color: Color(0xFF0B1E36), size: 20),
                    const SizedBox(width: 8),
                    Text(
                      'File d attente (${user.firstName}) : $_pendingCount dossier(s)',
                      key: const Key('pending_drafts_counter'),
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                    ),
                  ],
                ),
                TextButton.icon(
                  key: const Key('sync_drafts_button'),
                  onPressed: (_pendingCount > 0 && !_isSyncing) ? _syncDraftsNow : null,
                  icon: const Icon(Icons.sync, size: 14),
                  label: Text(
                    _isSyncing ? 'Envoi...' : 'Envoyer',
                    style: const TextStyle(fontSize: 11),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),

          // 2. Commune Scope Lock / Selector Banner
          _buildCommuneScopeBanner(user),
          const SizedBox(height: 10),

          // 3. GPS Capture Bar
          _buildGpsCaptureBar(),
          const SizedBox(height: 12),

          // 4. Section Switcher (Chauffeur | Propriétaire | Véhicule | Recherche)
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _buildTabChip(
                  index: 0,
                  key: const Key('tab_driver_registration'),
                  icon: Icons.badge_outlined,
                  label: '1. Chauffeur',
                ),
                const SizedBox(width: 6),
                _buildTabChip(
                  index: 1,
                  key: const Key('tab_owner_registration'),
                  icon: Icons.business_center_outlined,
                  label: '2. Propriétaire',
                ),
                const SizedBox(width: 6),
                _buildTabChip(
                  index: 2,
                  key: const Key('tab_vehicle_registration'),
                  icon: Icons.directions_bus_outlined,
                  label: '3. Véhicule',
                ),
                const SizedBox(width: 6),
                _buildTabChip(
                  index: 3,
                  key: const Key('tab_search_duplicates'),
                  icon: Icons.manage_search,
                  label: 'Recherche / Doublons',
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // 5. Status / Error Feedback Banner
          if (_statusMessage != null)
            Container(
              key: const Key('registration_status_banner'),
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: _statusIsError ? const Color(0xFFFEF2F2) : const Color(0xFFECFDF5),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: _statusIsError ? const Color(0xFFDC2626) : const Color(0xFF10B981),
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    _statusIsError ? Icons.error_outline : Icons.check_circle_outline,
                    color: _statusIsError ? const Color(0xFFDC2626) : const Color(0xFF059669),
                    size: 20,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _statusMessage!,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: _statusIsError
                            ? const Color(0xFF991B1B)
                            : const Color(0xFF065F46),
                      ),
                    ),
                  ),
                ],
              ),
            ),

          // 6. Active Form Section
          if (_activeSection == 0) _buildDriverSection(user),
          if (_activeSection == 1) _buildOwnerSection(user),
          if (_activeSection == 2) _buildVehicleSection(user),
          if (_activeSection == 3) _buildSearchSection(),
        ],
      ),
    );
  }

  Widget _buildTabChip({
    required int index,
    required Key key,
    required IconData icon,
    required String label,
  }) {
    final isSelected = _activeSection == index;
    return ChoiceChip(
      key: key,
      selected: isSelected,
      onSelected: (_) {
        setState(() {
          _activeSection = index;
          _statusMessage = null;
        });
      },
      avatar: Icon(
        icon,
        size: 16,
        color: isSelected ? Colors.white : const Color(0xFF0B1E36),
      ),
      label: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.bold,
          color: isSelected ? Colors.white : const Color(0xFF0B1E36),
        ),
      ),
      selectedColor: const Color(0xFF0B1E36),
      backgroundColor: Colors.white,
    );
  }

  Widget _buildCommuneScopeBanner(MobileUser user) {
    if (user.isCommuneRestricted) {
      return Container(
        key: const Key('locked_commune_banner'),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: const Color(0xFFECFDF5),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFF10B981)),
        ),
        child: Row(
          children: [
            const Icon(Icons.location_on, size: 18, color: Color(0xFF059669)),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Périmètre Territorial Assigné : Commune de ${user.assignedCommuneName ?? "Non définie"} (${user.commune?.code ?? ""}) — Verrouillé',
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF065F46),
                ),
              ),
            ),
            const Icon(Icons.lock, size: 16, color: Color(0xFF059669)),
          ],
        ),
      );
    }

    return DropdownButtonFormField<String>(
      key: const Key('commune_dropdown'),
      initialValue: _drvSelectedCommune ?? _allCommunes.first,
      decoration: const InputDecoration(
        labelText: 'Commune d Affectation Terrain *',
        border: OutlineInputBorder(),
        contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      ),
      items: _allCommunes
          .map((c) => DropdownMenuItem(value: c, child: Text(c)))
          .toList(),
      onChanged: (v) {
        setState(() {
          _drvSelectedCommune = v;
          _ownSelectedCommune = v;
        });
      },
    );
  }

  Widget _buildGpsCaptureBar() {
    final hasFix = _currentGps?.hasCoordinates == true;
    return Container(
      key: const Key('gps_capture_card'),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: hasFix ? const Color(0xFFF0FDF4) : const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: hasFix ? const Color(0xFF22C55E) : const Color(0xFFCBD5E1),
        ),
      ),
      child: Row(
        children: [
          Icon(
            hasFix ? Icons.gps_fixed : Icons.gps_not_fixed,
            size: 18,
            color: hasFix ? const Color(0xFF15803D) : const Color(0xFF475569),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              _currentGps?.message ??
                  'Coordonnées GPS terrain : non capturées (cliquez sur Capturer GPS)',
              key: const Key('gps_status_text'),
              style: TextStyle(
                fontSize: 11,
                fontWeight: hasFix ? FontWeight.bold : FontWeight.normal,
                color: hasFix ? const Color(0xFF166534) : Colors.black87,
              ),
            ),
          ),
          TextButton.icon(
            key: const Key('capture_gps_button'),
            onPressed: _isCapturingGps ? null : _handleCaptureGps,
            icon: const Icon(Icons.my_location, size: 14),
            label: Text(
              _isCapturingGps ? 'Acquisition...' : 'Capturer GPS',
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDocumentCaptureRow({
    required Map<String, CapturedDocument> docsMap,
    required String category,
    required String label,
  }) {
    final captured = docsMap[category];
    Uint8List? previewBytes;
    if (captured != null && captured.base64Data.isNotEmpty) {
      try {
        final cleanB64 =
            captured.base64Data.replaceFirst(RegExp(r'^data:[^;]+;base64,'), '');
        previewBytes = base64Decode(cleanB64);
      } catch (_) {
        previewBytes = null;
      }
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: captured != null ? const Color(0xFFF0FDF4) : Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: captured != null ? const Color(0xFF22C55E) : const Color(0xFFCBD5E1),
        ),
      ),
      child: Row(
        children: [
          if (previewBytes != null && previewBytes.isNotEmpty)
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: Image.memory(
                previewBytes,
                key: Key('preview_img_$category'),
                width: 42,
                height: 42,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => const Icon(
                  Icons.check_circle,
                  size: 22,
                  color: Color(0xFF16A34A),
                ),
              ),
            )
          else
            Icon(
              captured != null ? Icons.check_circle : Icons.camera_alt_outlined,
              size: 18,
              color: captured != null ? const Color(0xFF16A34A) : Colors.black54,
            ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                ),
                if (captured != null)
                  Text(
                    '${captured.originalName} (${(captured.sizeBytes / 1024).toStringAsFixed(1)} Ko)',
                    style: const TextStyle(fontSize: 10, color: Color(0xFF166534)),
                  ),
              ],
            ),
          ),
          if (captured != null)
            TextButton.icon(
              key: Key('retake_btn_$category'),
              onPressed: () => _handlePickDocument(
                targetMap: docsMap,
                category: category,
                label: label,
                source: ImageSource.camera,
              ),
              icon: const Icon(Icons.replay, size: 14, color: Color(0xFFB45309)),
              label: const Text(
                'Reprendre',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFFB45309),
                ),
              ),
            ),
          IconButton(
            key: Key('cam_btn_$category'),
            onPressed: () => _handlePickDocument(
              targetMap: docsMap,
              category: category,
              label: label,
              source: ImageSource.camera,
            ),
            icon: const Icon(Icons.photo_camera, size: 18, color: Color(0xFF0B1E36)),
            tooltip: 'Prendre une photo (Caméra)',
          ),
          IconButton(
            key: Key('gal_btn_$category'),
            onPressed: () => _handlePickDocument(
              targetMap: docsMap,
              category: category,
              label: label,
              source: ImageSource.gallery,
            ),
            icon: const Icon(Icons.folder_open, size: 18, color: Color(0xFF0B1E36)),
            tooltip: 'Choisir depuis la galerie',
          ),
        ],
      ),
    );
  }

  Widget _buildSubmitButtons({
    required VoidCallback onOnlineSubmit,
    required VoidCallback onOfflineSubmit,
    required String offlineKey,
    required String onlineKey,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ElevatedButton.icon(
          key: Key(onlineKey),
          onPressed: _isSubmitting ? null : onOnlineSubmit,
          icon: const Icon(Icons.cloud_upload, color: Colors.white),
          label: Text(
            _isSubmitting ? 'Traitement en cours...' : 'Enregistrer & Transmettre au Serveur',
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
          ),
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF009460),
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 13),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        ),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          key: Key(offlineKey),
          onPressed: _isSubmitting ? null : onOfflineSubmit,
          icon: const Icon(Icons.save_alt, color: Color(0xFF0B1E36)),
          label: const Text(
            'Enregistrer Hors-Ligne (Chiffré AES-256)',
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 12,
              color: Color(0xFF0B1E36),
            ),
          ),
          style: OutlinedButton.styleFrom(
            padding: const EdgeInsets.symmetric(vertical: 12),
            side: const BorderSide(color: Color(0xFF0B1E36)),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        ),
      ],
    );
  }

  // ===========================================================================
  // 1. DRIVER FORM SECTION
  // ===========================================================================
  Widget _buildDriverSection(MobileUser user) {
    return Form(
      key: _driverFormKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'A. ENRÔLEMENT CHAUFFEUR PROFESSIONNEL',
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 13,
              color: Color(0xFF0B1E36),
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  key: const Key('driver_firstname_input'),
                  controller: _drvFirstNameCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Prénom *',
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  ),
                  validator: (v) => v == null || v.trim().length < 2 ? 'Requis' : null,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextFormField(
                  key: const Key('driver_lastname_input'),
                  controller: _drvLastNameCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Nom *',
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  ),
                  validator: (v) => v == null || v.trim().length < 2 ? 'Requis' : null,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  key: const Key('driver_nin_input'),
                  controller: _drvNinCtrl,
                  decoration: const InputDecoration(
                    labelText: 'N° NIN *',
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  ),
                  validator: (v) => v == null || v.trim().length < 5 ? 'NIN requis' : null,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextFormField(
                  key: const Key('driver_phone_input'),
                  controller: _drvPhoneCtrl,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(
                    labelText: 'Téléphone (+224) *',
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  ),
                  validator: (v) =>
                      v == null || v.trim().length < 8 ? 'Téléphone requis' : null,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          // Emergency Contact Row (Primary Phone vs Emergency Contact clearly distinguished)
          Row(
            children: [
              Expanded(
                flex: 3,
                child: TextFormField(
                  key: const Key('driver_emergency_phone_input'),
                  controller: _drvEmergencyPhoneCtrl,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(
                    labelText: "Tél. Urgence (+224)",
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                  ),
                  validator: (v) {
                    final raw = (v ?? '').trim();
                    if (raw.isEmpty || raw == '+224') return null;
                    final cleaned = raw.replaceAll(RegExp(r'[\s\-\.\(\)]'), '');
                    if (!RegExp(r'^(\+224|00224)?[6][0-9]{8}$').hasMatch(cleaned)) {
                      return "Numéro d'urgence invalide";
                    }
                    final primaryCleaned =
                        _drvPhoneCtrl.text.replaceAll(RegExp(r'[\s\-\.\(\)]'), '');
                    if (cleaned == primaryCleaned ||
                        cleaned.replaceFirst(RegExp(r'^(\+224|00224)'), '') ==
                            primaryCleaned.replaceFirst(RegExp(r'^(\+224|00224)'), '')) {
                      return "Différent du N° principal";
                    }
                    return null;
                  },
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                flex: 3,
                child: TextFormField(
                  key: const Key('driver_emergency_name_input'),
                  controller: _drvEmergencyNameCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Nom Contact Urgence',
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                  ),
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                flex: 2,
                child: DropdownButtonFormField<String>(
                  key: const Key('driver_emergency_relation_dropdown'),
                  initialValue: _drvEmergencyRelation,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'Lien',
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 6, vertical: 6),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'Famille', child: Text('Famille', style: TextStyle(fontSize: 11))),
                    DropdownMenuItem(value: 'Conjoint(e)', child: Text('Conjoint(e)', style: TextStyle(fontSize: 11))),
                    DropdownMenuItem(value: 'Parent', child: Text('Parent', style: TextStyle(fontSize: 11))),
                    DropdownMenuItem(value: 'Frère/Sœur', child: Text('Frère/Sœur', style: TextStyle(fontSize: 11))),
                    DropdownMenuItem(value: 'Ami(e)', child: Text('Ami(e)', style: TextStyle(fontSize: 11))),
                    DropdownMenuItem(value: 'Collègue', child: Text('Collègue', style: TextStyle(fontSize: 11))),
                    DropdownMenuItem(value: 'Autre', child: Text('Autre', style: TextStyle(fontSize: 11))),
                  ],
                  onChanged: (v) => setState(() => _drvEmergencyRelation = v ?? 'Famille'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  key: const Key('driver_email_input'),
                  controller: _drvEmailCtrl,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    labelText: 'Email (optionnel)',
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextFormField(
                  key: const Key('driver_dob_input'),
                  controller: _drvDobCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Date de naissance (AAAA-MM-JJ)',
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          TextFormField(
            key: const Key('driver_address_input'),
            controller: _drvAddressCtrl,
            decoration: const InputDecoration(
              labelText: 'Adresse / Quartier de résidence',
              border: OutlineInputBorder(),
              contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                flex: 2,
                child: TextFormField(
                  key: const Key('driver_license_input'),
                  controller: _drvLicenseCtrl,
                  decoration: const InputDecoration(
                    labelText: 'N° Permis de Conduire *',
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  ),
                  validator: (v) => v == null || v.trim().length < 4 ? 'Requis' : null,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: _drvLicenseCategory,
                  decoration: const InputDecoration(
                    labelText: 'Catégorie',
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'A', child: Text('A (Moto)')),
                    DropdownMenuItem(value: 'B', child: Text('B (Taxi)')),
                    DropdownMenuItem(value: 'C1', child: Text('C1 (Minibus)')),
                    DropdownMenuItem(value: 'C', child: Text('C')),
                    DropdownMenuItem(value: 'D', child: Text('D (Bus)')),
                  ],
                  onChanged: (v) => setState(() => _drvLicenseCategory = v!),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  key: const Key('driver_license_exp_input'),
                  controller: _drvLicenseExpCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Expiration Permis (AAAA-MM-JJ) *',
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  ),
                  validator: (v) => v == null || v.trim().isEmpty ? 'Requis' : null,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: DropdownButtonFormField<String?>(
                  initialValue: _drvSelectedUnionId,
                  decoration: const InputDecoration(
                    labelText: 'Syndicat / Organisation',
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  ),
                  items: [
                    const DropdownMenuItem<String?>(
                      value: null,
                      child: Text('Indépendant (Aucun)'),
                    ),
                    ..._catalog.unions.map(
                      (u) => DropdownMenuItem<String?>(
                        value: u['id']?.toString(),
                        child: Text(
                          u['name'] != null && u['name'].toString().isNotEmpty
                              ? '${u['code']} — ${u['name']}'
                              : '${u['code']}',
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ),
                  ],
                  onChanged: (v) => setState(() => _drvSelectedUnionId = v),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Text(
            'Photographie & Pièces Justificatives du Chauffeur',
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 6),
          _buildDocumentCaptureRow(
            docsMap: _driverDocs,
            category: 'PHOTO_PORTRAIT',
            label: 'Photo Portrait Chauffeur (4x4)',
          ),
          _buildDocumentCaptureRow(
            docsMap: _driverDocs,
            category: 'CNI_RECTO',
            label: 'Pièce d Identité Nationale (CNI)',
          ),
          _buildDocumentCaptureRow(
            docsMap: _driverDocs,
            category: 'PERMIS_CONDUIRE',
            label: 'Permis de Conduire Biométrique',
          ),
          const SizedBox(height: 12),
          _buildSubmitButtons(
            onOnlineSubmit: () => _submitDriver(preferOffline: false),
            onOfflineSubmit: () => _submitDriver(preferOffline: true),
            onlineKey: 'submit_driver_online_button',
            offlineKey: 'save_offline_draft_button',
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // 2. OWNER FORM SECTION
  // ===========================================================================
  Widget _buildOwnerSection(MobileUser user) {
    return Form(
      key: _ownerFormKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'B. ENRÔLEMENT PROPRIÉTAIRE (PARTICULIER OU ENTREPRISE)',
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 13,
              color: Color(0xFF0B1E36),
            ),
          ),
          const SizedBox(height: 10),
          DropdownButtonFormField<String>(
            key: const Key('owner_type_dropdown'),
            initialValue: _ownerType,
            decoration: const InputDecoration(
              labelText: 'Type de Propriétaire *',
              border: OutlineInputBorder(),
              contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            ),
            items: const [
              DropdownMenuItem(
                value: 'INDIVIDU',
                child: Text('Propriétaire Individuel (Personne physique)'),
              ),
              DropdownMenuItem(
                value: 'ENTREPRISE',
                child: Text('Entreprise / Société de Transport (Personne morale)'),
              ),
            ],
            onChanged: (v) => setState(() => _ownerType = v!),
          ),
          const SizedBox(height: 10),
          if (_ownerType == 'ENTREPRISE') ...[
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    key: const Key('owner_business_name_input'),
                    controller: _ownBusinessNameCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Raison Sociale / Nom Entreprise *',
                      border: OutlineInputBorder(),
                      contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    ),
                    validator: (v) => _ownerType == 'ENTREPRISE' &&
                            (v == null || v.trim().length < 2)
                        ? 'Raison sociale requise'
                        : null,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextFormField(
                    key: const Key('owner_tax_number_input'),
                    controller: _ownTaxNumberCtrl,
                    decoration: const InputDecoration(
                      labelText: 'N° RCCM / NIF Fiscal',
                      border: OutlineInputBorder(),
                      contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
          ],
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  key: const Key('owner_firstname_input'),
                  controller: _ownFirstNameCtrl,
                  decoration: InputDecoration(
                    labelText: _ownerType == 'ENTREPRISE'
                        ? 'Prénom du Représentant *'
                        : 'Prénom *',
                    border: const OutlineInputBorder(),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  ),
                  validator: (v) => v == null || v.trim().length < 2 ? 'Requis' : null,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextFormField(
                  key: const Key('owner_lastname_input'),
                  controller: _ownLastNameCtrl,
                  decoration: InputDecoration(
                    labelText:
                        _ownerType == 'ENTREPRISE' ? 'Nom du Représentant *' : 'Nom *',
                    border: const OutlineInputBorder(),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  ),
                  validator: (v) => v == null || v.trim().length < 2 ? 'Requis' : null,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  key: const Key('owner_nin_input'),
                  controller: _ownNinCtrl,
                  decoration: const InputDecoration(
                    labelText: 'N° NIN / Identifiant National *',
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  ),
                  validator: (v) => v == null || v.trim().length < 5 ? 'NIN requis' : null,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextFormField(
                  key: const Key('owner_phone_input'),
                  controller: _ownPhoneCtrl,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(
                    labelText: 'Téléphone (+224) *',
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  ),
                  validator: (v) =>
                      v == null || v.trim().length < 8 ? 'Téléphone requis' : null,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  key: const Key('owner_email_input'),
                  controller: _ownEmailCtrl,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    labelText: 'Email (optionnel)',
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextFormField(
                  key: const Key('owner_address_input'),
                  controller: _ownAddressCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Adresse / Siège',
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          DropdownButtonFormField<String?>(
            key: const Key('owner_union_dropdown'),
            initialValue: _ownSelectedUnionId,
            decoration: const InputDecoration(
              labelText: 'Syndicat / Organisation Professionnelle (Optionnel)',
              border: OutlineInputBorder(),
              contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            ),
            items: [
              const DropdownMenuItem<String?>(
                value: null,
                child: Text('Indépendant (Aucun syndicat)'),
              ),
              ..._catalog.unions.map(
                (u) => DropdownMenuItem<String?>(
                  value: u['id']?.toString(),
                  child: Text(
                    u['name'] != null && u['name'].toString().isNotEmpty
                        ? '${u['code']} — ${u['name']}'
                        : '${u['code']}',
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
            ],
            onChanged: (v) => setState(() => _ownSelectedUnionId = v),
          ),
          const SizedBox(height: 12),
          const Text(
            'Documents d Identité & Justificatifs du Propriétaire',
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 6),
          _buildDocumentCaptureRow(
            docsMap: _ownerDocs,
            category: 'CNI_RECTO',
            label: 'Pièce d Identité du Propriétaire (CNI)',
          ),
          _buildDocumentCaptureRow(
            docsMap: _ownerDocs,
            category: 'ATTESTATION_SYNDICALE',
            label: 'Justificatif / RCCM / Attestation',
          ),
          const SizedBox(height: 12),
          _buildSubmitButtons(
            onOnlineSubmit: () => _submitOwner(preferOffline: false),
            onOfflineSubmit: () => _submitOwner(preferOffline: true),
            onlineKey: 'submit_owner_online_button',
            offlineKey: 'save_owner_offline_button',
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // 3. VEHICLE FORM SECTION
  // ===========================================================================
  Widget _buildVehicleSection(MobileUser user) {
    return Form(
      key: _vehicleFormKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'C. ENRÔLEMENT VÉHICULE DE TRANSPORT',
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 13,
              color: Color(0xFF0B1E36),
            ),
          ),
          const SizedBox(height: 10),

          // Owner Association Dropdown
          DropdownButtonFormField<int>(
            key: const Key('vehicle_owner_dropdown'),
            initialValue: (_selectedOwnerIndex != null &&
                    _selectedOwnerIndex! < _catalog.owners.length)
                ? _selectedOwnerIndex
                : null,
            decoration: const InputDecoration(
              labelText: 'Propriétaire du Véhicule *',
              border: OutlineInputBorder(),
              contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            ),
            hint: const Text('Sélectionnez un propriétaire enregistré'),
            items: List.generate(
              _catalog.owners.length,
              (i) => DropdownMenuItem<int>(
                value: i,
                child: Text(
                  _catalog.owners[i]['label'].toString(),
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 11),
                ),
              ),
            ),
            onChanged: (v) => setState(() => _selectedOwnerIndex = v),
          ),
          const SizedBox(height: 10),

          Row(
            children: [
              Expanded(
                child: TextFormField(
                  key: const Key('vehicle_plate_input'),
                  controller: _vehPlateCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Plaque Immatriculation *',
                    hintText: 'RC-1234-A',
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  ),
                  validator: (v) =>
                      v == null || v.trim().length < 4 ? 'Plaque requise' : null,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: DropdownButtonFormField<String>(
                  key: const Key('vehicle_type_dropdown'),
                  initialValue: _vehType,
                  decoration: const InputDecoration(
                    labelText: 'Type de Véhicule *',
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'TAXI_COLLECTIF', child: Text('Taxi Collectif')),
                    DropdownMenuItem(value: 'MAGBANA_MINIBUS', child: Text('Minibus Magbana')),
                    DropdownMenuItem(value: 'BUS_URBAIN', child: Text('Bus Urbain')),
                    DropdownMenuItem(value: 'MOTOTAXI', child: Text('Moto-Taxi')),
                    DropdownMenuItem(value: 'AUTRE', child: Text('Autre')),
                  ],
                  onChanged: (v) => setState(() => _vehType = v!),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          Row(
            children: [
              Expanded(
                child: TextFormField(
                  key: const Key('vehicle_card_input'),
                  controller: _vehCardCtrl,
                  decoration: const InputDecoration(
                    labelText: 'N° Carte Grise *',
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  ),
                  validator: (v) =>
                      v == null || v.trim().length < 4 ? 'Carte grise requise' : null,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextFormField(
                  key: const Key('vehicle_vin_input'),
                  controller: _vehVinCtrl,
                  decoration: const InputDecoration(
                    labelText: 'N° Châssis (VIN) *',
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  ),
                  validator: (v) =>
                      v == null || v.trim().length < 6 ? 'VIN requis (min 6)' : null,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          Row(
            children: [
              Expanded(
                child: TextFormField(
                  key: const Key('vehicle_make_input'),
                  controller: _vehMakeCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Marque *',
                    hintText: 'Toyota',
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  ),
                  validator: (v) => v == null || v.trim().length < 2 ? 'Requis' : null,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextFormField(
                  key: const Key('vehicle_model_input'),
                  controller: _vehModelCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Modèle *',
                    hintText: 'HiAce',
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  ),
                  validator: (v) => v == null || v.trim().isEmpty ? 'Requis' : null,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          Row(
            children: [
              Expanded(
                child: TextFormField(
                  key: const Key('vehicle_year_input'),
                  controller: _vehYearCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Année',
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextFormField(
                  key: const Key('vehicle_seats_input'),
                  controller: _vehSeatsCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Nombre de places',
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Assigned Driver & Transport Line
          DropdownButtonFormField<int?>(
            key: const Key('vehicle_driver_dropdown'),
            initialValue: _selectedDriverIndex,
            decoration: const InputDecoration(
              labelText: 'Chauffeur Affecté (optionnel)',
              border: OutlineInputBorder(),
              contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            ),
            items: [
              const DropdownMenuItem<int?>(
                value: null,
                child: Text('Aucun chauffeur affecté pour l instant'),
              ),
              ...List.generate(
                _catalog.drivers.length,
                (i) => DropdownMenuItem<int?>(
                  value: i,
                  child: Text(
                    _catalog.drivers[i]['label'].toString(),
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 11),
                  ),
                ),
              ),
            ],
            onChanged: (v) => setState(() => _selectedDriverIndex = v),
          ),
          const SizedBox(height: 10),

          DropdownButtonFormField<String?>(
            key: const Key('vehicle_line_dropdown'),
            initialValue: _selectedLineId,
            decoration: const InputDecoration(
              labelText: 'Ligne de Transport (optionnel)',
              border: OutlineInputBorder(),
              contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            ),
            items: [
              const DropdownMenuItem<String?>(
                value: null,
                child: Text('Non affecté à une ligne fixe'),
              ),
              ..._catalog.lines.map(
                (l) => DropdownMenuItem<String?>(
                  value: l['id']?.toString(),
                  child: Text('${l['code']} — ${l['name']}', style: const TextStyle(fontSize: 11)),
                ),
              ),
            ],
            onChanged: (v) => setState(() => _selectedLineId = v),
          ),
          const SizedBox(height: 10),

          // Technical Inspection Info
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  key: const Key('vehicle_insp_cert_input'),
                  controller: _vehInspCertCtrl,
                  decoration: const InputDecoration(
                    labelText: 'N° Certificat Visite Technique',
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextFormField(
                  key: const Key('vehicle_insp_exp_input'),
                  controller: _vehInspExpCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Expiration Visite (AAAA-MM-JJ)',
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          const Text(
            'Photographies & Documents du Véhicule',
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 6),
          _buildDocumentCaptureRow(
            docsMap: _vehicleDocs,
            category: 'PHOTO_VEHICULE_AVANT',
            label: 'Photographie du Véhicule (Face Avant)',
          ),
          _buildDocumentCaptureRow(
            docsMap: _vehicleDocs,
            category: 'CARTE_GRISE',
            label: 'Carte Grise d Immatriculation',
          ),
          _buildDocumentCaptureRow(
            docsMap: _vehicleDocs,
            category: 'VISITE_TECHNIQUE',
            label: 'Certificat de Visite Technique',
          ),
          const SizedBox(height: 12),

          _buildSubmitButtons(
            onOnlineSubmit: () => _submitVehicle(preferOffline: false),
            onOfflineSubmit: () => _submitVehicle(preferOffline: true),
            onlineKey: 'submit_vehicle_online_button',
            offlineKey: 'save_vehicle_offline_button',
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // 4. SEARCH & DUPLICATE PREVENTION SECTION
  // ===========================================================================
  Widget _buildSearchSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'RECHERCHE PRÉALABLE & VÉRIFICATION ANTI-DOUBLON',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 13,
            color: Color(0xFF0B1E36),
          ),
        ),
        const SizedBox(height: 6),
        const Text(
          'Recherchez par NIN, numéro de téléphone, nom, permis, plaque d immatriculation ou châssis VIN avant de créer un dossier.',
          style: TextStyle(fontSize: 11, color: Colors.black54),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: TextField(
                key: const Key('search_records_input'),
                controller: _searchCtrl,
                onSubmitted: (_) => _runSearch(),
                decoration: const InputDecoration(
                  hintText: 'NIN, téléphone, plaque RC-..., permis, nom...',
                  prefixIcon: Icon(Icons.search),
                  border: OutlineInputBorder(),
                  contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                ),
              ),
            ),
            const SizedBox(width: 8),
            ElevatedButton(
              key: const Key('search_records_button'),
              onPressed: _isSearching ? null : _runSearch,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0B1E36),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              ),
              child: const Text('Vérifier'),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (_isSearching)
          const Center(
            child: Padding(
              padding: EdgeInsets.all(16.0),
              child: CircularProgressIndicator(),
            ),
          )
        else if (_searchResults.isEmpty)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: const Text(
              'Aucun dossier correspondant trouvé (base centrale & file locale).',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: Colors.black54),
            ),
          )
        else
          ..._searchResults.map(
            (item) {
              Uint8List? photoBytes;
              final rawB64 = item['photoBase64']?.toString();
              if (rawB64 != null && rawB64.isNotEmpty) {
                try {
                  final cleanB64 = rawB64.replaceFirst(RegExp(r'^data:[^;]+;base64,'), '');
                  photoBytes = base64Decode(cleanB64);
                } catch (_) {
                  photoBytes = null;
                }
              }
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  dense: true,
                  leading: (photoBytes != null && photoBytes.isNotEmpty)
                      ? ClipRRect(
                          borderRadius: BorderRadius.circular(6),
                          child: Image.memory(
                            photoBytes,
                            width: 38,
                            height: 38,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) =>
                                const Icon(Icons.verified_user, color: Color(0xFF0B1E36)),
                          ),
                        )
                      : const Icon(Icons.verified_user, color: Color(0xFF0B1E36)),
                  title: Text(
                    '${item['type']} — ${item['title']}',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                  ),
                  subtitle: Text(
                    item['subtitle']?.toString() ?? '',
                    style: const TextStyle(fontSize: 11),
                  ),
                ),
              );
            },
          ),
      ],
    );
  }
}
