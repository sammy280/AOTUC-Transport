import 'dart:convert';
import 'dart:math';
import 'package:cryptography/cryptography.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Provides AES-256-GCM authenticated encryption for offline personal records in SQLite.
/// Uses hardware-backed FlutterSecureStorage for master key persistence and binds
/// each encrypted record to its owning [agentUserId] via Additional Authenticated Data (AAD).
class LocalCryptoService {
  static const String _masterKeyStorageKey = 'aotuc_local_aes256_master_key';

  static final AesGcm _cipher = AesGcm.with256bits();

  static const FlutterSecureStorage _secureStorage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  static SecretKey? _cachedSecretKey;

  /// Allows injecting an in-memory key during unit tests where platform channels are mocked.
  static void setTestMasterKey(List<int> keyBytes) {
    _cachedSecretKey = SecretKey(keyBytes);
  }

  static Future<SecretKey> _getOrCreateMasterKey() async {
    if (_cachedSecretKey != null) return _cachedSecretKey!;

    final existingBase64 = await _secureStorage.read(key: _masterKeyStorageKey);
    if (existingBase64 != null && existingBase64.isNotEmpty) {
      final bytes = base64Decode(existingBase64);
      if (bytes.length == 32) {
        _cachedSecretKey = SecretKey(bytes);
        return _cachedSecretKey!;
      }
    }

    final random = Random.secure();
    final keyBytes = List<int>.generate(32, (_) => random.nextInt(256));
    await _secureStorage.write(
      key: _masterKeyStorageKey,
      value: base64Encode(keyBytes),
    );
    _cachedSecretKey = SecretKey(keyBytes);
    return _cachedSecretKey!;
  }

  /// Encrypts [plainJson] using AES-256-GCM bound to [agentUserId] as AAD.
  static Future<String> encryptPayload(
    String plainJson, {
    required String agentUserId,
  }) async {
    final secretKey = await _getOrCreateMasterKey();
    final nonce = _cipher.newNonce();
    final secretBox = await _cipher.encrypt(
      utf8.encode(plainJson),
      secretKey: secretKey,
      nonce: nonce,
      aad: utf8.encode(agentUserId),
    );

    final envelope = {
      'v': 1,
      'alg': 'AES-256-GCM',
      'n': base64Encode(secretBox.nonce),
      'c': base64Encode(secretBox.cipherText),
      't': base64Encode(secretBox.mac.bytes),
    };
    return jsonEncode(envelope);
  }

  /// Decrypts an encrypted envelope bound to [agentUserId].
  /// Throws [SecretBoxAuthenticationError] if another agent attempts to decrypt it.
  static Future<String> decryptPayload(
    String storedValue, {
    required String agentUserId,
  }) async {
    final decoded = jsonDecode(storedValue);
    if (decoded is! Map<String, dynamic> || decoded['alg'] != 'AES-256-GCM') {
      // Legacy unencrypted JSON fallback
      return storedValue;
    }

    final secretKey = await _getOrCreateMasterKey();
    final secretBox = SecretBox(
      base64Decode(decoded['c'] as String),
      nonce: base64Decode(decoded['n'] as String),
      mac: Mac(base64Decode(decoded['t'] as String)),
    );

    final clearBytes = await _cipher.decrypt(
      secretBox,
      secretKey: secretKey,
      aad: utf8.encode(agentUserId),
    );
    return utf8.decode(clearBytes);
  }
}
