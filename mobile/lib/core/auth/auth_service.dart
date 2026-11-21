import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:uuid/uuid.dart';
import 'auth_models.dart';

/// Abstraction over secure key-value storage so hardware-backed FlutterSecureStorage
/// is used in production while tests can inject an isolated secure store.
abstract class SecureCredentialStore {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

class FlutterHardwareCredentialStore implements SecureCredentialStore {
  static const FlutterSecureStorage _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  const FlutterHardwareCredentialStore();

  @override
  Future<String?> read(String key) => _storage.read(key: key);

  @override
  Future<void> write(String key, String value) =>
      _storage.write(key: key, value: value);

  @override
  Future<void> delete(String key) => _storage.delete(key: key);
}

class AuthService extends ChangeNotifier {
  static const String _keyAccessToken = 'aotuc_secure_access_token';
  static const String _keyRefreshToken = 'aotuc_secure_refresh_token';
  static const String _keyUserProfile = 'aotuc_secure_user_profile';
  static const String _keyDeviceId = 'aotuc_secure_device_id';
  static const String _keyBackendUrl = 'aotuc_secure_backend_url';

  final SecureCredentialStore _store;
  http.Client _httpClient;
  String _backendBaseUrl;

  AuthStatus _status = AuthStatus.unauthenticated;
  MobileUser? _currentUser;
  String? _accessToken;
  String? _refreshToken;
  String? _deviceId;
  String? _errorMessage;

  AuthService({
    SecureCredentialStore? credentialStore,
    http.Client? httpClient,
    String backendBaseUrl = 'http://10.0.2.2:5000',
  })  : _store = credentialStore ?? const FlutterHardwareCredentialStore(),
        _httpClient = httpClient ?? http.Client(),
        _backendBaseUrl = backendBaseUrl;

  AuthStatus get status => _status;
  http.Client get httpClient => _httpClient;
  MobileUser? get currentUser => _currentUser;
  String? get accessToken => _accessToken;
  String? get refreshToken => _refreshToken;
  String? get deviceId => _deviceId;
  String? get errorMessage => _errorMessage;
  String get backendBaseUrl => _backendBaseUrl;
  bool get isAuthenticated =>
      _status == AuthStatus.authenticated && _currentUser != null && _accessToken != null;

  void setHttpClient(http.Client client) {
    _httpClient = client;
  }

  Future<void> updateBackendBaseUrl(String newUrl) async {
    final cleaned = newUrl.trim().replaceAll(RegExp(r'/+$'), '');
    if (cleaned.isEmpty) return;
    _backendBaseUrl = cleaned;
    await _store.write(_keyBackendUrl, cleaned);
    notifyListeners();
  }

  /// Retrieves or generates a persistent unique device identifier stored in secure storage.
  Future<String> getOrCreateDeviceId() async {
    if (_deviceId != null && _deviceId!.isNotEmpty) return _deviceId!;
    final existing = await _store.read(_keyDeviceId);
    if (existing != null && existing.isNotEmpty) {
      _deviceId = existing;
      return existing;
    }
    final generated = 'AOTUC-MOB-${const Uuid().v4().substring(0, 8).toUpperCase()}';
    await _store.write(_keyDeviceId, generated);
    _deviceId = generated;
    return generated;
  }

  /// Checks whether a JWT token is expired (with a 15-second safety buffer).
  static bool isJwtExpired(String token) {
    try {
      final parts = token.split('.');
      if (parts.length != 3) return true;
      final normalized = base64Url.normalize(parts[1]);
      final payloadMap =
          jsonDecode(utf8.decode(base64Url.decode(normalized))) as Map<String, dynamic>;
      final exp = payloadMap['exp'];
      if (exp is int) {
        final expiry = DateTime.fromMillisecondsSinceEpoch(exp * 1000);
        return DateTime.now().isAfter(expiry.subtract(const Duration(seconds: 15)));
      }
      return false;
    } catch (_) {
      return true;
    }
  }

  /// Restores an existing session on app startup from FlutterSecureStorage.
  Future<void> restoreSession() async {
    _status = AuthStatus.authenticating;
    _errorMessage = null;
    notifyListeners();

    try {
      final savedUrl = await _store.read(_keyBackendUrl);
      if (savedUrl != null && savedUrl.isNotEmpty) {
        _backendBaseUrl = savedUrl;
      }

      await getOrCreateDeviceId();

      final storedAccess = await _store.read(_keyAccessToken);
      final storedRefresh = await _store.read(_keyRefreshToken);
      final storedProfile = await _store.read(_keyUserProfile);

      if (storedAccess == null || storedProfile == null) {
        _status = AuthStatus.unauthenticated;
        _currentUser = null;
        notifyListeners();
        return;
      }

      _accessToken = storedAccess;
      _refreshToken = storedRefresh;
      _currentUser = MobileUser.fromRawJson(storedProfile);

      // If access token is expired, attempt refresh first
      if (isJwtExpired(storedAccess)) {
        if (storedRefresh != null && !isJwtExpired(storedRefresh)) {
          final refreshed = await tryRefreshToken();
          if (!refreshed) {
            return;
          }
        } else {
          await _clearCredentials();
          _status = AuthStatus.sessionExpired;
          _errorMessage = 'Votre session a expiré. Veuillez vous reconnecter.';
          notifyListeners();
          return;
        }
      }

      // Verify live account & device status against GET /api/v1/auth/me when reachable
      try {
        final uri = Uri.parse('$_backendBaseUrl/api/v1/auth/me');
        final response = await _httpClient.get(
          uri,
          headers: {
            'Authorization': 'Bearer $_accessToken',
            'X-Device-Id': _deviceId ?? '',
            'Content-Type': 'application/json',
          },
        ).timeout(const Duration(seconds: 6));

        if (response.statusCode == 200) {
          final body = jsonDecode(response.body) as Map<String, dynamic>;
          final userJson = body['data']?['user'] as Map<String, dynamic>?;
          if (userJson != null) {
            _currentUser = MobileUser.fromJson(userJson);
            await _store.write(_keyUserProfile, _currentUser!.toRawJson());
          }
          _status = AuthStatus.authenticated;
          notifyListeners();
          return;
        } else if (response.statusCode == 401 || response.statusCode == 403) {
          await _handleAuthRejectionResponse(response);
          return;
        }
      } catch (_) {
        // Offline mode: if token is not expired locally, allow offline session continuity
        if (!isJwtExpired(_accessToken!)) {
          _status = AuthStatus.authenticated;
          notifyListeners();
          return;
        }
      }

      _status = AuthStatus.authenticated;
      notifyListeners();
    } catch (_) {
      await _clearCredentials();
      _status = AuthStatus.unauthenticated;
      notifyListeners();
    }
  }

  /// Authenticates an agent using their AOTUC email or Guinean phone number and password.
  Future<bool> login({
    required String identifier,
    required String password,
  }) async {
    _status = AuthStatus.authenticating;
    _errorMessage = null;
    notifyListeners();

    final cleanId = identifier.trim();
    final cleanPassword = password;

    if (cleanId.isEmpty || cleanPassword.isEmpty) {
      _status = AuthStatus.unauthenticated;
      _errorMessage = 'Veuillez saisir votre identifiant (email ou téléphone) et votre mot de passe.';
      notifyListeners();
      return false;
    }

    try {
      final devId = await getOrCreateDeviceId();
      final uri = Uri.parse('$_backendBaseUrl/api/v1/auth/login');

      final response = await _httpClient
          .post(
            uri,
            headers: {
              'Content-Type': 'application/json',
              'X-Device-Id': devId,
            },
            body: jsonEncode({
              'identifier': cleanId,
              'password': cleanPassword,
              'deviceId': devId,
              'deviceName': 'Terminal AOTUC Mobile',
            }),
          )
          .timeout(const Duration(seconds: 10));

      final body = jsonDecode(response.body) as Map<String, dynamic>;

      if (response.statusCode == 200 && body['success'] == true) {
        final data = body['data'] as Map<String, dynamic>;
        final userMap = data['user'] as Map<String, dynamic>;
        final access = data['accessToken'] as String;
        final refresh = data['refreshToken'] as String?;

        final user = MobileUser.fromJson(userMap);

        await _store.write(_keyAccessToken, access);
        if (refresh != null) {
          await _store.write(_keyRefreshToken, refresh);
        }
        await _store.write(_keyUserProfile, user.toRawJson());

        _accessToken = access;
        _refreshToken = refresh;
        _currentUser = user;
        _status = AuthStatus.authenticated;
        _errorMessage = null;
        notifyListeners();
        return true;
      }

      final code = body['code']?.toString() ?? '';
      final serverMessage = body['message']?.toString() ?? 'Authentification refusée.';

      if (code == 'ACCOUNT_INACTIVE' || code == 'ACCOUNT_DEACTIVATED') {
        await _clearCredentials();
        _status = AuthStatus.accountDeactivated;
        _errorMessage = serverMessage;
        notifyListeners();
        return false;
      }

      if (code == 'DEVICE_REVOKED') {
        await _clearCredentials();
        _status = AuthStatus.deviceRevoked;
        _errorMessage = serverMessage;
        notifyListeners();
        return false;
      }

      _status = AuthStatus.unauthenticated;
      _errorMessage = serverMessage;
      notifyListeners();
      return false;
    } catch (err) {
      _status = AuthStatus.unauthenticated;
      _errorMessage =
          'Impossible de joindre le serveur AOTUC ($_backendBaseUrl). Vérifiez votre connexion réseau.';
      notifyListeners();
      return false;
    }
  }

  /// Rotates the refresh token via `POST /api/v1/auth/refresh`.
  Future<bool> tryRefreshToken() async {
    final refresh = _refreshToken ?? await _store.read(_keyRefreshToken);
    if (refresh == null || refresh.isEmpty) {
      await _clearCredentials();
      _status = AuthStatus.sessionExpired;
      _errorMessage = 'Votre session a expiré. Veuillez vous reconnecter.';
      notifyListeners();
      return false;
    }

    try {
      final devId = await getOrCreateDeviceId();
      final uri = Uri.parse('$_backendBaseUrl/api/v1/auth/refresh');
      final response = await _httpClient
          .post(
            uri,
            headers: {
              'Content-Type': 'application/json',
              'X-Device-Id': devId,
            },
            body: jsonEncode({
              'refreshToken': refresh,
              'deviceId': devId,
            }),
          )
          .timeout(const Duration(seconds: 8));

      final body = jsonDecode(response.body) as Map<String, dynamic>;

      if (response.statusCode == 200 && body['success'] == true) {
        final data = body['data'] as Map<String, dynamic>;
        final newAccess = data['accessToken'] as String;
        final newRefresh = data['refreshToken'] as String?;

        _accessToken = newAccess;
        await _store.write(_keyAccessToken, newAccess);
        if (newRefresh != null) {
          _refreshToken = newRefresh;
          await _store.write(_keyRefreshToken, newRefresh);
        }
        _status = AuthStatus.authenticated;
        notifyListeners();
        return true;
      }

      await _handleAuthRejectionResponse(response);
      return false;
    } catch (_) {
      return false;
    }
  }

  /// Inspects a 401/403 HTTP response and transitions to the appropriate security state.
  Future<void> handleHttpStatusRejection(http.Response response) async {
    if (response.statusCode == 401 || response.statusCode == 403) {
      await _handleAuthRejectionResponse(response);
    }
  }

  Future<void> _handleAuthRejectionResponse(http.Response response) async {
    String code = '';
    String message = 'Session invalide ou expirée.';
    try {
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      code = body['code']?.toString() ?? '';
      message = body['message']?.toString() ?? message;
    } catch (_) {}

    if (code == 'TOKEN_EXPIRED') {
      final refreshed = await tryRefreshToken();
      if (refreshed) return;
      await _clearCredentials();
      _status = AuthStatus.sessionExpired;
      _errorMessage = 'Votre session a expiré. Veuillez vous reconnecter.';
      notifyListeners();
      return;
    }

    if (code == 'ACCOUNT_DEACTIVATED' || code == 'ACCOUNT_INACTIVE') {
      await _clearCredentials();
      _status = AuthStatus.accountDeactivated;
      _errorMessage = 'Ce compte utilisateur a été désactivé par un administrateur.';
      notifyListeners();
      return;
    }

    if (code == 'DEVICE_REVOKED') {
      await _clearCredentials();
      _status = AuthStatus.deviceRevoked;
      _errorMessage = 'L accès de cet appareil mobile a été révoqué par un administrateur AOTUC.';
      notifyListeners();
      return;
    }

    if (response.statusCode == 401) {
      await _clearCredentials();
      _status = AuthStatus.sessionExpired;
      _errorMessage = message;
      notifyListeners();
    }
  }

  /// Logs out the current agent, revoking the server refresh token and wiping
  /// stored credentials from FlutterSecureStorage while preserving unsynced offline drafts
  /// bound to the agent's userId in SQLite.
  Future<void> logout() async {
    final tokenToRevoke = _refreshToken;
    final accessToUse = _accessToken;

    await _clearCredentials();
    _status = AuthStatus.unauthenticated;
    _errorMessage = null;
    notifyListeners();

    if (tokenToRevoke != null) {
      try {
        final uri = Uri.parse('$_backendBaseUrl/api/v1/auth/logout');
        await _httpClient
            .post(
              uri,
              headers: {
                'Content-Type': 'application/json',
                if (accessToUse != null) 'Authorization': 'Bearer $accessToUse',
              },
              body: jsonEncode({'refreshToken': tokenToRevoke}),
            )
            .timeout(const Duration(seconds: 4));
      } catch (_) {
        // Offline logout still succeeds locally
      }
    }
  }

  Future<void> _clearCredentials() async {
    _accessToken = null;
    _refreshToken = null;
    _currentUser = null;
    await _store.delete(_keyAccessToken);
    await _store.delete(_keyRefreshToken);
    await _store.delete(_keyUserProfile);
  }
}
