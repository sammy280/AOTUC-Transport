import 'package:flutter/material.dart';
import '../../../core/auth/auth_models.dart';
import '../../../core/auth/auth_service.dart';

class LoginView extends StatefulWidget {
  final AuthService authService;

  const LoginView({
    super.key,
    required this.authService,
  });

  @override
  State<LoginView> createState() => _LoginViewState();
}

class _LoginViewState extends State<LoginView> {
  final _formKey = GlobalKey<FormState>();
  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  String? _deviceId;

  @override
  void initState() {
    super.initState();
    _loadDeviceId();
  }

  Future<void> _loadDeviceId() async {
    final id = await widget.authService.getOrCreateDeviceId();
    if (mounted) {
      setState(() {
        _deviceId = id;
      });
    }
  }

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();

    await widget.authService.login(
      identifier: _identifierController.text.trim(),
      password: _passwordController.text,
    );
  }

  void _showServerConfigDialog() {
    final urlController = TextEditingController(
      text: widget.authService.backendBaseUrl,
    );
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text(
          'Serveur API AOTUC',
          style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
        ),
        content: TextField(
          controller: urlController,
          decoration: const InputDecoration(
            labelText: 'URL du serveur backend',
            hintText: 'http://10.0.2.2:5000',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Annuler'),
          ),
          ElevatedButton(
            onPressed: () async {
              await widget.authService.updateBackendBaseUrl(urlController.text);
              if (ctx.mounted) Navigator.of(ctx).pop();
            },
            child: const Text('Enregistrer'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.authService,
      builder: (context, _) {
        final status = widget.authService.status;
        final isAuthenticating = status == AuthStatus.authenticating;
        final errorMessage = widget.authService.errorMessage;

        return Scaffold(
          backgroundColor: const Color(0xFFF1F5F9),
          appBar: AppBar(
            backgroundColor: const Color(0xFF0B1E36),
            elevation: 0,
            title: Row(
              children: [
                Image.asset(
                  'assets/logo-guinee.png',
                  width: 30,
                  height: 30,
                  errorBuilder: (_, __, ___) =>
                      const Icon(Icons.shield, color: Color(0xFFFCD116)),
                ),
                const SizedBox(width: 10),
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'AOTUC GUINÉE',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Text(
                      'PORTAIL AGENTS & CONTRÔLEURS',
                      style: TextStyle(
                        color: Color(0xFFFCD116),
                        fontSize: 9,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ],
            ),
            actions: [
              IconButton(
                key: const Key('server_config_button'),
                onPressed: _showServerConfigDialog,
                icon: const Icon(Icons.settings_ethernet, color: Colors.white70, size: 20),
                tooltip: 'Configurer le serveur API',
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
          body: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20.0),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Card(
                  elevation: 3,
                  color: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                    side: const BorderSide(color: Color(0xFFE2E8F0)),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(24.0),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Icon(
                            Icons.verified_user_rounded,
                            size: 44,
                            color: Color(0xFF0B1E36),
                          ),
                          const SizedBox(height: 12),
                          const Text(
                            'Authentification Officielle AOTUC',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF0B1E36),
                            ),
                          ),
                          const SizedBox(height: 4),
                          const Text(
                            'Connectez-vous avec votre compte professionnel assermenté',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.black54,
                            ),
                          ),
                          const SizedBox(height: 20),

                          // Status & Error Banners
                          if (status == AuthStatus.accountDeactivated)
                            _buildStatusBanner(
                              key: const Key('deactivated_banner'),
                              icon: Icons.block,
                              title: 'COMPTE DÉSACTIVÉ',
                              message: errorMessage ??
                                  'Ce compte utilisateur a été désactivé par un administrateur.',
                              backgroundColor: const Color(0xFFFEF2F2),
                              borderColor: const Color(0xFFDC2626),
                              textColor: const Color(0xFF991B1B),
                            )
                          else if (status == AuthStatus.deviceRevoked)
                            _buildStatusBanner(
                              key: const Key('device_revoked_banner'),
                              icon: Icons.phonelink_erase,
                              title: 'TERMINAL RÉVOQUÉ',
                              message: errorMessage ??
                                  'Cet appareil mobile a été révoqué par la Direction AOTUC.',
                              backgroundColor: const Color(0xFFFEF2F2),
                              borderColor: const Color(0xFFDC2626),
                              textColor: const Color(0xFF991B1B),
                            )
                          else if (status == AuthStatus.sessionExpired)
                            _buildStatusBanner(
                              key: const Key('session_expired_banner'),
                              icon: Icons.timer_off_outlined,
                              title: 'SESSION EXPIRÉE',
                              message: errorMessage ??
                                  'Votre session a expiré. Veuillez vous reconnecter.',
                              backgroundColor: const Color(0xFFFFFBEB),
                              borderColor: const Color(0xFFD97706),
                              textColor: const Color(0xFF92400E),
                            )
                          else if (errorMessage != null && errorMessage.isNotEmpty)
                            _buildStatusBanner(
                              key: const Key('login_error_banner'),
                              icon: Icons.error_outline,
                              title: 'ÉCHEC DE CONNEXION',
                              message: errorMessage,
                              backgroundColor: const Color(0xFFFEF2F2),
                              borderColor: const Color(0xFFEF4444),
                              textColor: const Color(0xFF991B1B),
                            ),

                          // Identifier Input (Email or Phone)
                          TextFormField(
                            key: const Key('login_identifier_input'),
                            controller: _identifierController,
                            enabled: !isAuthenticating,
                            keyboardType: TextInputType.emailAddress,
                            textInputAction: TextInputAction.next,
                            decoration: const InputDecoration(
                              labelText: 'Email ou Téléphone (+224)',
                              hintText: 'agent@aotuc.gov.gn ou +224620...',
                              prefixIcon: Icon(Icons.person_outline),
                              border: OutlineInputBorder(),
                            ),
                            validator: (val) {
                              if (val == null || val.trim().length < 3) {
                                return 'Veuillez saisir votre email ou numéro de téléphone.';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 16),

                          // Password Input with Show/Hide toggle
                          TextFormField(
                            key: const Key('login_password_input'),
                            controller: _passwordController,
                            enabled: !isAuthenticating,
                            obscureText: _obscurePassword,
                            textInputAction: TextInputAction.done,
                            onFieldSubmitted: (_) => _handleLogin(),
                            decoration: InputDecoration(
                              labelText: 'Mot de passe',
                              prefixIcon: const Icon(Icons.lock_outline),
                              border: const OutlineInputBorder(),
                              suffixIcon: IconButton(
                                key: const Key('toggle_password_visibility'),
                                onPressed: () {
                                  setState(() {
                                    _obscurePassword = !_obscurePassword;
                                  });
                                },
                                icon: Icon(
                                  _obscurePassword
                                      ? Icons.visibility_outlined
                                      : Icons.visibility_off_outlined,
                                ),
                                tooltip: _obscurePassword
                                    ? 'Afficher le mot de passe'
                                    : 'Masquer le mot de passe',
                              ),
                            ),
                            validator: (val) {
                              if (val == null || val.length < 6) {
                                return 'Le mot de passe doit contenir au moins 6 caractères.';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 22),

                          // Submit Button
                          ElevatedButton(
                            key: const Key('login_submit_button'),
                            onPressed: isAuthenticating ? null : _handleLogin,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF0B1E36),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 15),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10),
                              ),
                            ),
                            child: isAuthenticating
                                ? const SizedBox(
                                    height: 20,
                                    width: 20,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2.2,
                                      color: Colors.white,
                                    ),
                                  )
                                : const Text(
                                    'SE CONNECTER',
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      letterSpacing: 0.6,
                                    ),
                                  ),
                          ),
                          const SizedBox(height: 16),

                          // Device Identification Footer
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: const Color(0xFFE2E8F0)),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                const Row(
                                  children: [
                                    Icon(Icons.devices, size: 14, color: Colors.black54),
                                    SizedBox(width: 6),
                                    Text(
                                      'ID Terminal :',
                                      style: TextStyle(fontSize: 10, color: Colors.black54),
                                    ),
                                  ],
                                ),
                                Text(
                                  _deviceId ?? 'Initialisation...',
                                  style: const TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                    fontFamily: 'monospace',
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildStatusBanner({
    required Key key,
    required IconData icon,
    required String title,
    required String message,
    required Color backgroundColor,
    required Color borderColor,
    required Color textColor,
  }) {
    return Container(
      key: key,
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: borderColor),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: borderColor, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 11,
                    color: textColor,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  message,
                  style: TextStyle(fontSize: 11, color: textColor),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
