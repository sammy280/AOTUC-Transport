import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';
import '../../../core/database/offline_database.dart';

class EnrolmentFormView extends StatefulWidget {
  const EnrolmentFormView({super.key});

  @override
  State<EnrolmentFormView> createState() => _EnrolmentFormViewState();
}

class _EnrolmentFormViewState extends State<EnrolmentFormView> {
  final _formKey = GlobalKey<FormState>();
  final _nomController = TextEditingController();
  final _prenomController = TextEditingController();
  final _telephoneController = TextEditingController(text: '+224 ');
  final _ninController = TextEditingController();
  final _permisController = TextEditingController();

  String _commune = 'Matoto';
  String _categorie = 'B';
  int _pendingCount = 0;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _loadPendingCount();
  }

  void _loadPendingCount() async {
    final drafts = await OfflineDatabase.instance.getPendingSyncDrafts();
    setState(() {
      _pendingCount = drafts.length;
    });
  }

  void _saveDraftLocally() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isSaving = true;
    });

    final payload = {
      'firstName': _prenomController.text.trim(),
      'lastName': _nomController.text.trim(),
      'phoneNumber': _telephoneController.text.trim(),
      'nationalIdNumber': _ninController.text.trim(),
      'licenseNumber': _permisController.text.trim(),
      'licenseCategories': [_categorie],
      'commune': _commune,
    };

    final clientId = const Uuid().v4();

    await OfflineDatabase.instance.insertDraft(
      clientId: clientId,
      entityType: 'DRIVER',
      payloadJson: jsonEncode(payload),
    );

    await Future.delayed(const Duration(milliseconds: 300));
    _loadPendingCount();

    setState(() {
      _isSaving = false;
      _nomController.clear();
      _prenomController.clear();
      _ninController.clear();
      _permisController.clear();
      _telephoneController.text = '+224 ';
    });

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('✓ Dossier chauffeur enregistré localement dans la file d attente hors-ligne !'),
          backgroundColor: Color(0xFF009460),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Outbox Pending Sync Status Banner
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
                        'File d attente d envoi : $_pendingCount dossier(s)',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                      ),
                    ],
                  ),
                  TextButton.icon(
                    onPressed: _pendingCount > 0
                        ? () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Synchronisation vers l API AOTUC en cours...')),
                            );
                          }
                        : null,
                    icon: const Icon(Icons.sync, size: 14),
                    label: const Text('Envoyer', style: TextStyle(fontSize: 11)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Form Fields
            const Text(
              'NOUVEL ENRÔLEMENT CHAUFFEUR',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF0B1E36)),
            ),
            const SizedBox(height: 12),

            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _prenomController,
                    decoration: const InputDecoration(
                      labelText: 'Prénom *',
                      border: OutlineInputBorder(),
                      contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    ),
                    validator: (v) => v == null || v.isEmpty ? 'Requis' : null,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextFormField(
                    controller: _nomController,
                    decoration: const InputDecoration(
                      labelText: 'Nom *',
                      border: OutlineInputBorder(),
                      contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    ),
                    validator: (v) => v == null || v.isEmpty ? 'Requis' : null,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            TextFormField(
              controller: _telephoneController,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(
                labelText: 'Numéro de Téléphone (Orange / MTN) *',
                border: OutlineInputBorder(),
                contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              ),
              validator: (v) => v == null || v.length < 8 ? 'Numéro guinéen valide requis' : null,
            ),
            const SizedBox(height: 12),

            TextFormField(
              controller: _ninController,
              decoration: const InputDecoration(
                labelText: 'Numéro d Identification Nationale (NIN)',
                border: OutlineInputBorder(),
                contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              ),
            ),
            const SizedBox(height: 12),

            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _permisController,
                    decoration: const InputDecoration(
                      labelText: 'N° Permis de Conduire *',
                      border: OutlineInputBorder(),
                      contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    ),
                    validator: (v) => v == null || v.isEmpty ? 'Requis' : null,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    value: _categorie,
                    decoration: const InputDecoration(
                      labelText: 'Catégorie Permis',
                      border: OutlineInputBorder(),
                      contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    ),
                    items: const [
                      DropdownMenuItem(value: 'B', child: Text('B (Taxi / Voiture)')),
                      DropdownMenuItem(value: 'C1', child: Text('C1 (Minibus)')),
                      DropdownMenuItem(value: 'D', child: Text('D (Autocar)')),
                    ],
                    onChanged: (v) => setState(() => _categorie = v!),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            DropdownButtonFormField<String>(
              value: _commune,
              decoration: const InputDecoration(
                labelText: 'Commune d Affectation Terrain *',
                border: OutlineInputBorder(),
                contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              ),
              items: const [
                DropdownMenuItem(value: 'Kaloum', child: Text('Kaloum')),
                DropdownMenuItem(value: 'Dixinn', child: Text('Dixinn')),
                DropdownMenuItem(value: 'Matam', child: Text('Matam')),
                DropdownMenuItem(value: 'Ratoma', child: Text('Ratoma')),
                DropdownMenuItem(value: 'Matoto', child: Text('Matoto')),
              ],
              onChanged: (v) => setState(() => _commune = v!),
            ),
            const SizedBox(height: 20),

            // Submit Button
            ElevatedButton.icon(
              onPressed: _isSaving ? null : _saveDraftLocally,
              icon: const Icon(Icons.save_alt, color: Colors.white),
              label: const Text('Enregistrer Hors-Ligne (Mémoire Locale)', style: TextStyle(fontWeight: FontWeight.bold)),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0B1E36),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
