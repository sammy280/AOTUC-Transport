import 'package:flutter/material.dart';
import 'core/auth/auth_service.dart';
import 'features/auth/views/login_view.dart';
import 'features/enrolment/views/enrolment_form_view.dart';
import 'features/inspector/views/qr_scanner_view.dart';
import 'features/sync/views/sync_management_view.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const AotucMobileApp());
}

class AotucMobileApp extends StatefulWidget {
  final AuthService? authService;
  final bool autoRestoreSession;

  const AotucMobileApp({
    super.key,
    this.authService,
    this.autoRestoreSession = true,
  });

  @override
  State<AotucMobileApp> createState() => _AotucMobileAppState();
}

class _AotucMobileAppState extends State<AotucMobileApp> {
  late final AuthService _authService;

  @override
  void initState() {
    super.initState();
    _authService = widget.authService ?? AuthService();
    if (widget.autoRestoreSession) {
      _authService.restoreSession();
    }
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'AOTUC Mobile — Guinée',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF0B1E36),
          primary: const Color(0xFF0B1E36),
          secondary: const Color(0xFFCE1126),
        ),
        useMaterial3: true,
        fontFamily: 'Roboto',
      ),
      home: ListenableBuilder(
        listenable: _authService,
        builder: (context, _) {
          if (_authService.isAuthenticated && _authService.currentUser != null) {
            return MainNavigationScreen(
              key: ValueKey('session_${_authService.currentUser!.id}'),
              authService: _authService,
            );
          }
          return LoginView(authService: _authService);
        },
      ),
    );
  }
}

class MainNavigationScreen extends StatefulWidget {
  final AuthService authService;

  const MainNavigationScreen({
    super.key,
    required this.authService,
  });

  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    final user = widget.authService.currentUser!;
    final canEnrol = user.canRegisterFieldRecords;

    final screens = <Widget>[
      const QrScannerView(),
      if (canEnrol) EnrolmentFormView(authService: widget.authService),
      if (canEnrol) SyncManagementView(authService: widget.authService),
      _AgentProfileView(authService: widget.authService),
    ];

    final destinations = <NavigationDestination>[
      const NavigationDestination(
        icon: Icon(Icons.qr_code_scanner),
        label: 'Contrôle Routier',
      ),
      if (canEnrol)
        const NavigationDestination(
          icon: Icon(Icons.person_add_alt_1),
          label: 'Enrôlement Terrain',
        ),
      if (canEnrol)
        const NavigationDestination(
          icon: Icon(Icons.cloud_sync),
          label: 'Synchronisation',
        ),
      const NavigationDestination(
        icon: Icon(Icons.badge_outlined),
        label: 'Profil & Session',
      ),
    ];

    final safeIndex = _currentIndex >= screens.length ? 0 : _currentIndex;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF0B1E36),
        elevation: 2,
        title: Row(
          children: [
            Image.asset(
              'assets/logo-guinee.png',
              width: 32,
              height: 32,
              errorBuilder: (_, __, ___) =>
                  const Icon(Icons.shield, color: Color(0xFFFCD116)),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    user.fullName,
                    key: const Key('header_user_fullname'),
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Text(
                    '${user.primaryRoleLabel} • ${user.assignedCommuneName ?? (user.union?.code ?? "National")}',
                    key: const Key('header_user_scope'),
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Color(0xFFFCD116),
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            key: const Key('logout_button'),
            onPressed: () async {
              await widget.authService.logout();
            },
            icon: const Icon(Icons.logout, color: Colors.white, size: 20),
            tooltip: 'Se déconnecter',
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(3.0),
          child: Row(
            children: [
              Expanded(child: Container(color: const Color(0xFFCE1126), height: 3)),
              Expanded(child: Container(color: const Color(0xFFFCD116), height: 3)),
              Expanded(child: Container(color: const Color(0xFF009460), height: 3)),
            ],
          ),
        ),
      ),
      body: screens[safeIndex],
      bottomNavigationBar: NavigationBar(
        selectedIndex: safeIndex,
        onDestinationSelected: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
        destinations: destinations,
      ),
    );
  }
}

class _AgentProfileView extends StatelessWidget {
  final AuthService authService;

  const _AgentProfileView({required this.authService});

  @override
  Widget build(BuildContext context) {
    final user = authService.currentUser!;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Card(
        elevation: 1,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                user.fullName,
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 4),
              Text(
                user.jobTitle ?? user.primaryRoleLabel,
                style: const TextStyle(fontSize: 12, color: Colors.black54),
              ),
              const Divider(height: 24),
              _buildRow('Rôle RBAC', user.primaryRole),
              _buildRow('Téléphone', user.phoneNumber),
              if (user.email != null) _buildRow('Email', user.email!),
              _buildRow(
                'Commune Assignée',
                user.assignedCommuneName ?? 'Direction Générale (Toutes Communes)',
              ),
              if (user.union != null)
                _buildRow('Organisation / Syndicat', '${user.union!.code} — ${user.union!.name}'),
              _buildRow('ID Terminal', authService.deviceId ?? '—'),
              const SizedBox(height: 20),
              OutlinedButton.icon(
                key: const Key('profile_logout_button'),
                onPressed: () => authService.logout(),
                icon: const Icon(Icons.logout, color: Color(0xFFDC2626)),
                label: const Text(
                  'Déconnexion Sécurisée',
                  style: TextStyle(
                    color: Color(0xFFDC2626),
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 12, color: Colors.black54)),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );
  }
}
