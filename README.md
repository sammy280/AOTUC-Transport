# AOTUC-TRANSPORT v2.0
### Plateforme Numérique Intégrée de Régulation et de Gestion des Transports Urbains de Conakry
**République de Guinée • Ministère des Transports • Agence Organisatrice du Transport Urbain de Conakry (AOTUC)**

---

![Sceau Officiel République de Guinée](web-admin/public/logo-guinee.png)

> **Système d'information souverain** conçu pour moderniser, immatriculer, sécuriser et réguler l'ensemble de l'écosystème des transports urbains (taxis communaux, minibus Magbanas, autobus de grand gabarit et conducteurs professionnels) dans la région du Grand Conakry.

---

## 🏛️ Architecture Monorepo & Composants

```
AOTUC-TRANSPORT/
├── backend/                   # API REST Express + PostGIS + HSM Ed25519 + Socket.IO
│   ├── src/modules/           # Auth, Registration, Documents, Validation, Badges, Licences, Lines, Ticketing, Sync, Notifications
│   ├── src/services/          # CryptoSignature (Ed25519), PDFBadge (CR80 PVC), DocumentStorage (Magic-Bytes), SMS (Orange/MTN)
│   ├── prisma/schema.prisma   # Modèle relationnel complet PostgreSQL/PostGIS (788 lignes)
│   ├── prisma/seed.js         # Données d'initialisation des 6 communes, rôles, comptes, arrêts et lignes
│   └── tests/                 # 9 suites de tests d'intégration automatisés (69/69 tests validés)
│
├── web-admin/                 # Console d'Administration Web (React 18 + TypeScript + Vite + Tailwind CSS)
│   ├── src/features/dashboard # Vue d'ensemble stratégique & KPIs communaux
│   ├── src/features/enrolment # Guichet d'enrôlement Niveau 1 (Conducteurs, Véhicules, Propriétaires)
│   ├── src/features/validation# File d'attente de validation tri-niveaux (L1 -> L2 -> L3)
│   ├── src/features/mapping   # Cartographie interactive SIG Leaflet (Corridors L-01 à L-04, Arrêts, GeoJSON)
│   ├── src/features/badges    # Centre d'émission des badges CR80 PVC et vignettes pare-brise 100x100mm
│   ├── src/features/ticketing # Billetterie, encaissements POS (Orange Money/MTN) & Grand livre en GNF
│   ├── src/features/audit     # Journal d'audit immuable scellé par empreintes SHA-256
│   └── src/features/auth      # Portail de connexion sécurisé avec contrôle d'accès strict
│
├── mobile/                    # Application Mobile Terrain Flutter (Hors Ligne & SQLite)
│   ├── lib/core/crypto        # Vérificateur cryptographique Ed25519 RFC 8032 hors ligne
│   ├── lib/features/inspector # Scanner QR de contrôle routier (Statuts VERT / ORANGE / ROUGE)
│   ├── lib/features/enrolment # Formulaire d'enrôlement mobile avec capture photo
│   └── lib/core/sync          # Moteur de synchronisation bidirectionnelle SQLite <-> Backend API
│
├── docs/                      # Documentation technique, registre des risques et journaux d'avancement
│   ├── progress.md            # Suivi détaillé des 11 jalons techniques
│   └── ...                    # Fiches d'architecture et de sécurité
│
├── scripts/                   # Scripts d'automatisation
│   ├── backup_db.ps1          # Sauvegarde automatisée PostgreSQL/PostGIS (Windows PowerShell)
│   └── backup_db.sh           # Sauvegarde automatisée PostgreSQL/PostGIS (Linux Bash)
│
├── docker-compose.yml         # Déploiement conteneurisé (PostGIS 16-3.4 + Backend Node 22 + Nginx Web)
├── CREDENTIALS.md             # Guide confidentiel des comptes et accréditations certifiés
└── credentials.json           # Référence structurée machine des comptes certifiés
```

---

## ⚡ Démarrage Rapide

### Option 1 : Développement Local (Windows PowerShell)

#### 1. Démarrer le Serveur Backend API
```powershell
Set-Location "C:\Users\Derrick\OneDrive\Desktop\transport\backend"
npm install
node src/server.js
```
*Le serveur backend démarre sur **`http://127.0.0.1:5000`** avec son point de santé sur `/api/v1/health`.*

#### 2. Démarrer la Console Web Administrateur
```powershell
Set-Location "C:\Users\Derrick\OneDrive\Desktop\transport\web-admin"
npm install
npm run dev
```
*L'interface web est accessible sur **`http://127.0.0.1:5173/`**.*

---

### Option 2 : Déploiement Conteneurisé Production (Docker Compose)

Pour déployer l'infrastructure isolée et sécurisée en production :
```powershell
Set-Location "C:\Users\Derrick\OneDrive\Desktop\transport"
docker-compose up -d --build
```
*Services orchestrés :*
- **Base de données :** `postgis/postgis:16-3.4` sur le port `5432`
- **Backend API :** Conteneur Node.js 22 LTS Debian slim sur le port `5000`
- **Frontend Web :** Serveur Nginx Alpine optimisé (compression Gzip, headers CSP) sur le port `80`

---

## 🧪 Validation & Tests Automatisés

Le backend intègre une suite de tests d'intégration complète et automatisée exécutée avec Jest en mode ES Modules natifs :

```powershell
Set-Location "C:\Users\Derrick\OneDrive\Desktop\transport\backend"
npm test
```

### Résultats de Validation (100% Succès)
```
Test Suites: 9 passed, 9 total
Tests:       69 passed, 69 total
Snapshots:   0 total
Time:        ~40s
```

1. **`auth.test.js`** (9 tests) : Hachage Argon2id, signature et vérification JWT, rotation et breach detection des jetons de rafraîchissement.
2. **`registration_documents.test.js`** (9 tests) : Détection de signatures binaires *magic-bytes* (JPEG `FF D8 FF`, PNG `89 50 4E 47`, PDF `%PDF`), streaming sécurisé et anti-doublon.
3. **`validation_workflow.test.js`** (9 tests) : Machine à états tri-niveaux (L1 $\rightarrow$ L2 $\rightarrow$ L3), interdiction d'auto-approbation (403), motif motivé obligatoire.
4. **`badges_licences.test.js`** (9 tests) : Cryptographie asymétrique Ed25519, chaîne compacte QR, révocation, génération PDF CR80 et $100 \times 100\text{ mm}$.
5. **`transport_lines.test.js`** (9 tests) : Calculs géodésiques Haversine, géométries GeoJSON LineString, arrêts de Conakry.
6. **`ticketing_ledger.test.js`** (9 tests) : Gestion séquentielle des carnets de tickets, encaissements POS Orange Money/MTN MoMo, grand livre en partie double en GNF.
7. **`mobile_sync.test.js`** (5 tests) : Synchronisation SQLite bidirectionnelle, contrôle routier hors ligne, idempotence.
8. **`communications.test.js`** (6 tests) : Normalisation des numéros guinéens (+224), passerelle SMS, diffusion Socket.IO.
9. **`notifications.test.js`** (4 tests) : API d'alertes en temps réel, simulation d'événements, accusés de lecture.

---

## 🔒 Sécurité & Accréditations Officielles

Le système est protégé par une **barrière d'authentification stricte**. Aucun module administratif n'est accessible sans connexion préalable.

Les identifiants confidentiels des profils certifiés de démonstration sont consignés dans les fichiers :
- 📄 [`CREDENTIALS.md`](CREDENTIALS.md)
- ⚙️ [`credentials.json`](credentials.json)

* **Mot de passe commun de développement :** `DevAotuc2026!`
* **Profils types :** Directeur Général (`directeur@aotuc.test`), Super Administrateur (`superadmin@aotuc.test`), Chef de Service Matoto (`chef.matoto@aotuc.test`), Agent de Terrain (`agent.matoto@aotuc.test`), Distributeur Billetterie (`distributeur.kaloum@aotuc.test`).

---

## 🗺️ Cartographie SIG de Conakry (Module 5)

La plateforme intègre les corridors de transport de la capitale guinéenne :
* **L-01 :** Axe Autoroute Fidel Castro (Kaloum ↔ Entag via Madina et Gbessia)
* **L-02 :** Axe Route Le Prince (Kaloum ↔ Cosa via Bambéto)
* **L-03 :** Corniche Nord (Dixinn ↔ Lambanyi via Kipé)
* **L-04 :** Corniche Sud (Madina ↔ Dabompa)

---

## 📄 Licence & Propriété Intellectuelle

© 2026 République de Guinée • Ministère des Transports • Agence Organisatrice du Transport Urbain de Conakry (AOTUC). Tous droits réservés.
