import 'package:flutter/material.dart';
import 'features/inspector/views/qr_scanner_view.dart';
import 'features/enrolment/views/enrolment_form_view.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const AotucMobileApp());
}

class AotucMobileApp extends StatelessWidget {
  const AotucMobileApp({super.key});

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
      home: const MainNavigationScreen(),
    );
  }
}

class MainNavigationScreen extends StatefulWidget {
  const MainNavigationScreen({super.key});

  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen> {
  int _currentIndex = 0;

  final List<Widget> _screens = [
    const QrScannerView(),
    const EnrolmentFormView(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF0B1E36),
        elevation: 2,
        title: Row(
          children: [
            Image.asset(
              'assets/logo-guinee.png',
              width: 34,
              height: 34,
              errorBuilder: (_, __, ___) => const Icon(Icons.shield, color: Color(0xFFFCD116)),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                Text(
                  'AOTUC GUINÉE',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.5,
                  ),
                ),
                Text(
                  'MINISTÈRE DES TRANSPORTS',
                  style: TextStyle(
                    color: Color(0xFFFCD116),
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 12),
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: Colors.white.withValues(alpha: 0.2),
                width: 1.0,
              ),
            ),
            child: Row(
              children: const [
                Icon(Icons.wifi_off, size: 14, color: Color(0xFFFCD116)),
                SizedBox(width: 4),
                Text(
                  'HORS-LIGNE',
                  style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                ),
              ],
            ),
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
      body: _screens[_currentIndex],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.qr_code_scanner),
            label: 'Contrôle Routier',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_add_alt_1),
            label: 'Enrôlement Terrain',
          ),
        ],
      ),
    );
  }
}
