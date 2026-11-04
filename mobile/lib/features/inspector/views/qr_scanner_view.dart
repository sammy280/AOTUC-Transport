import 'package:flutter/material.dart';
import '../../../core/crypto/ed25519_verifier.dart';

class QrScannerView extends StatefulWidget {
  const QrScannerView({super.key});

  @override
  State<QrScannerView> createState() => _QrScannerViewState();
}

class _QrScannerViewState extends State<QrScannerView> {
  InspectionOutcome? _outcome;
  bool _isProcessing = false;

  final String _sampleValidQr =
      'AOTUC1.ed25519_2026_01.bdg-001.BADGE.DRIVER_Bah.1771113600.1834272000.7f4a9b6623e840d1c94412ab34567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd';

  final String _sampleTamperedQr =
      'AOTUC1.ed25519_2026_01.bdg-FAKE.BADGE.DRIVER_Fake.1771113600.1834272000.TAMPERED_SIGNATURE';

  void _runVerification(String qrPayload) async {
    setState(() {
      _isProcessing = true;
    });

    await Future.delayed(const Duration(milliseconds: 300));
    final result = await Ed25519Verifier.verifyQrCode(qrPayload);

    setState(() {
      _outcome = result;
      _isProcessing = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Inspector Header Card
          Card(
            elevation: 0,
            color: const Color(0xFFF1F5F9),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: const BorderSide(color: Color(0xFFE2E8F0)),
            ),
            child: Padding(
              padding: const EdgeInsets.all(12.0),
              child: Row(
                children: [
                  const CircleAvatar(
                    backgroundColor: Color(0xFF0B1E36),
                    child: Icon(Icons.shield_outlined, color: Colors.white),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        Text(
                          'CONTRÔLE POLICE ROUTIÈRE & AOTUC',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                        ),
                        Text(
                          'Vérification cryptographique instantanée 100% hors-ligne',
                          style: TextStyle(color: Colors.black54, fontSize: 10),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Camera Viewport Simulation
          Container(
            height: 240,
            decoration: BoxDecoration(
              color: Colors.black87,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFF0B1E36), width: 3),
            ),
            child: Stack(
              alignment: Alignment.center,
              children: [
                const Icon(Icons.qr_code_scanner, color: Colors.white24, size: 100),
                Container(
                  width: 180,
                  height: 180,
                  decoration: BoxDecoration(
                    border: Border.all(color: const Color(0xFFFCD116), width: 2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                Positioned(
                  bottom: 12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.black54,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Text(
                      'Pointez l objectif vers le QR code officiel AOTUC',
                      style: TextStyle(color: Colors.white, fontSize: 10),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Test Simulation Buttons for Field Inspector
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: _isProcessing ? null : () => _runVerification(_sampleValidQr),
                  icon: const Icon(Icons.check_circle, color: Colors.white, size: 16),
                  label: const Text('Simuler Badge Valide', style: TextStyle(fontSize: 11)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF009460),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: _isProcessing ? null : () => _runVerification(_sampleTamperedQr),
                  icon: const Icon(Icons.warning_amber_rounded, color: Colors.white, size: 16),
                  label: const Text('Simuler Faux Badge', style: TextStyle(fontSize: 11)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFCE1126),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Decision Card (Traffic Light System)
          if (_outcome != null) ...[
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: _outcome!.status == InspectionResultType.VALIDE_VERT
                    ? const Color(0xFFECFDF5)
                    : const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: _outcome!.status == InspectionResultType.VALIDE_VERT
                      ? const Color(0xFF10B981)
                      : const Color(0xFFEF4444),
                  width: 2,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        _outcome!.status == InspectionResultType.VALIDE_VERT
                            ? Icons.verified
                            : Icons.gpp_bad,
                        color: _outcome!.status == InspectionResultType.VALIDE_VERT
                            ? const Color(0xFF059669)
                            : const Color(0xFFDC2626),
                        size: 28,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _outcome!.title,
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                            color: _outcome!.status == InspectionResultType.VALIDE_VERT
                                ? const Color(0xFF065F46)
                                : const Color(0xFF991B1B),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _outcome!.message,
                    style: const TextStyle(fontSize: 12, color: Colors.black87),
                  ),
                  if (_outcome!.credentialId != null) ...[
                    const Divider(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Identifiant Titre :', style: TextStyle(fontSize: 11, color: Colors.black54)),
                        Text(
                          _outcome!.credentialId!,
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Date d expiration :', style: TextStyle(fontSize: 11, color: Colors.black54)),
                        Text(
                          _outcome!.expiryDate.toString().split(' ')[0],
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
