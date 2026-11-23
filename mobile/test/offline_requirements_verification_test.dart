import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:image_picker/image_picker.dart';
import 'package:aotuc_mobile/core/auth/auth_models.dart';
import 'package:aotuc_mobile/core/auth/auth_service.dart';
import 'package:aotuc_mobile/core/database/offline_database.dart';
import 'package:aotuc_mobile/core/security/local_crypto_service.dart';
import 'package:aotuc_mobile/core/services/media_and_gps_service.dart';
import 'package:aotuc_mobile/core/services/registration_api_service.dart';
import 'package:aotuc_mobile/core/sync/sync_manager.dart';
import 'package:aotuc_mobile/features/enrolment/views/enrolment_form_view.dart';
import 'package:aotuc_mobile/features/sync/views/sync_management_view.dart';

class TestSecureStore implements SecureCredentialStore {
  final Map<String, String> _data = {};

  @override
  Future<String?> read(String key) async => _data[key];

  @override
  Future<void> write(String key, String value) async {
    _data[key] = value;
  }

  @override
  Future<void> delete(String key) async {
    _data.remove(key);
  }
}

String _createTestJwt({required String sub, required int expSecondsFromNow}) {
  final header = base64Url.encode(utf8.encode(jsonEncode({'alg': 'HS256', 'typ': 'JWT'})));
  final exp = (DateTime.now().millisecondsSinceEpoch ~/ 1000) + expSecondsFromNow;
  final payload = base64Url.encode(utf8.encode(jsonEncode({'sub': sub, 'exp': exp})));
  return '$header.$payload.sig';
}

void main() {
  setUp(() {
    OfflineDatabase.enableInMemoryTestMode();
    LocalCryptoService.setTestMasterKey(List<int>.generate(32, (i) => i + 1));
    MediaAndGpsService.setTestOverrides();
  });

  group('Director Offline Requirements Verification Suite (All 7 Points)', () {
    // -------------------------------------------------------------------------
    // REQUIREMENT 1: Offline Session Continuity
    // -------------------------------------------------------------------------
    testWidgets('Requirement 1: Agent logs in while connected, session persists offline when connection is lost',
        (WidgetTester tester) async {
      final store = TestSecureStore();
      final validAccess = _createTestJwt(sub: 'usr-agent-01', expSecondsFromNow: 3600);
      final validRefresh = _createTestJwt(sub: 'usr-agent-01', expSecondsFromNow: 86400);

      final mockClient = MockClient((http.Request req) async {
        if (req.url.path == '/api/v1/auth/login') {
          return http.Response(
            jsonEncode({
              'success': true,
              'data': {
                'user': {
                  'id': 'usr-agent-01',
                  'email': 'agent.conakry@aotuc.test',
                  'phoneNumber': '+224620112233',
                  'firstName': 'Mamadou',
                  'lastName': 'Diallo',
                  'roles': ['AGENT_TERRAIN'],
                  'permissions': ['drivers.create', 'owners.create', 'vehicles.create', 'unions.create'],
                  'communeId': 'cm-matam',
                  'commune': {'id': 'cm-matam', 'code': 'MTM', 'name': 'Matam'},
                },
                'accessToken': validAccess,
                'refreshToken': validRefresh,
              },
            }),
            200,
          );
        }
        if (req.url.path == '/api/v1/auth/me') {
          // Simulate offline: throw socket exception
          throw http.ClientException('Network unreachable');
        }
        return http.Response('Not Found', 404);
      });

      final authService = AuthService(
        credentialStore: store,
        httpClient: mockClient,
      );

      // 1. Initial login while connected
      final loginSuccess = await authService.login(
        identifier: 'agent.conakry@aotuc.test',
        password: 'Password2026!',
      );
      expect(loginSuccess, isTrue);
      expect(authService.isAuthenticated, isTrue);
      expect(authService.currentUser?.fullName, 'Mamadou Diallo');

      // 2. Simulate internet connection lost + app cold restart
      await OfflineDatabase.simulateAppRestart();
      final freshAuthService = AuthService(
        credentialStore: store,
        httpClient: mockClient, // /me will throw Network unreachable
      );

      await freshAuthService.restoreSession();

      // Session must be preserved offline
      expect(freshAuthService.isAuthenticated, isTrue);
      expect(freshAuthService.currentUser?.id, 'usr-agent-01');
      expect(freshAuthService.currentUser?.assignedCommuneName, 'Matam');
      expect(freshAuthService.accessToken, validAccess);
    });

    // -------------------------------------------------------------------------
    // REQUIREMENT 2 & 3: Offline Enrolment (Driver, Owner, Vehicle, Syndicat) & Secure Photos
    // -------------------------------------------------------------------------
    testWidgets('Requirement 2 & 3: Agent enrolls Driver, Owner, Vehicle, and Syndicat while offline with encrypted media',
        (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final store = TestSecureStore();
      final mockClient = MockClient((http.Request req) async {
        // Entire test is offline -> all network calls fail
        throw http.ClientException('Internet is offline');
      });

      final authService = AuthService(credentialStore: store, httpClient: mockClient);
      final testUser = MobileUser(
        id: 'usr-agent-01',
        email: 'agent.matoto@aotuc.test',
        phoneNumber: '+224620000005',
        firstName: 'Ibrahima',
        lastName: 'Camara',
        roles: const ['AGENT_TERRAIN'],
        permissions: const ['drivers.create', 'owners.create', 'vehicles.create', 'unions.create'],
        communeId: 'cm-matoto',
        commune: const MobileCommune(id: 'cm-matoto', code: 'MTT', name: 'Matoto'),
      );

      await store.write('aotuc_secure_access_token', _createTestJwt(sub: testUser.id, expSecondsFromNow: 3600));
      await store.write('aotuc_secure_user_profile', testUser.toRawJson());
      await authService.restoreSession();

      // Configure mock media capture with deterministic SHA-256 hex
      MediaAndGpsService.setTestOverrides(
        mediaOverride: ({required category, required label, required source}) async {
          const fakeJpgBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
          final bytes = base64Decode(fakeJpgBase64);
          final sha256Hash = await MediaAndGpsService.computeSha256Hex(bytes);
          return CapturedDocument(
            category: category,
            label: label,
            originalName: '${category.toLowerCase()}.jpg',
            mimeType: 'image/jpeg',
            base64Data: fakeJpgBase64,
            sizeBytes: bytes.length,
            fileHashSha256: sha256Hash,
          );
        },
        gpsOverride: () async => GpsLocationResult(
          status: 'OK',
          latitude: 9.5370,
          longitude: -13.6785,
          capturedAt: DateTime(2026, 11, 23, 10, 0),
          message: 'GPS acquis (Conakry)',
        ),
      );

      final apiService = RegistrationApiService(authService: authService, httpClient: mockClient);

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: EnrolmentFormView(
              authService: authService,
              apiService: apiService,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // 1. ENROLL SYNDICAT (UNION) OFFLINE
      await tester.ensureVisible(find.byKey(const Key('tab_union_registration')));
      await tester.tap(find.byKey(const Key('tab_union_registration')));
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('union_code_input')), 'FNTG-TEST');
      await tester.enterText(find.byKey(const Key('union_name_input')), 'Fédération Nationale des Transports de Guinée');
      await tester.enterText(find.byKey(const Key('union_reg_number_input')), 'AGR-2026-FNTG-001');
      await tester.enterText(find.byKey(const Key('union_leader_input')), 'Elhadj Ousmane Sylla');
      await tester.enterText(find.byKey(const Key('union_cni_input')), 'CNI-RESP-778899');
      await tester.enterText(find.byKey(const Key('union_phone_input')), '+224622112233');

      // Capture documents for Syndicat
      await tester.ensureVisible(find.byKey(const Key('cam_btn_PHOTO_PORTRAIT')));
      await tester.tap(find.byKey(const Key('cam_btn_PHOTO_PORTRAIT')));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byKey(const Key('cam_btn_CNI_RECTO')));
      await tester.tap(find.byKey(const Key('cam_btn_CNI_RECTO')));
      await tester.pumpAndSettle();

      await tester.ensureVisible(find.byKey(const Key('save_union_offline_button')));
      await tester.tap(find.byKey(const Key('save_union_offline_button')));
      await tester.pumpAndSettle();

      // 2. ENROLL OWNER OFFLINE
      await tester.ensureVisible(find.byKey(const Key('tab_owner_registration')));
      await tester.tap(find.byKey(const Key('tab_owner_registration')));
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('owner_firstname_input')), 'Moussa');
      await tester.enterText(find.byKey(const Key('owner_lastname_input')), 'Tounkara');
      await tester.enterText(find.byKey(const Key('owner_nin_input')), 'NIN-OWN-OFFLINE-01');
      await tester.enterText(find.byKey(const Key('owner_phone_input')), '+224623445566');

      await tester.ensureVisible(find.byKey(const Key('save_owner_offline_button')));
      await tester.tap(find.byKey(const Key('save_owner_offline_button')));
      await tester.pumpAndSettle();

      // 3. ENROLL DRIVER OFFLINE
      await tester.ensureVisible(find.byKey(const Key('tab_driver_registration')));
      await tester.tap(find.byKey(const Key('tab_driver_registration')));
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('driver_firstname_input')), 'Amadou');
      await tester.enterText(find.byKey(const Key('driver_lastname_input')), 'Sow');
      await tester.enterText(find.byKey(const Key('driver_nin_input')), 'NIN-DRV-OFFLINE-01');
      await tester.enterText(find.byKey(const Key('driver_phone_input')), '+224624778899');
      await tester.enterText(find.byKey(const Key('driver_emergency_phone_input')), '+224625112233');
      await tester.enterText(find.byKey(const Key('driver_license_input')), 'PC-DRV-OFFLINE-01');

      // Capture documents for Driver
      await tester.ensureVisible(find.byKey(const Key('cam_btn_PHOTO_PORTRAIT')));
      await tester.tap(find.byKey(const Key('cam_btn_PHOTO_PORTRAIT')));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byKey(const Key('cam_btn_PERMIS_CONDUIRE')));
      await tester.tap(find.byKey(const Key('cam_btn_PERMIS_CONDUIRE')));
      await tester.pumpAndSettle();

      await tester.ensureVisible(find.byKey(const Key('save_offline_draft_button')));
      await tester.tap(find.byKey(const Key('save_offline_draft_button')));
      await tester.pumpAndSettle();

      // 4. ENROLL VEHICLE OFFLINE (with ATR and Licence AOTUC)
      await tester.ensureVisible(find.byKey(const Key('tab_vehicle_registration')));
      await tester.tap(find.byKey(const Key('tab_vehicle_registration')));
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('vehicle_plate_input')), 'RC-OFFLINE-01');
      await tester.enterText(find.byKey(const Key('vehicle_card_input')), 'CG-OFFLINE-01');
      await tester.enterText(find.byKey(const Key('vehicle_vin_input')), 'VIN-OFFLINE-01');
      await tester.enterText(find.byKey(const Key('vehicle_atr_input')), 'ATR-GN-2026-999');
      await tester.enterText(find.byKey(const Key('vehicle_aotuc_lic_input')), 'AOTUC-LIC-0088');
      await tester.enterText(find.byKey(const Key('vehicle_make_input')), 'Toyota');
      await tester.enterText(find.byKey(const Key('vehicle_model_input')), 'Corolla');

      // Capture carte grise and vehicle photo
      await tester.ensureVisible(find.byKey(const Key('cam_btn_PHOTO_VEHICULE_AVANT')));
      await tester.tap(find.byKey(const Key('cam_btn_PHOTO_VEHICULE_AVANT')));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byKey(const Key('cam_btn_CARTE_GRISE')));
      await tester.tap(find.byKey(const Key('cam_btn_CARTE_GRISE')));
      await tester.pumpAndSettle();

      await tester.ensureVisible(find.byKey(const Key('save_vehicle_offline_button')));
      await tester.tap(find.byKey(const Key('save_vehicle_offline_button')));
      await tester.pumpAndSettle();

      // 5. Verify local encrypted SQLite drafts
      final drafts = await OfflineDatabase.instance.getPendingSyncDrafts(agentUserId: testUser.id);
      expect(drafts.length, 4);

      // Verify strict priority sorting: UNION (0) -> OWNER (1) -> DRIVER (2) -> VEHICLE (3)
      expect(drafts[0]['entity_type'], 'UNION');
      expect(drafts[1]['entity_type'], 'OWNER');
      expect(drafts[2]['entity_type'], 'DRIVER');
      expect(drafts[3]['entity_type'], 'VEHICLE');

      // Verify payload details
      final unionPayload = jsonDecode(drafts[0]['payload_json'] as String) as Map<String, dynamic>;
      expect(unionPayload['code'], 'FNTG-TEST');
      expect(unionPayload['fonction'], 'Président');
      expect(unionPayload['cniNumber'], 'CNI-RESP-778899');
      expect((unionPayload['documents'] as List).length, 2);

      final vehiclePayload = jsonDecode(drafts[3]['payload_json'] as String) as Map<String, dynamic>;
      expect(vehiclePayload['atrNumber'], 'ATR-GN-2026-999');
      expect(vehiclePayload['aotucLicenseNumber'], 'AOTUC-LIC-0088');
      expect((vehiclePayload['documents'] as List).length, 2);

      // Verify ciphertext at rest (encrypted with AES-256-GCM)
      final rawRows = await OfflineDatabase.instance.getRawDraftRowsForTest();
      for (final r in rawRows) {
        expect(r['is_encrypted'], 1);
        final rawEnvelope = jsonDecode(r['payload_json'] as String);
        expect(rawEnvelope['alg'], 'AES-256-GCM');
        expect(rawEnvelope['c'], isNotNull);
        expect(rawEnvelope['t'], isNotNull);
      }
    });

    // -------------------------------------------------------------------------
    // REQUIREMENT 4 & 5: PostgreSQL Synchronization, Retries, Duplicate Prevention
    // -------------------------------------------------------------------------
    testWidgets('Requirement 4 & 5: Batch synchronization pushes all records to backend with idempotency & retry recovery',
        (WidgetTester tester) async {
      final pushedBatches = <List<dynamic>>[];
      int pushCalls = 0;

      final mockClient = MockClient((http.Request req) async {
        if (req.url.path == '/api/v1/sync/push' && req.method == 'POST') {
          pushCalls++;
          final body = jsonDecode(req.body) as Map<String, dynamic>;
          final items = body['items'] as List<dynamic>;
          pushedBatches.add(items);

          if (pushCalls == 1) {
            // First call fails with network drop simulation
            throw http.ClientException('Connection aborted during upload');
          }

          // Second call succeeds with idempotency and record creation
          final results = items.map((it) {
            return {
              'clientGeneratedId': it['clientGeneratedId'],
              'entityType': it['entityType'],
              'status': 'SUCCESS',
              'serverRecordId': 'srv-${it['entityType'].toLowerCase()}-${it['clientGeneratedId'].substring(0, 6)}',
            };
          }).toList();

          return http.Response(
            jsonEncode({
              'success': true,
              'data': {
                'syncedAt': DateTime.now().toIso8601String(),
                'results': results,
              },
            }),
            200,
          );
        }
        return http.Response('Not Found', 404);
      });

      final syncManager = SyncManager(
        backendBaseUrl: 'http://10.0.2.2:5000',
        authToken: 'test-token',
        agentUserId: 'usr-agent-01',
        httpClient: mockClient,
      );

      // Populate 4 offline drafts in SQLite
      await OfflineDatabase.instance.insertDraft(
        clientId: 'draft-union-1',
        agentUserId: 'usr-agent-01',
        entityType: 'UNION',
        payloadJson: jsonEncode({'code': 'USTG', 'name': 'Union Syndicale', 'fonction': 'Secrétaire général'}),
      );
      await OfflineDatabase.instance.insertDraft(
        clientId: 'draft-owner-1',
        agentUserId: 'usr-agent-01',
        entityType: 'OWNER',
        payloadJson: jsonEncode({'firstName': 'Alpha', 'lastName': 'Diallo', 'nin': 'NIN-OWN-01', 'phoneNumber': '+224621000001'}),
      );
      await OfflineDatabase.instance.insertDraft(
        clientId: 'draft-driver-1',
        agentUserId: 'usr-agent-01',
        entityType: 'DRIVER',
        payloadJson: jsonEncode({'firstName': 'Thierno', 'lastName': 'Bah', 'nin': 'NIN-DRV-01', 'phoneNumber': '+224622000002', 'drivingLicenseNumber': 'PC-001'}),
      );
      await OfflineDatabase.instance.insertDraft(
        clientId: 'draft-vehicle-1',
        agentUserId: 'usr-agent-01',
        entityType: 'VEHICLE',
        payloadJson: jsonEncode({
          'plateNumber': 'RC-1111-A',
          'registrationCardNumber': 'CG-1111',
          'chassisVin': 'VIN-1111',
          'atrNumber': 'ATR-GN-111',
          'aotucLicenseNumber': 'AOTUC-LIC-111',
          'vehicleType': 'TAXI_COLLECTIF',
          'make': 'Toyota',
          'model': 'Corolla',
        }),
      );

      // Attempt 1: Network drop occurs
      final summaryFail = await syncManager.synchronizePendingDrafts('device-01', trigger: 'MANUAL');
      expect(summaryFail.networkFailed, isTrue);

      // Records must NOT be lost: marked as FAILED with NETWORK_INTERRUPTED
      final allDrafts = await OfflineDatabase.instance.getAllDraftsForAgent(agentUserId: 'usr-agent-01');
      for (final d in allDrafts) {
        expect(d['sync_status'], 'FAILED');
        expect(d['error_code'], 'NETWORK_INTERRUPTED');
      }

      // Attempt 2: Connection returns -> AUTO_RECONNECT automatically re-queues and syncs
      final summarySuccess = await syncManager.onConnectivityChanged(
        isConnected: true,
        syncDeviceId: 'device-01',
      );
      expect(summarySuccess?.accepted, 4);
      expect(summarySuccess?.failed, 0);

      // Verify the pushed order in the HTTP request payload: UNION -> OWNER -> DRIVER -> VEHICLE
      final pushedItems = pushedBatches.last;
      expect(pushedItems[0]['entityType'], 'UNION');
      expect(pushedItems[1]['entityType'], 'OWNER');
      expect(pushedItems[2]['entityType'], 'DRIVER');
      expect(pushedItems[3]['entityType'], 'VEHICLE');

      // Verify SQLite state: all 4 records are now SYNCED
      final syncedDrafts = await OfflineDatabase.instance.getAllDraftsForAgent(agentUserId: 'usr-agent-01');
      for (final d in syncedDrafts) {
        expect(d['sync_status'], 'SYNCED');
        expect(d['server_record_id'], startsWith('srv-'));
      }
    });

    // -------------------------------------------------------------------------
    // REQUIREMENT 6: Sync Status Visibility (Pending, Synced, Failed Indicators)
    // -------------------------------------------------------------------------
    testWidgets('Requirement 6: UI displays clear status indicators for pending, synced, and failed records with filter tabs',
        (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final store = TestSecureStore();
      final mockClient = MockClient((http.Request req) async => http.Response('{}', 200));
      final authService = AuthService(credentialStore: store, httpClient: mockClient);
      final testUser = MobileUser(
        id: 'usr-agent-01',
        email: 'agent@aotuc.test',
        phoneNumber: '+224620000005',
        firstName: 'Aliou',
        lastName: 'Bah',
        roles: const ['AGENT_TERRAIN'],
        permissions: const ['drivers.create'],
      );

      await store.write('aotuc_secure_access_token', _createTestJwt(sub: testUser.id, expSecondsFromNow: 3600));
      await store.write('aotuc_secure_user_profile', testUser.toRawJson());
      await authService.restoreSession();

      // Populate drafts with distinct statuses
      await OfflineDatabase.instance.insertDraft(
        clientId: 'item-pending-1',
        agentUserId: 'usr-agent-01',
        entityType: 'DRIVER',
        payloadJson: jsonEncode({'firstName': 'Alpha', 'lastName': 'Diallo', 'nin': 'NIN-1', 'phoneNumber': '+224621111111', 'drivingLicenseNumber': 'PC-1'}),
      );
      await OfflineDatabase.instance.insertDraft(
        clientId: 'item-synced-1',
        agentUserId: 'usr-agent-01',
        entityType: 'UNION',
        payloadJson: jsonEncode({'code': 'FEGUTRA', 'name': 'Fédération Guinéenne', 'fonction': 'Président'}),
      );
      await OfflineDatabase.instance.markDraftSynced('item-synced-1', serverRecordId: 'srv-union-01', syncedAt: DateTime.now().toIso8601String());

      await OfflineDatabase.instance.insertDraft(
        clientId: 'item-failed-1',
        agentUserId: 'usr-agent-01',
        entityType: 'VEHICLE',
        payloadJson: jsonEncode({'plateNumber': 'RC-9999-X', 'make': 'Toyota', 'model': 'Hiace'}),
      );
      await OfflineDatabase.instance.markDraftFailed(clientId: 'item-failed-1', errorCode: 'HTTP_500', message: 'Erreur serveur AOTUC');

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SyncManagementView(
              authService: authService,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Verify filter tabs and counts
      expect(find.text('Tous (3)'), findsOneWidget);
      expect(find.text('En attente (1)'), findsOneWidget);
      expect(find.text('Synchronisés (1)'), findsOneWidget);
      expect(find.text('Échecs (1)'), findsOneWidget);

      // Verify status badges
      expect(find.text('EN ATTENTE'), findsAtLeastNWidgets(1));
      expect(find.text('SYNCHRONISÉ'), findsAtLeastNWidgets(1));
      expect(find.text('ÉCHEC'), findsAtLeastNWidgets(1));

      // Filter by Échecs
      await tester.tap(find.text('Échecs (1)'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Erreur serveur AOTUC'), findsOneWidget);
    });

    // -------------------------------------------------------------------------
    // REQUIREMENT 7: Application Restart Persistence
    // -------------------------------------------------------------------------
    testWidgets('Requirement 7: Offline drafts survive application restart without loss of data',
        (WidgetTester tester) async {
      // 1. Save 2 offline drafts
      await OfflineDatabase.instance.insertDraft(
        clientId: 'persist-union-01',
        agentUserId: 'usr-agent-01',
        entityType: 'UNION',
        payloadJson: jsonEncode({'code': 'SNTG', 'name': 'Syndicat National', 'fonction': 'Trésorier'}),
      );
      await OfflineDatabase.instance.insertDraft(
        clientId: 'persist-vehicle-01',
        agentUserId: 'usr-agent-01',
        entityType: 'VEHICLE',
        payloadJson: jsonEncode({
          'plateNumber': 'RC-PERSIST-1',
          'atrNumber': 'ATR-PERSIST-99',
          'aotucLicenseNumber': 'AOTUC-PERSIST-44',
        }),
      );

      // 2. Simulate complete application exit / cold boot
      await OfflineDatabase.simulateAppRestart();

      // 3. Reload drafts upon cold restart
      final restored = await OfflineDatabase.instance.getPendingSyncDrafts(agentUserId: 'usr-agent-01');
      expect(restored.length, 2);

      final restoredUnion = jsonDecode(restored[0]['payload_json'] as String) as Map<String, dynamic>;
      expect(restoredUnion['code'], 'SNTG');
      expect(restoredUnion['fonction'], 'Trésorier');

      final restoredVehicle = jsonDecode(restored[1]['payload_json'] as String) as Map<String, dynamic>;
      expect(restoredVehicle['plateNumber'], 'RC-PERSIST-1');
      expect(restoredVehicle['atrNumber'], 'ATR-PERSIST-99');
      expect(restoredVehicle['aotucLicenseNumber'], 'AOTUC-PERSIST-44');
    });
  });
}
