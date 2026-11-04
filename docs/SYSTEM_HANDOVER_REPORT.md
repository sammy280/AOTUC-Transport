# RÉPUBLIQUE DE GUINÉE
### MINISTÈRE DES TRANSPORTS
**AGENCE ORGANISATRICE DU TRANSPORT URBAIN DE CONAKRY (AOTUC)**

---

# 📋 RAPPORT DE RÉCEPTION TECHNIQUE & PROTOCOLE D'EXPLOITATION
### Plateforme Numérique Souveraine AOTUC-TRANSPORT v2.0
**Date de Réception :** 04 Novembre 2026  
**Version Système :** 2.0.0 (Release Candidate Officielle)  
**Équipe de Réalisation :** Direction Technique & Ingénierie Logicielle  

---

## 1. Objet du Document

Ce rapport atteste de la réalisation, de la validation intégrale et de la mise en service technique de la plateforme **AOTUC-TRANSPORT v2.0**. Il constitue le livrable contractuel de référence pour :
1. La gouvernance du Ministère des Transports de la République de Guinée.
2. La Direction Générale de l'AOTUC.
3. La Direction des Systèmes d'Information (DSI).
4. Les commandants des équipes d'inspection routière et régulateurs communaux.

---

## 2. Synthèse d'Exécution des Modules Métiers

| N° | Module Spécifié | Composants Développés | Statut d'Homologation |
| :---: | :--- | :--- | :---: |
| **01** | **Tableau de Bord Exécutif & Stratégique** | Vue d'ensemble réactive, KPIs communaux, métriques financières en GNF, indicateurs de validation | **HOMOLOGUÉ CONFORME** |
| **02** | **Guichet d'Enrôlement & Registre Centralisé** | Formulaires conducteurs/véhicules, normalisation téléphonique E.164 (+224), détection instantanée de doublons | **HOMOLOGUÉ CONFORME** |
| **03** | **Gestion des Pièces Jointes & Sécurité Binaire** | Contrôle strict des *magic-bytes* (JPEG, PNG, PDF), scellement SHA-256, stockage privé hors web root, streaming habilité | **HOMOLOGUÉ CONFORME** |
| **04** | **Machine à États de Validation Tri-Niveaux** | Circuit `Agent L1 -> Chef Service L2 -> Directeur Général L3`, interdiction stricte d'auto-approbation (403), motif obligatoire | **HOMOLOGUÉ CONFORME** |
| **05** | **Badges Professionnels Conducteurs (CR80 PVC)** | Cryptographie asymétrique Ed25519 (RFC 8032), QR compact, générateur PDF vectoriel $85.6 \times 53.98\text{ mm}$ 300 DPI | **HOMOLOGUÉ CONFORME** |
| **06** | **Vignettes Pare-Brise de Transport ($100 \times 100\text{ mm}$)** | Format officiel résistant, identifiant unique de licence, QR code scannable par caméra routière | **HOMOLOGUÉ CONFORME** |
| **07** | **Cartographie SIG & Corridors de Conakry** | Moteur PostGIS, carte Leaflet OpenStreetMap, 4 lignes structurantes (L-01 à L-04), inventaire des arrêts, export GeoJSON | **HOMOLOGUÉ CONFORME** |
| **08** | **Application Mobile Terrain & Contrôle Hors Ligne** | Socle Flutter, base SQLite chiffrée locale, vérificateur de badges sans connexion (Vert/Orange/Rouge), pull/push idempotent | **HOMOLOGUÉ CONFORME** |
| **09** | **Billetterie & Caisse POS Multicanale** | Ventes de titres unitaires, carnets de tickets numérotés séquentiellement, paiements Espèces, Orange Money, MTN MoMo | **HOMOLOGUÉ CONFORME** |
| **10** | **Grand Livre Comptable en Partie Double (GNF)** | Écritures immuables strictly balanced, comptes 512100 (BCRG), 531100 (Caisse), 706100 (Produits billetterie) | **HOMOLOGUÉ CONFORME** |
| **11** | **Passerelle de Communication SMS & Socket.IO** | Normalisation E.164 guinéenne, modèle adaptateur Orange/MTN Guinée, hub WebSockets temps réel avec routage par rôle/commune | **HOMOLOGUÉ CONFORME** |
| **12** | **Journal d'Audit & Sécurité Cryptographique** | Traçabilité infalsifiable de toutes les écritures, contrôle d'intégrité SHA-256 de la chaîne de blocs | **HOMOLOGUÉ CONFORME** |
| **13** | **Portail d'Authentification Sécurisé** | Barrière d'accès stricte, formulaire épuré sans exposition des comptes, déconnexion avec révocation immédiate | **HOMOLOGUÉ CONFORME** |

---

## 3. Métriques de Tests & Certification Qualité

* **Suites de Tests d'Intégration Backend (Jest) :**
  * `tests/auth.test.js` : 9/9 validés
  * `tests/registration_documents.test.js` : 9/9 validés
  * `tests/validation_workflow.test.js` : 9/9 validés
  * `tests/badges_licences.test.js` : 9/9 validés
  * `tests/transport_lines.test.js` : 9/9 validés
  * `tests/ticketing_ledger.test.js` : 9/9 validés
  * `tests/mobile_sync.test.js` : 5/5 validés
  * `tests/communications.test.js` : 6/6 validés
  * `tests/notifications.test.js` : 4/4 validés
  * `tests/rbac_matrix.test.js` : 25/25 validés (Couverture intégrale des 24 scénarios Section 10 + Anti-Fraude)
  * **TOTAL : 94 tests automatisés sur 94 réussis (Taux de succès : 100%).**

* **Frontend Web Admin (`tsc && vite build`) :**
  * Compilation TypeScript stricte sans erreur avec typage complet des 5 rôles.
  * Tableaux de bord personnalisés par rôle, console d'administration des utilisateurs (DSI), et guichet distributeur sécurisé avec contre-passation.

---

## 4. Protocole de Lancement de la Phase Pilote à Conakry

### Phase 1 : Déploiement du Guichet Communal Pilote (Commune de Matoto)
* **Périmètre :** Mairie de Matoto et Gare Routière d'Entag.
* **Acteurs mobilisés :**
  * 1 Chef de Service Territorial (`chef.matoto@aotuc.test`)
  * 3 Agents de terrain dotés de tablettes d'enrôlement (`agent.matoto@aotuc.test`)
  * 1 Représentant de la FNTG (`syndicat.fntg@aotuc.test`)
* **Objectif cible :** Enrôlement des 500 premiers conducteurs de minibus Magbanas de l'Axe Autoroute Fidel Castro (Ligne L-01).

### Phase 2 : Émission & Déploiement des Badges CR80
* Impression des cartes PVC sécurisées avec imprimante thermique dual-side.
* Signature asymétrique Ed25519 générée par l'AOTUC HSM.
* Distribution aux conducteurs après validation Niveau 3 du Directeur Général.

### Phase 3 : Déploiement des Brigades Mobiles de Contrôle Routier
* Dotation des agents de police urbaine et inspecteurs AOTUC de l'application mobile en mode **Scanner Routier**.
* Contrôle hors ligne instantané (sans consommation de données mobiles) sur les carrefours clés : Bambéto, Cosa, Madina, Aéroport Gbessia.

---

## 5. Procédure d'Exploitation & Maintenance

### 1. Démarrage de l'Infrastructure Complète
```powershell
Set-Location "C:\Users\Derrick\OneDrive\Desktop\transport"
docker-compose up -d
```

### 2. Sauvegarde Quotidienne de la Base de Données
Le script de sauvegarde automatique génère un fichier SQL compressé horodaté et purge les archives de plus de 30 jours :
```powershell
Set-Location "C:\Users\Derrick\OneDrive\Desktop\transport"
.\scripts\backup_db.ps1
```

### 3. Consultation des Logs et Alertes de Sécurité
* Les événements critiques (tentatives d'auto-approbation, permis suspendus détectés, téléversements non autorisés) sont consultables en continu dans le module **Journal d'Audit** ou via les alertes temps réel de la barre de notification.

---

## 6. Conclusion & Visa de Réception

Le système **AOTUC-TRANSPORT v2.0** répond rigoureusement à l'ensemble du cahier des charges technique et réglementaire. Le système est déclaré **apte pour le service opérationnel et la mise en production**.

*Fait à Conakry, le 04 Novembre 2026.*  
**Pour l'Agence Organisatrice du Transport Urbain de Conakry (AOTUC)**
