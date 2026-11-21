import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:aotuc_mobile/main.dart';
import 'package:aotuc_mobile/core/auth/auth_models.dart';
import 'package:aotuc_mobile/core/auth/auth_service.dart';
import 'package:aotuc_mobile/core/database/offline_database.dart';
import 'package:aotuc_mobile/core/security/local_crypto_service.dart';
import 'package:aotuc_mobile/core/services/media_and_gps_service.dart';
import 'package:aotuc_mobile/core/sync/sync_manager.dart';

class InMemorySecureStore implements SecureCredentialStore {
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

String _buildTestJwt({required String sub, required int expSecondsFromNow}) {
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

  group('Phase 2 — Mobile Authentication, Token Security, RBAC & Shared-Device Isolation', () {
    testWidgets(
      '1–4 & 7: Unauthenticated guard, Invalid credentials, Unknown user, Deactivated account, Correct Login & Logout',
      (WidgetTester tester) async {
        final store = InMemorySecureStore();

        final mockClient = MockClient((http.Request req) async {
          if (req.url.path == '/api/v1/auth/login') {
            final body = jsonDecode(req.body) as Map<String, dynamic>;
            final id = body['identifier'] as String;
            final pwd = body['password'] as String;

            if (id == 'unknown@aotuc.test') {
              return http.Response(
                jsonEncode({
                  'success': false,
                  'code': 'INVALID_CREDENTIALS',
                  'message': 'Identifiants de connexion invalides.',
                }),
                401,
              );
            }
            if (id == 'deactivated@aotuc.test') {
              return http.Response(
                jsonEncode({
                  'success': false,
                  'code': 'ACCOUNT_INACTIVE',
                  'message': 'Ce compte utilisateur a été désactivé par un administrateur.',
                }),
                403,
              );
            }
            if (id == 'agent.matoto@aotuc.test' && pwd == 'WrongPass123!') {
              return http.Response(
                jsonEncode({
                  'success': false,
                  'code': 'INVALID_CREDENTIALS',
                  'message': 'Identifiants de connexion invalides.',
                }),
                401,
              );
            }
            if (id == 'agent.matoto@aotuc.test' && pwd == 'StrongPass2026!') {
              return http.Response(
                jsonEncode({
                  'success': true,
                  'data': {
                    'user': {
                      'id': 'usr-agt-matoto',
                      'email': 'agent.matoto@aotuc.test',
                      'phoneNumber': '+224620000005',
                      'firstName': 'Sekou',
                      'lastName': 'Conte',
                      'roles': ['AGENT_TERRAIN'],
                      'permissions': ['drivers.create', 'drivers.read', 'credentials.verify'],
                      'communeId': 'cm-matoto',
                      'commune': {'id': 'cm-matoto', 'code': 'MTT', 'name': 'Matoto'},
                    },
                    'accessToken': _buildTestJwt(sub: 'usr-agt-matoto', expSecondsFromNow: 900),
                    'refreshToken': _buildTestJwt(sub: 'usr-agt-matoto', expSecondsFromNow: 86400),
                  },
                }),
                200,
              );
            }
          }
          if (req.url.path == '/api/v1/auth/logout') {
            return http.Response(jsonEncode({'success': true}), 200);
          }
          return http.Response(jsonEncode({'success': true, 'data': {'items': []}}), 200);
        });

        final authService = AuthService(
          credentialStore: store,
          httpClient: mockClient,
        );

        await tester.pumpWidget(
          AotucMobileApp(authService: authService, autoRestoreSession: false),
        );
        await tester.pumpAndSettle();

        // 1. Unauthenticated user sees LoginView, NOT dashboard
        expect(find.text('Authentification Officielle AOTUC'), findsOneWidget);
        expect(find.byKey(const Key('header_user_fullname')), findsNothing);

        // 2. Incorrect password
        await tester.enterText(
          find.byKey(const Key('login_identifier_input')),
          'agent.matoto@aotuc.test',
        );
        await tester.enterText(
          find.byKey(const Key('login_password_input')),
          'WrongPass123!',
        );
        await tester.tap(find.byKey(const Key('login_submit_button')));
        await tester.pumpAndSettle();

        expect(find.byKey(const Key('login_error_banner')), findsOneWidget);
        expect(find.textContaining('Identifiants de connexion invalides'), findsOneWidget);

        // 3. Unknown user
        await tester.enterText(
          find.byKey(const Key('login_identifier_input')),
          'unknown@aotuc.test',
        );
        await tester.tap(find.byKey(const Key('login_submit_button')));
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('login_error_banner')), findsOneWidget);

        // 4. Deactivated account
        await tester.enterText(
          find.byKey(const Key('login_identifier_input')),
          'deactivated@aotuc.test',
        );
        await tester.tap(find.byKey(const Key('login_submit_button')));
        await tester.pumpAndSettle();
        expect(authService.status, AuthStatus.accountDeactivated);
        expect(find.byKey(const Key('deactivated_banner')), findsOneWidget);

        // 5. Correct login
        await tester.enterText(
          find.byKey(const Key('login_identifier_input')),
          'agent.matoto@aotuc.test',
        );
        await tester.enterText(
          find.byKey(const Key('login_password_input')),
          'StrongPass2026!',
        );
        await tester.tap(find.byKey(const Key('login_submit_button')));
        await tester.pumpAndSettle();

        expect(authService.isAuthenticated, isTrue);
        expect(find.byKey(const Key('header_user_fullname')), findsOneWidget);
        expect(find.text('Sekou Conte'), findsOneWidget);
        expect(find.textContaining('Matoto'), findsWidgets);

        // Verify commune is locked for field agent on Enrolment tab
        await tester.tap(find.text('Enrôlement Terrain'));
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('locked_commune_banner')), findsOneWidget);
        expect(find.byKey(const Key('commune_dropdown')), findsNothing);

        // 7. Logout clears secure store and returns to LoginView
        await tester.tap(find.byKey(const Key('logout_button')));
        await tester.pumpAndSettle();

        expect(authService.isAuthenticated, isFalse);
        expect(await store.read('aotuc_secure_access_token'), isNull);
        expect(find.text('Authentification Officielle AOTUC'), findsOneWidget);
      },
    );

    test(
      '5, 6, 8, 11 & 12: Expired Access Token Auto-Refresh, Session Restoration, Device Revocation & Network Error',
      () async {
        final store = InMemorySecureStore();
        bool deviceRevokedOnServer = false;

        final mockClient = MockClient((http.Request req) async {
          if (req.url.path == '/api/v1/auth/refresh') {
            if (deviceRevokedOnServer) {
              return http.Response(
                jsonEncode({
                  'success': false,
                  'code': 'DEVICE_REVOKED',
                  'message': 'L accès de cet appareil mobile a été révoqué par un administrateur AOTUC.',
                }),
                401,
              );
            }
            return http.Response(
              jsonEncode({
                'success': true,
                'data': {
                  'accessToken': _buildTestJwt(sub: 'usr-agt-matoto', expSecondsFromNow: 900),
                  'refreshToken': _buildTestJwt(sub: 'usr-agt-matoto', expSecondsFromNow: 86400),
                },
              }),
              200,
            );
          }
          if (req.url.path == '/api/v1/auth/me') {
            if (deviceRevokedOnServer) {
              return http.Response(
                jsonEncode({
                  'success': false,
                  'code': 'DEVICE_REVOKED',
                  'message': 'L accès de cet appareil mobile a été révoqué par un administrateur AOTUC.',
                }),
                401,
              );
            }
            return http.Response(
              jsonEncode({
                'success': true,
                'data': {
                  'user': {
                    'id': 'usr-agt-matoto',
                    'email': 'agent.matoto@aotuc.test',
                    'phoneNumber': '+224620000005',
                    'firstName': 'Sekou',
                    'lastName': 'Conte',
                    'roles': ['AGENT_TERRAIN'],
                    'permissions': ['drivers.create', 'credentials.verify'],
                    'communeId': 'cm-matoto',
                    'commune': {'id': 'cm-matoto', 'code': 'MTT', 'name': 'Matoto'},
                  },
                },
              }),
              200,
            );
          }
          throw Exception('Network unreachable');
        });

        await store.write(
          'aotuc_secure_access_token',
          _buildTestJwt(sub: 'usr-agt-matoto', expSecondsFromNow: -120),
        );
        await store.write(
          'aotuc_secure_refresh_token',
          _buildTestJwt(sub: 'usr-agt-matoto', expSecondsFromNow: 86400),
        );
        await store.write(
          'aotuc_secure_user_profile',
          const MobileUser(
            id: 'usr-agt-matoto',
            phoneNumber: '+224620000005',
            firstName: 'Sekou',
            lastName: 'Conte',
            roles: ['AGENT_TERRAIN'],
            permissions: ['drivers.create'],
            communeId: 'cm-matoto',
          ).toRawJson(),
        );

        final authService = AuthService(credentialStore: store, httpClient: mockClient);
        await authService.restoreSession();

        expect(authService.isAuthenticated, isTrue);
        expect(authService.currentUser?.fullName, 'Sekou Conte');
        expect(authService.currentUser?.assignedCommuneName, 'Matoto');

        deviceRevokedOnServer = true;
        await authService.restoreSession();
        expect(authService.status, AuthStatus.deviceRevoked);
        expect(authService.isAuthenticated, isFalse);
        expect(await store.read('aotuc_secure_access_token'), isNull);

        final offlineService = AuthService(
          credentialStore: store,
          httpClient: MockClient((_) async => throw Exception('SocketException')),
        );
        final ok = await offlineService.login(
          identifier: 'agent.matoto@aotuc.test',
          password: 'DevAotuc2026!',
        );
        expect(ok, isFalse);
        expect(offlineService.errorMessage, contains('Impossible de joindre le serveur AOTUC'));
      },
    );

    test(
      '9 & 10: Shared-Device Multi-Agent Isolation, AES-256-GCM Offline Encryption & Role Restrictions',
      () async {
        await OfflineDatabase.instance.insertDraft(
          clientId: 'draft-agent-1',
          agentUserId: 'usr-agt-matoto',
          entityType: 'DRIVER',
          payloadJson: jsonEncode({
            'firstName': 'Mamadou',
            'lastName': 'Bah',
            'nin': 'NIN-SECRET-998877',
            'phoneNumber': '+224622112233',
          }),
        );

        final rawRows = await OfflineDatabase.instance.getRawDraftRowsForTest();
        expect(rawRows.length, 1);
        final rawCiphertext = rawRows.first['payload_json'] as String;
        expect(rawCiphertext, contains('AES-256-GCM'));
        expect(rawCiphertext, isNot(contains('NIN-SECRET-998877')));
        expect(rawCiphertext, isNot(contains('Mamadou')));

        final agent2Drafts = await OfflineDatabase.instance.getPendingSyncDrafts(
          agentUserId: 'usr-agt-kaloum',
        );
        expect(agent2Drafts, isEmpty);

        expect(
          () => LocalCryptoService.decryptPayload(
            rawCiphertext,
            agentUserId: 'usr-agt-kaloum',
          ),
          throwsA(anything),
        );

        final agent1Drafts = await OfflineDatabase.instance.getPendingSyncDrafts(
          agentUserId: 'usr-agt-matoto',
        );
        expect(agent1Drafts.length, 1);
        final decrypted = jsonDecode(agent1Drafts.first['payload_json'] as String);
        expect(decrypted['nin'], 'NIN-SECRET-998877');

        const syndicatUser = MobileUser(
          id: 'usr-syn-01',
          phoneNumber: '+224620000007',
          firstName: 'Amadou',
          lastName: 'Diallo',
          roles: ['SYNDICAT'],
          permissions: ['drivers.read', 'credentials.verify'],
        );
        expect(syndicatUser.canRegisterFieldRecords, isFalse);
        expect(syndicatUser.canVerifyCredentials, isTrue);
      },
    );
  });

  group('Phase 3 — Complete Mobile Registration (Drivers, Owners, Vehicles, Camera, GPS, Duplicates & Search)', () {
    testWidgets(
      'Driver, Owner (Company), Vehicle registration with Camera, GPS, Relationships & Duplicate Prevention',
      (WidgetTester tester) async {
        // Set larger test surface so all form inputs are visible without excessive scrolling
        tester.view.physicalSize = const Size(1200, 2200);
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);

        MediaAndGpsService.setTestOverrides(
          gpsOverride: () async => GpsLocationResult(
            status: 'OK',
            latitude: 9.598412,
            longitude: -13.605211,
            capturedAt: DateTime.parse('2026-11-17T12:00:00Z'),
            message: 'GPS acquis : 9.59841, -13.60521 (±5 m)',
          ),
          mediaOverride: ({
            required String category,
            required String label,
            required dynamic source,
          }) async =>
              CapturedDocument(
                category: category,
                label: label,
                originalName: '${category.toLowerCase()}.jpg',
                mimeType: 'image/jpeg',
                base64Data: '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAA==',
                sizeBytes: 2048,
              ),
        );

        final store = InMemorySecureStore();
        final serverDrivers = <Map<String, dynamic>>[];
        final serverOwners = <Map<String, dynamic>>[];
        final serverVehicles = <Map<String, dynamic>>[];

        final mockClient = MockClient((http.Request req) async {
          if (req.url.path == '/api/v1/auth/me') {
            return http.Response(
              jsonEncode({
                'success': true,
                'data': {
                  'user': {
                    'id': 'usr-agt-matoto',
                    'email': 'agent.matoto@aotuc.test',
                    'phoneNumber': '+224620000005',
                    'firstName': 'Sekou',
                    'lastName': 'Conte',
                    'roles': ['AGENT_TERRAIN'],
                    'permissions': [
                      'drivers.create',
                      'drivers.read',
                      'owners.create',
                      'vehicles.create',
                    ],
                    'communeId': 'cm-matoto',
                    'commune': {'id': 'cm-matoto', 'code': 'MTT', 'name': 'Matoto'},
                  },
                },
              }),
              200,
            );
          }
          if (req.url.path == '/api/v1/registration/owners' && req.method == 'GET') {
            return http.Response(
              jsonEncode({'success': true, 'data': {'items': serverOwners}}),
              200,
            );
          }
          if (req.url.path == '/api/v1/registration/drivers' && req.method == 'GET') {
            return http.Response(
              jsonEncode({'success': true, 'data': {'items': serverDrivers}}),
              200,
            );
          }
          if (req.url.path == '/api/v1/registration/vehicles' && req.method == 'GET') {
            return http.Response(
              jsonEncode({'success': true, 'data': {'items': serverVehicles}}),
              200,
            );
          }
          if (req.url.path == '/api/v1/sync/pull') {
            return http.Response(
              jsonEncode({
                'success': true,
                'data': {
                  'lines': [
                    {'id': 'line-01', 'code': 'L01', 'name': 'Madina - Kaloum'}
                  ],
                  'unions': [
                    {'id': 'union-01', 'code': 'FEGUTRA', 'name': 'Fédération Guinéenne'}
                  ],
                },
              }),
              200,
            );
          }
          if (req.url.path == '/api/v1/registration/drivers' && req.method == 'POST') {
            final body = jsonDecode(req.body) as Map<String, dynamic>;
            if (serverDrivers.any((d) => d['person']['nin'] == body['nin'])) {
              return http.Response(
                jsonEncode({
                  'success': false,
                  'code': 'DRIVER_ALREADY_REGISTERED',
                  'message': 'Doublon détecté : ce NIN est déjà enregistré.',
                }),
                409,
              );
            }
            final record = {
              'id': 'srv-drv-001',
              'drivingLicenseNumber': body['drivingLicenseNumber'],
              'person': {
                'firstName': body['firstName'],
                'lastName': body['lastName'],
                'nin': body['nin'],
                'phoneNumber': body['phoneNumber'],
                'commune': body['commune'],
                'latitude': body['latitude'],
                'longitude': body['longitude'],
              },
              'documents': body['documents'],
            };
            serverDrivers.add(record);
            return http.Response(jsonEncode({'success': true, 'data': record}), 201);
          }
          if (req.url.path == '/api/v1/registration/owners' && req.method == 'POST') {
            final body = jsonDecode(req.body) as Map<String, dynamic>;
            final record = {
              'id': 'srv-own-001',
              'ownerType': body['ownerType'],
              'businessName': body['businessName'],
              'taxNumber': body['taxNumber'],
              'person': {
                'firstName': body['firstName'],
                'lastName': body['lastName'],
                'nin': body['nin'],
                'phoneNumber': body['phoneNumber'],
                'commune': body['commune'],
              },
              'documents': body['documents'],
            };
            serverOwners.add(record);
            return http.Response(jsonEncode({'success': true, 'data': record}), 201);
          }
          if (req.url.path == '/api/v1/registration/vehicles' && req.method == 'POST') {
            final body = jsonDecode(req.body) as Map<String, dynamic>;
            final record = {
              'id': 'srv-veh-001',
              'ownerId': body['ownerId'],
              'driverId': body['driverId'],
              'plateNumber': body['plateNumber'],
              'registrationCardNumber': body['registrationCardNumber'],
              'chassisVin': body['chassisVin'],
              'vehicleType': body['vehicleType'],
              'make': body['make'],
              'model': body['model'],
              'owner': serverOwners.first,
            };
            serverVehicles.add(record);
            return http.Response(jsonEncode({'success': true, 'data': record}), 201);
          }
          return http.Response(jsonEncode({'success': true}), 200);
        });

        await store.write(
          'aotuc_secure_access_token',
          _buildTestJwt(sub: 'usr-agt-matoto', expSecondsFromNow: 900),
        );
        await store.write(
          'aotuc_secure_refresh_token',
          _buildTestJwt(sub: 'usr-agt-matoto', expSecondsFromNow: 86400),
        );
        await store.write(
          'aotuc_secure_user_profile',
          const MobileUser(
            id: 'usr-agt-matoto',
            phoneNumber: '+224620000005',
            firstName: 'Sekou',
            lastName: 'Conte',
            roles: ['AGENT_TERRAIN'],
            permissions: ['drivers.create', 'owners.create', 'vehicles.create'],
            communeId: 'cm-matoto',
            commune: MobileCommune(id: 'cm-matoto', code: 'MTT', name: 'Matoto'),
          ).toRawJson(),
        );

        final authService = AuthService(credentialStore: store, httpClient: mockClient);
        await authService.restoreSession();

        await tester.pumpWidget(
          AotucMobileApp(authService: authService, autoRestoreSession: false),
        );
        await tester.pumpAndSettle();

        // Navigate to Enrolment tab
        await tester.tap(find.text('Enrôlement Terrain'));
        await tester.pumpAndSettle();

        // 1. Capture GPS coordinates
        await tester.tap(find.byKey(const Key('capture_gps_button')));
        await tester.pumpAndSettle();
        expect(find.textContaining('9.59841'), findsOneWidget);

        // 2. Capture Driver Portrait via Camera button
        await tester.tap(find.byKey(const Key('cam_btn_PHOTO_PORTRAIT')));
        await tester.pumpAndSettle();
        expect(find.textContaining('photo_portrait.jpg'), findsOneWidget);

        // 3. Fill & Submit Driver Online
        await tester.enterText(find.byKey(const Key('driver_firstname_input')), 'Mamadou');
        await tester.enterText(find.byKey(const Key('driver_lastname_input')), 'Sylla');
        await tester.enterText(find.byKey(const Key('driver_nin_input')), 'NIN-SYLLA-001');
        await tester.enterText(find.byKey(const Key('driver_phone_input')), '+224621001122');
        await tester.enterText(find.byKey(const Key('driver_license_input')), 'PC-GN-7788');
        await tester.tap(find.byKey(const Key('submit_driver_online_button')));
        await tester.pumpAndSettle();

        expect(find.byKey(const Key('registration_status_banner')), findsOneWidget);
        expect(serverDrivers.length, 1);
        expect(serverDrivers.first['person']['latitude'], closeTo(9.598412, 0.0001));
        expect((serverDrivers.first['documents'] as List).length, 1);

        // 4. Switch to Owner tab (2. Propriétaire) and register a Company Owner (ENTREPRISE)
        await tester.tap(find.byKey(const Key('tab_owner_registration')));
        await tester.pumpAndSettle();

        await tester.tap(find.byKey(const Key('owner_type_dropdown')));
        await tester.pumpAndSettle();
        await tester.tap(find.textContaining('Entreprise / Société').last);
        await tester.pumpAndSettle();

        await tester.enterText(
          find.byKey(const Key('owner_business_name_input')),
          'Guinée Express Transport SARL',
        );
        await tester.enterText(find.byKey(const Key('owner_tax_number_input')), 'NIF-2026-GN');
        await tester.enterText(find.byKey(const Key('owner_firstname_input')), 'Alpha');
        await tester.enterText(find.byKey(const Key('owner_lastname_input')), 'Conde');
        await tester.enterText(find.byKey(const Key('owner_nin_input')), 'NIN-CONDE-002');
        await tester.enterText(find.byKey(const Key('owner_phone_input')), '+224622334455');
        await tester.tap(find.byKey(const Key('cam_btn_CNI_RECTO')));
        await tester.pumpAndSettle();

        await tester.tap(find.byKey(const Key('submit_owner_online_button')));
        await tester.pumpAndSettle();

        expect(serverOwners.length, 1);
        expect(serverOwners.first['ownerType'], 'ENTREPRISE');
        expect(serverOwners.first['businessName'], 'Guinée Express Transport SARL');

        // 5. Switch to Vehicle tab (3. Véhicule) and link to registered Owner & Driver
        await tester.tap(find.byKey(const Key('tab_vehicle_registration')));
        await tester.pumpAndSettle();

        await tester.enterText(find.byKey(const Key('vehicle_plate_input')), 'RC-9988-A');
        await tester.enterText(find.byKey(const Key('vehicle_card_input')), 'CG-2026-9988');
        await tester.enterText(find.byKey(const Key('vehicle_vin_input')), 'VIN9988776655');
        await tester.enterText(find.byKey(const Key('vehicle_make_input')), 'Toyota');
        await tester.enterText(find.byKey(const Key('vehicle_model_input')), 'HiAce');
        await tester.tap(find.byKey(const Key('cam_btn_PHOTO_VEHICULE_AVANT')));
        await tester.pumpAndSettle();

        await tester.tap(find.byKey(const Key('submit_vehicle_online_button')));
        await tester.pumpAndSettle();

        expect(serverVehicles.length, 1);
        expect(serverVehicles.first['ownerId'], 'srv-own-001');
        expect(serverVehicles.first['plateNumber'], 'RC-9988-A');

        // 6. Switch to Search / Duplicate Check tab (4. Recherche / Doublons)
        await tester.tap(find.byKey(const Key('tab_search_duplicates')));
        await tester.pumpAndSettle();

        await tester.enterText(find.byKey(const Key('search_records_input')), 'RC-9988-A');
        await tester.tap(find.byKey(const Key('search_records_button')));
        await tester.pumpAndSettle();

        expect(find.textContaining('RC-9988-A'), findsWidgets);
        expect(find.textContaining('Mamadou Sylla'), findsWidgets);
      },
    );
  });

  group('Phase 4 — Offline Functionality, Auto-Sync, Conflict Management, Relationship Order & Sync Console', () {
    test(
      '1–7: Offline registration, App restart survival, Multi-agent isolation, Interrupted upload recovery, Auto-reconnect sync in OWNER->DRIVER->VEHICLE->DOCUMENT order, Duplicate sync lock & Document SHA-256 integrity',
      () async {
        // 1. Insert drafts out of order (DOCUMENT, VEHICLE, DRIVER, OWNER) for Agent 1
        final validBytes = base64Decode('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAA==');
        final validHash = await MediaAndGpsService.computeSha256Hex(validBytes);

        await OfflineDatabase.instance.insertDraft(
          clientId: 'cli-veh-1',
          agentUserId: 'usr-agt-matoto',
          agentName: 'Sekou Conte',
          entityType: 'VEHICLE',
          payloadJson: jsonEncode({
            'ownerClientGeneratedId': 'cli-own-1',
            'driverClientGeneratedId': 'cli-drv-1',
            'plateNumber': 'RC-4400-A',
            'registrationCardNumber': 'CG-4400',
            'chassisVin': 'VIN-4400-GN',
            'vehicleType': 'MAGBANA_MINIBUS',
            'make': 'Toyota',
            'model': 'HiAce',
            'latitude': 9.6012,
            'longitude': -13.6045,
          }),
        );

        await OfflineDatabase.instance.insertDraft(
          clientId: 'cli-doc-1',
          agentUserId: 'usr-agt-matoto',
          agentName: 'Sekou Conte',
          entityType: 'DOCUMENT',
          payloadJson: jsonEncode({
            'vehicleClientGeneratedId': 'cli-veh-1',
            'category': 'CARTE_GRISE',
            'originalName': 'cg_4400.jpg',
            'mimeType': 'image/jpeg',
            'base64Data': '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAA==',
            'fileHashSha256': validHash,
          }),
        );

        await OfflineDatabase.instance.insertDraft(
          clientId: 'cli-drv-1',
          agentUserId: 'usr-agt-matoto',
          agentName: 'Sekou Conte',
          entityType: 'DRIVER',
          payloadJson: jsonEncode({
            'firstName': 'Ibrahima',
            'lastName': 'Bah',
            'nin': 'NIN-DRV-4400',
            'phoneNumber': '+224621440011',
            'drivingLicenseNumber': 'PC-4400',
          }),
        );

        await OfflineDatabase.instance.insertDraft(
          clientId: 'cli-own-1',
          agentUserId: 'usr-agt-matoto',
          agentName: 'Sekou Conte',
          entityType: 'OWNER',
          payloadJson: jsonEncode({
            'firstName': 'Elhadj',
            'lastName': 'Diallo',
            'nin': 'NIN-OWN-4400',
            'phoneNumber': '+224622440022',
            'ownerType': 'INDIVIDU',
          }),
        );

        // 2. Simulate app restart with one record stuck in SYNCING
        await OfflineDatabase.instance.markDraftSyncing('cli-own-1');
        await OfflineDatabase.simulateAppRestart();
        final recovered = await OfflineDatabase.instance.recoverInterruptedSyncingDrafts(
          agentUserId: 'usr-agt-matoto',
        );
        expect(recovered, 1);

        // Verify pending records survived restart and are sorted in OWNER -> DRIVER -> VEHICLE -> DOCUMENT order
        final pendingOrdered = await OfflineDatabase.instance.getPendingSyncDrafts(
          agentUserId: 'usr-agt-matoto',
        );
        expect(
          pendingOrdered.map((r) => r['entity_type']).toList(),
          equals(['OWNER', 'DRIVER', 'VEHICLE', 'DOCUMENT']),
        );

        // 3. Multi-agent isolation: Agent 2 on same tablet sees 0 records
        final agent2Drafts = await OfflineDatabase.instance.getAllDraftsForAgent(
          agentUserId: 'usr-agt-kaloum',
        );
        expect(agent2Drafts, isEmpty);

        // 4. Document integrity check: insert a draft with corrupted SHA-256 hash
        await OfflineDatabase.instance.insertDraft(
          clientId: 'cli-bad-doc',
          agentUserId: 'usr-agt-matoto',
          agentName: 'Sekou Conte',
          entityType: 'DOCUMENT',
          payloadJson: jsonEncode({
            'category': 'CNI_RECTO',
            'originalName': 'tampered.jpg',
            'mimeType': 'image/jpeg',
            'base64Data': '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAA==',
            'fileHashSha256': 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
          }),
        );

        bool networkDropSimulated = true;
        final pushedEntitiesOrder = <String>[];

        final mockClient = MockClient((http.Request req) async {
          if (req.url.path == '/api/v1/sync/push') {
            if (networkDropSimulated) {
              throw Exception('SocketException: Connection reset by peer');
            }
            await Future<void>.delayed(const Duration(milliseconds: 40));
            final body = jsonDecode(req.body) as Map<String, dynamic>;
            final items = body['items'] as List<dynamic>;
            final results = <Map<String, dynamic>>[];

            for (final rawItem in items) {
              final item = rawItem as Map<String, dynamic>;
              final type = item['entityType'] as String;
              final cid = item['clientGeneratedId'] as String;
              pushedEntitiesOrder.add(type);

              if (type == 'OWNER') {
                results.add({
                  'clientGeneratedId': cid,
                  'entityType': 'OWNER',
                  'status': 'SUCCESS',
                  'serverRecordId': 'pg-own-uuid-01',
                  'personId': 'pg-pers-own-01',
                });
              } else if (type == 'DRIVER') {
                results.add({
                  'clientGeneratedId': cid,
                  'entityType': 'DRIVER',
                  'status': 'SUCCESS',
                  'serverRecordId': 'pg-drv-uuid-01',
                  'personId': 'pg-pers-drv-01',
                });
              } else if (type == 'VEHICLE') {
                results.add({
                  'clientGeneratedId': cid,
                  'entityType': 'VEHICLE',
                  'status': 'SUCCESS',
                  'serverRecordId': 'pg-veh-uuid-01',
                });
              } else if (type == 'DOCUMENT') {
                results.add({
                  'clientGeneratedId': cid,
                  'entityType': 'DOCUMENT',
                  'status': 'SUCCESS',
                  'serverRecordId': 'pg-doc-uuid-01',
                });
              }
            }

            return http.Response(
              jsonEncode({
                'success': true,
                'data': {
                  'accepted': results.length,
                  'duplicates': 0,
                  'conflicts': 0,
                  'failed': 0,
                  'results': results,
                  'syncedAt': '2026-11-17T21:00:00.000Z',
                },
              }),
              200,
            );
          }
          return http.Response(jsonEncode({'status': 'healthy'}), 200);
        });

        final syncManager = SyncManager(
          backendBaseUrl: 'http://10.0.2.2:5000',
          authToken: 'test-token',
          agentUserId: 'usr-agt-matoto',
          deviceId: 'TABLET-01',
          httpClient: mockClient,
        );
        await syncManager.initialize();

        // 5. Interrupted upload: network drops during push -> records preserved as FAILED (NETWORK_INTERRUPTED)
        final interruptedSummary = await syncManager.synchronizePendingDrafts('TABLET-01');
        expect(interruptedSummary.networkFailed, isTrue);

        final afterDrop = await OfflineDatabase.instance.getAllDraftsForAgent(
          agentUserId: 'usr-agt-matoto',
        );
        expect(afterDrop.length, 5); // Zero records lost!
        final badDocRow = afterDrop.firstWhere((r) => r['client_id'] == 'cli-bad-doc');
        expect(badDocRow['sync_status'], 'FAILED');
        expect(badDocRow['error_code'], 'DOCUMENT_INTEGRITY_MISMATCH');

        // 6. Reconnection & Duplicate Sync Prevention:
        // Restore network and trigger concurrent sync calls -> mutex prevents duplicate HTTP POST
        networkDropSimulated = false;
        // Fix the corrupted document hash so we also verify retry after fixing integrity
        await OfflineDatabase.instance.updateDraftPayload(
          clientId: 'cli-bad-doc',
          agentUserId: 'usr-agt-matoto',
          payloadJson: jsonEncode({
            'category': 'CNI_RECTO',
            'originalName': 'valid_cni.jpg',
            'mimeType': 'image/jpeg',
            'base64Data': '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAA==',
            'fileHashSha256': validHash,
          }),
        );

        final callCountBefore = syncManager.httpPushCallCount;
        final results = await Future.wait([
          syncManager.onConnectivityChanged(
            isConnected: true,
            syncDeviceId: 'TABLET-01',
          ),
          syncManager.synchronizePendingDrafts('TABLET-01'),
        ]);

        // Only 1 actual HTTP push executed despite 2 simultaneous calls
        expect(syncManager.httpPushCallCount - callCountBefore, 1);
        expect(results[1]!.wasSkippedDuplicateCall, isTrue);
        expect(results[0]!.accepted, 5);

        // Verify strict dependency order sent to backend: OWNER -> DRIVER -> VEHICLE -> DOCUMENT -> DOCUMENT
        expect(
          pushedEntitiesOrder,
          equals(['OWNER', 'DRIVER', 'VEHICLE', 'DOCUMENT', 'DOCUMENT']),
        );

        // Verify PostgreSQL IDs were resolved and persisted locally
        expect(
          await OfflineDatabase.instance.getResolvedServerId(
            clientId: 'cli-own-1',
            agentUserId: 'usr-agt-matoto',
          ),
          'pg-own-uuid-01',
        );
        expect(
          await OfflineDatabase.instance.getResolvedServerId(
            clientId: 'cli-drv-1',
            agentUserId: 'usr-agt-matoto',
          ),
          'pg-drv-uuid-01',
        );
        expect(
          await OfflineDatabase.instance.getResolvedServerId(
            clientId: 'cli-veh-1',
            agentUserId: 'usr-agt-matoto',
          ),
          'pg-veh-uuid-01',
        );
      },
    );

    testWidgets(
      '8–10: Synchronization Management Screen (Pending, Synced, Conflict, Failed filters) & Interactive Conflict Resolution without overwriting server record',
      (WidgetTester tester) async {
        tester.view.physicalSize = const Size(1200, 2200);
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);

        // Pre-populate 1 PENDING record and 1 CONFLICT record for Agent Matoto
        await OfflineDatabase.instance.insertDraft(
          clientId: 'draft-conflict-veh',
          agentUserId: 'usr-agt-matoto',
          agentName: 'Sekou Conte',
          entityType: 'VEHICLE',
          payloadJson: jsonEncode({
            'ownerId': 'srv-own-001',
            'plateNumber': 'RC-DUP-999',
            'registrationCardNumber': 'CG-DUP-999',
            'chassisVin': 'VIN-DUP-999999',
            'vehicleType': 'TAXI_COLLECTIF',
            'make': 'Renault',
            'model': 'Logan',
          }),
        );
        await OfflineDatabase.instance.markDraftConflict(
          clientId: 'draft-conflict-veh',
          conflictCode: 'PLATE_ALREADY_REGISTERED',
          message: 'Conflit : la plaque "RC-DUP-999" est déjà attribuée à un autre véhicule.',
          serverRecordId: 'srv-existing-veh',
        );

        final store = InMemorySecureStore();
        final mockClient = MockClient((http.Request req) async {
          if (req.url.path == '/api/v1/auth/me') {
            return http.Response(
              jsonEncode({
                'success': true,
                'data': {
                  'user': {
                    'id': 'usr-agt-matoto',
                    'email': 'agent.matoto@aotuc.test',
                    'phoneNumber': '+224620000005',
                    'firstName': 'Sekou',
                    'lastName': 'Conte',
                    'roles': ['AGENT_TERRAIN'],
                    'permissions': ['drivers.create', 'owners.create', 'vehicles.create'],
                    'communeId': 'cm-matoto',
                    'commune': {'id': 'cm-matoto', 'code': 'MTT', 'name': 'Matoto'},
                  },
                },
              }),
              200,
            );
          }
          if (req.url.path == '/api/v1/sync/push') {
            final body = jsonDecode(req.body) as Map<String, dynamic>;
            final item = (body['items'] as List).first as Map<String, dynamic>;
            final payload = item['payload'] as Map<String, dynamic>;
            if (payload['plateNumber'] == 'RC-DUP-999') {
              return http.Response(
                jsonEncode({
                  'success': true,
                  'data': {
                    'accepted': 0,
                    'duplicates': 0,
                    'conflicts': 1,
                    'failed': 0,
                    'results': [
                      {
                        'clientGeneratedId': item['clientGeneratedId'],
                        'entityType': 'VEHICLE',
                        'status': 'CONFLICT',
                        'conflictCode': 'PLATE_ALREADY_REGISTERED',
                        'message': 'Conflit : la plaque "RC-DUP-999" existe déjà.',
                      }
                    ],
                  },
                }),
                200,
              );
            }
            return http.Response(
              jsonEncode({
                'success': true,
                'data': {
                  'accepted': 1,
                  'duplicates': 0,
                  'conflicts': 0,
                  'failed': 0,
                  'syncedAt': '2026-11-17T21:30:00.000Z',
                  'results': [
                    {
                      'clientGeneratedId': item['clientGeneratedId'],
                      'entityType': 'VEHICLE',
                      'status': 'SUCCESS',
                      'serverRecordId': 'pg-veh-resolved-001',
                    }
                  ],
                },
              }),
              200,
            );
          }
          return http.Response(jsonEncode({'success': true, 'data': {'items': []}}), 200);
        });

        await store.write(
          'aotuc_secure_access_token',
          _buildTestJwt(sub: 'usr-agt-matoto', expSecondsFromNow: 900),
        );
        await store.write(
          'aotuc_secure_refresh_token',
          _buildTestJwt(sub: 'usr-agt-matoto', expSecondsFromNow: 86400),
        );
        await store.write(
          'aotuc_secure_user_profile',
          const MobileUser(
            id: 'usr-agt-matoto',
            phoneNumber: '+224620000005',
            firstName: 'Sekou',
            lastName: 'Conte',
            roles: ['AGENT_TERRAIN'],
            permissions: ['drivers.create', 'owners.create', 'vehicles.create'],
            communeId: 'cm-matoto',
            commune: MobileCommune(id: 'cm-matoto', code: 'MTT', name: 'Matoto'),
          ).toRawJson(),
        );

        final authService = AuthService(credentialStore: store, httpClient: mockClient);
        await authService.restoreSession();

        await tester.pumpWidget(
          AotucMobileApp(authService: authService, autoRestoreSession: false),
        );
        await tester.pumpAndSettle();

        // Navigate to dedicated Synchronization Management Screen
        await tester.tap(find.text('Synchronisation'));
        await tester.pumpAndSettle();

        expect(find.text('CONSOLE DE SYNCHRONISATION HORS-LIGNE'), findsOneWidget);
        expect(find.text('CONFLIT DÉTECTÉ'), findsOneWidget);
        expect(find.textContaining('RC-DUP-999'), findsWidgets);

        // Filter by Conflits
        await tester.tap(find.byKey(const Key('filter_sync_CONFLICT')));
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('sync_card_draft-conflict-veh')), findsOneWidget);

        // Open Conflict Resolution modal ("Corriger & Réessayer"), fix the mistyped plate, and sync
        await tester.tap(find.byKey(const Key('resolve_conflict_draft-conflict-veh')));
        await tester.pumpAndSettle();

        await tester.enterText(
          find.byKey(const Key('conflict_edit_plate_input')),
          'RC-7788-NEW',
        );
        await tester.tap(find.byKey(const Key('confirm_conflict_retry_button')));
        await tester.pumpAndSettle();

        // Switch to Synchronisés filter and verify the record is now SYNCED with PostgreSQL ID
        await tester.tap(find.byKey(const Key('filter_sync_SYNCED')));
        await tester.pumpAndSettle();

        expect(find.byKey(const Key('sync_card_draft-conflict-veh')), findsOneWidget);
        expect(find.text('SYNCHRONISÉ'), findsOneWidget);
        expect(find.textContaining('pg-veh-resolved-001'), findsOneWidget);
      },
    );
  });
}
