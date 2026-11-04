# RÉPUBLIQUE DE GUINÉE
### MINISTÈRE DES TRANSPORTS
**AGENCE ORGANISATRICE DU TRANSPORT URBAIN DE CONAKRY (AOTUC)**

---

# 🔐 Guide Officiel des Identifiants & Comptes Certifiés (AOTUC-TRANSPORT v2.0)

> [!IMPORTANT]
> Ce document répertorie l'ensemble des comptes certifiés de démonstration et d'évaluation préconfigurés dans la base de données et l'interface Web Admin.
> **Mot de passe commun à tous les comptes de test :** `DevAotuc2026!`

---

## 1. Tableau Récapitulatif des Accréditations

| Rôle & Niveau Hiérarchique | Nom & Prénom | Identifiant Email | Numéro Mobile National | Périmètre & Commune | Habilitations Clés |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Directeur Général (Niveau 3)** | Mamadou Camara | `directeur@aotuc.test` | `+224 620 00 00 02` | Direction Générale (Conakry) | Validation finale Niveau 3, arrêté ministériel, signature Ed25519 des badges/vignettes, gouvernance globale |
| **Super Administrateur (DSI)** | Ibrahima Diallo | `superadmin@aotuc.test` | `+224 620 00 00 01` | Toutes Communes (National) | Gestion complète des utilisateurs, audit cryptographique SHA-256, paramétrage système |
| **Chef de Service Territorial (Niveau 2)** | Fanta Soumah | `chef.matoto@aotuc.test` | `+224 620 00 00 03` | Commune de Matoto | Instruction de Niveau 2 des dossiers conducteurs/véhicules de Matoto, retour pour correction avec SMS |
| **Chef de Service Territorial (Niveau 2)** | Alpha Barry | `chef.kaloum@aotuc.test` | `+224 620 00 00 04` | Commune de Kaloum | Instruction de Niveau 2 des dossiers de Kaloum, contrôle de conformité |
| **Agent d'Enrôlement Terrain (Niveau 1)** | Sekou Conte | `agent.matoto@aotuc.test` | `+224 620 00 00 05` | Commune de Matoto | Guichet d'enrôlement Niveau 1, contrôle des pièces jointes (*magic-bytes*), soumission initiale |
| **Distributeur Billetterie Agréé** | Ousmane Sylla | `distributeur.kaloum@aotuc.test` | `+224 620 00 00 06` | Commune de Kaloum | Encaissement billetterie (Espèces, Orange Money, MTN MoMo), gestion des carnets de tickets |
| **Délégué Syndical FNTG** | Amadou Diallo | `syndicat.fntg@aotuc.test` | `+224 620 00 00 07` | Fédération Syndicale FNTG | Consultation en lecture seule des registres de conducteurs et véhicules syndiqués |

---

## 2. Fiches Détaillées par Profil

### 👑 1. Directeur Général AOTUC (Validation Niveau 3)
* **Nom :** Mamadou Camara
* **Email :** `directeur@aotuc.test`
* **Téléphone :** `+224 620 00 00 02`
* **Mot de passe :** `DevAotuc2026!`
* **Périmètre :** Direction Générale de Conakry
* **Missions :**
  * Approbation finale des dossiers visés par les Chefs de Service.
  * Déclenchement de l'émission des badges CR80 PVC et vignettes $100 \times 100\text{ mm}$.
  * Consultation du Tableau de bord exécutif et des métriques stratégiques.

### 🛡️ 2. Super Administrateur DSI (Sécurité & Audit)
* **Nom :** Ibrahima Diallo
* **Email :** `superadmin@aotuc.test`
* **Téléphone :** `+224 620 00 00 01`
* **Mot de passe :** `DevAotuc2026!`
* **Périmètre :** National / Toutes Communes
* **Missions :**
  * Accès au Journal d'Audit cryptographique et vérification des empreintes SHA-256.
  * Gestion des rôles, clés de signature Ed25519 et surveillance des alertes anti-fraude.
  * Exportation des rapports de conformité et sauvegardes PostGIS.

### 🏢 3. Chef de Service Territorial Matoto (Validation Niveau 2)
* **Nom :** Fanta Soumah
* **Email :** `chef.matoto@aotuc.test`
* **Téléphone :** `+224 620 00 00 03`
* **Mot de passe :** `DevAotuc2026!`
* **Périmètre :** Commune de Matoto (Périmètre étanche)
* **Missions :**
  * Vérification de la régularité des pièces d'enrôlement des conducteurs et taxis de Matoto.
  * Transmission au Niveau 3 (Directeur) ou retour pour correction avec notification SMS automatique.
  * *Règle anti-fraude :* Ne peut pas approuver ses propres soumissions.

### 📋 4. Agent d'Enrôlement Terrain Matoto (Niveau 1)
* **Nom :** Sekou Conte
* **Email :** `agent.matoto@aotuc.test`
* **Téléphone :** `+224 620 00 00 05`
* **Mot de passe :** `DevAotuc2026!`
* **Périmètre :** Guichet Communal de Matoto
* **Missions :**
  * Saisie des fiches conducteurs, NIN, permis de conduire et véhicules urbains (Magbanas, taxis).
  * Téléversement des documents d'identité avec validation binaire stricte.
  * Soumission des dossiers pour instruction au Chef de Service.

### 🎫 5. Distributeur Billetterie Agréé (Caisse & POS)
* **Nom :** Ousmane Sylla
* **Email :** `distributeur.kaloum@aotuc.test`
* **Téléphone :** `+224 620 00 00 06`
* **Mot de passe :** `DevAotuc2026!`
* **Périmètre :** Guichet Port & Gare Routière de Kaloum
* **Missions :**
  * Vente de tickets urbains (2 000 GNF, 5 000 GNF, 10 000 GNF).
  * Encaissements multicanaux (Espèces, Orange Money, MTN Mobile Money).
  * Génération automatique d'écritures en partie double au Grand Livre comptable en GNF.

### 🤝 6. Délégué Syndical FNTG (Consultation)
* **Nom :** Amadou Diallo
* **Email :** `syndicat.fntg@aotuc.test`
* **Téléphone :** `+224 620 00 00 07`
* **Mot de passe :** `DevAotuc2026!`
* **Périmètre :** Fédération Nationale des Transports de Guinée (FNTG)
* **Missions :**
  * Consultation transparente des adhérents syndiqués et suivi de l'avancement des cartes professionnelles.

---

## 3. Modalités d'Utilisation dans l'Application

1. Ouvrez l'application Web Admin : **`http://127.0.0.1:5173/`**
2. Le portail d'authentification s'affiche.
3. Deux méthodes de connexion sont disponibles :
   * **Méthode Manuelle :** Saisissez l'identifiant (Email ou Numéro de téléphone) et le mot de passe `DevAotuc2026!`, puis cliquez sur **« Accéder au Système AOTUC »**.
   * **Méthode d'Accès Rapide :** Cliquez sur l'une des 6 cartes de profils en bas du formulaire pour pré-remplir instantanément les identifiants, puis validez avec le bouton de connexion.
4. Pour changer d'utilisateur ou tester la déconnexion, cliquez sur le bouton rouge **« Déconnexion »** dans la barre supérieure de navigation.
