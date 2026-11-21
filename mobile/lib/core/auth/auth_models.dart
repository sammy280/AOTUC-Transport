import 'dart:convert';

enum AuthStatus {
  unauthenticated,
  authenticating,
  authenticated,
  sessionExpired,
  accountDeactivated,
  deviceRevoked,
}

class MobileCommune {
  final String id;
  final String code;
  final String name;

  const MobileCommune({
    required this.id,
    required this.code,
    required this.name,
  });

  factory MobileCommune.fromJson(Map<String, dynamic> json) {
    return MobileCommune(
      id: (json['id'] ?? '').toString(),
      code: (json['code'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'code': code,
        'name': name,
      };
}

class MobileUnion {
  final String id;
  final String code;
  final String name;

  const MobileUnion({
    required this.id,
    required this.code,
    required this.name,
  });

  factory MobileUnion.fromJson(Map<String, dynamic> json) {
    return MobileUnion(
      id: (json['id'] ?? '').toString(),
      code: (json['code'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'code': code,
        'name': name,
      };
}

class MobileUser {
  final String id;
  final String? email;
  final String phoneNumber;
  final String firstName;
  final String lastName;
  final String? jobTitle;
  final List<String> roles;
  final List<String> permissions;
  final String? communeId;
  final MobileCommune? commune;
  final String? unionId;
  final MobileUnion? union;

  const MobileUser({
    required this.id,
    this.email,
    required this.phoneNumber,
    required this.firstName,
    required this.lastName,
    this.jobTitle,
    required this.roles,
    required this.permissions,
    this.communeId,
    this.commune,
    this.unionId,
    this.union,
  });

  String get fullName => '$firstName $lastName'.trim();

  String get primaryRole => roles.isNotEmpty ? roles.first : 'AGENT_TERRAIN';

  String get primaryRoleLabel {
    switch (primaryRole) {
      case 'SUPER_ADMIN':
        return 'Super Administrateur DSI';
      case 'DIRECTOR':
        return 'Directeur Général AOTUC';
      case 'CHEF_SERVICE':
        return 'Chef de Service Territorial';
      case 'AGENT_TERRAIN':
        return 'Agent de Recensement Terrain';
      case 'SYNDICAT':
        return 'Représentant Syndical';
      case 'DISTRIBUTEUR':
        return 'Distributeur Billetterie';
      default:
        return primaryRole;
    }
  }

  /// Whether this user has authority to register drivers, owners, and vehicles in the field.
  bool get canRegisterFieldRecords {
    if (permissions.isNotEmpty) {
      return permissions.contains('drivers.create');
    }
    return roles.contains('AGENT_TERRAIN') || roles.contains('CHEF_SERVICE');
  }

  /// Whether this user can inspect and verify QR badges and transport licences.
  bool get canVerifyCredentials {
    if (permissions.isNotEmpty) {
      return permissions.contains('credentials.verify') ||
          permissions.contains('credentials.read') ||
          permissions.contains('system.health.read');
    }
    return roles.contains('AGENT_TERRAIN') ||
        roles.contains('CHEF_SERVICE') ||
        roles.contains('DIRECTOR') ||
        roles.contains('SYNDICAT') ||
        roles.contains('SUPER_ADMIN');
  }

  /// Whether this user is restricted to a single assigned commune.
  bool get isCommuneRestricted {
    if (roles.contains('DIRECTOR') || roles.contains('SUPER_ADMIN')) {
      return false;
    }
    return (communeId != null && communeId!.isNotEmpty) || commune != null;
  }

  String? get assignedCommuneName => commune?.name;

  factory MobileUser.fromJson(Map<String, dynamic> json) {
    final rawRoles = (json['roles'] as List<dynamic>?)
            ?.map((e) => e.toString())
            .toList() ??
        <String>[];
    final rawPerms = (json['permissions'] as List<dynamic>?)
            ?.map((e) => e.toString())
            .toList() ??
        <String>[];

    final communeMap = json['commune'] is Map<String, dynamic>
        ? json['commune'] as Map<String, dynamic>
        : null;
    final unionMap = json['union'] is Map<String, dynamic>
        ? json['union'] as Map<String, dynamic>
        : null;

    return MobileUser(
      id: (json['id'] ?? '').toString(),
      email: json['email']?.toString(),
      phoneNumber: (json['phoneNumber'] ?? '').toString(),
      firstName: (json['firstName'] ?? 'Agent').toString(),
      lastName: (json['lastName'] ?? 'AOTUC').toString(),
      jobTitle: json['jobTitle']?.toString(),
      roles: rawRoles,
      permissions: rawPerms,
      communeId: (json['communeId'] ?? communeMap?['id'])?.toString(),
      commune: communeMap != null ? MobileCommune.fromJson(communeMap) : null,
      unionId: (json['unionId'] ?? unionMap?['id'])?.toString(),
      union: unionMap != null ? MobileUnion.fromJson(unionMap) : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'phoneNumber': phoneNumber,
        'firstName': firstName,
        'lastName': lastName,
        'jobTitle': jobTitle,
        'roles': roles,
        'permissions': permissions,
        'communeId': communeId,
        'commune': commune?.toJson(),
        'unionId': unionId,
        'union': union?.toJson(),
      };

  String toRawJson() => jsonEncode(toJson());

  factory MobileUser.fromRawJson(String source) =>
      MobileUser.fromJson(jsonDecode(source) as Map<String, dynamic>);
}
