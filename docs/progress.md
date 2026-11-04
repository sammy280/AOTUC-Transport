# AOTUC-TRANSPORT v2.0 — Progress Tracking Log

## Milestone 0: Architecture & Foundation Design (COMPLETED)
- [x] Initial requirements analysis and project scope definition.
- [x] High-level system architecture and component communication plan.
- [x] Preliminary Entity-Relationship Diagram (ERD) and relational models.
- [x] Risk register and mitigation strategies (Offline double-redemption, QR security, IDOR protection).
- [x] Unresolved business questions documented for AOTUC review.
- [x] Solo-developer 9-week pilot vs production schedule established.
- [x] Monorepo structure defined.
- [x] Git version control initialized and secure `.gitignore` / `AGENTS.md` created.

---

## Milestone 1: Backend Foundation & Authentication (COMPLETED)
- [x] Environment audit: Node.js v22.19.0, npm 10.9.3, PostgreSQL 18.3 verified.
- [x] Git configured and initialized on `main` branch.
- [x] Backend package initialization (`package.json`, ES Modules, Express, Helmet, CORS, Morgan).
- [x] Centralized configuration and `.env.example` template.
- [x] Health-check endpoint `GET /api/v1/health` with database status probe.
- [x] PostgreSQL connection and PostGIS extension verified in Prisma schema.
- [x] Initial database schema migration (`User`, `Role`, `Commune`, `AuditLog`, `RefreshToken`).
- [x] Secure authentication module (Argon2id hashing, JWT access/refresh token rotation).
- [x] RBAC & territorial scope authorization middleware.
- [x] Automated integration tests for authentication and authorization gates (9/9 passed).

---

## Milestone 2: Registration & Document Security (COMPLETED)
- [x] Domain entities modeled in Prisma schema (`Person`, `Driver`, `Owner`, `Vehicle`, `VehicleInspection`, `VehicleAssignment`, `TransportUnion`, `Document`).
- [x] Document storage engine (`DocumentStorageService`) with binary magic byte inspection (JPEG `FF D8 FF`, PNG `89 50 4E 47`, PDF `%PDF`).
- [x] SHA-256 integrity hashing and safe filename sanitization preventing path traversal.
- [x] File size enforcement (5 MB limit) and secure private storage outside public web root.
- [x] Authorized, scope-checked document streaming endpoint (`GET /api/v1/documents/:id/stream`).
- [x] Driver, Owner, and Vehicle registration services with duplicate prevention (NIN, Phone, Plate, License, Chassis/VIN).
- [x] Guinean phone number normalizer to E.164 (`+224...`).
- [x] Full automated integration test suite covering Milestones 1 & 2 (18/18 passed).

---

## Milestone 3: Multi-Level Validation State Machine (COMPLETED)
- [x] Consolidated unambiguous 6-state validation model (`BROUILLON`, `SOUMIS_NIVEAU2`, `EN_ATTENTE_NIVEAU3`, `RETOURNE_POUR_CORRECTION`, `VALIDE`, `REJETE`).
- [x] Modeled `ValidationRequest` and `ValidationStep` audit trail entities in Prisma schema.
- [x] Enforced strict 3-tier sequence: Level 1 Agent Filing $\rightarrow$ Level 2 Chef de Service Review $\rightarrow$ Level 3 Director Final Approval.
- [x] Anti-fraud check: Self-approval prohibited (`SELF_APPROVAL_FORBIDDEN` 403).
- [x] Level-skipping prohibited: Director cannot directly approve Level 2 pending files (`INVALID_STATE_TRANSITION` 400).
- [x] Mandatory justification comments required for all rejection and return-for-correction decisions (`MANDATORY_COMMENT_REQUIRED` 400).
- [x] Scope enforcement: Chefs de Service restricted to dossiers within their assigned commune (`FORBIDDEN_COMMUNE_SCOPE` 403).
- [x] Automatic operational synchronization: `VALIDE` status updates Driver/Vehicle to `ACTIF`.
- [x] Full automated integration test suite (27/27 passed across 3 test suites).

---

## Milestone 4: Badges & Licences (Ed25519 & PDF) (COMPLETED)
- [x] Prisma schema models: `DriverBadge`, `TransportLicence`, `CredentialRevocation`.
- [x] Asymmetric Ed25519 signing engine (`cryptoSignatureService.js`): compact scannable QR string (`AOTUC1.<keyId>.<cid>.<typ>.<tid>.<iat>.<exp>.<sig>`), offline public key verification, tamper detection.
- [x] Printable PDF generator (`pdfBadgeService.js`): Dual-sided CR80 card ($85.6 \times 53.98\text{ mm}$) and Windshield sticker ($100 \times 100\text{ mm}$).
- [x] Integration of official Republic of Guinea & Ministère des Transports circular logo into PDFs.
- [x] Endpoints for issuance, public keys, revocation snapshot, and PDF download streaming.
- [x] Full automated integration tests (36/36 passed across 4 test suites).

---

## Milestone 5: Conakry GIS Mapping & Transport Lines (COMPLETED)
- [x] Prisma schema models: `TransportLine`, `TransportStop`, `LineStop`, `StopDirection`.
- [x] Spatial engine (`gisCalculationService.js`): Geodesic Haversine distance, road polyline calculation, Conakry urban traffic travel time estimation, GeoJSON FeatureCollection serializer.
- [x] Domain module: `transport-lines` (`schemas.js`, `service.js`, `controller.js`, `routes.js`).
- [x] Frontend interactive map: `web-admin/src/features/mapping/NetworkMapView.tsx` embedding OpenStreetMap / Leaflet, Conakry corridors (`L-01` Kaloum-Matoto, `L-02` Bambéto-Cosa-Enco5, `L-03` Sonfonia-Kagbélen, `L-04` Kipé-Lambanyi), stop markers, line inspector, stop creation modal, and GeoJSON export.
- [x] Full automated integration tests (45/45 passed across 5 test suites).

---

## Milestone 6: Mobile App & Offline Synchronization (COMPLETED)
- [x] Flutter mobile application scaffold in `mobile/`: Dart models, clean architecture, national tricolor theme.
- [x] Local SQLite encrypted database (`offline_database.dart`): draft enrollments outbox, cached Ed25519 public keys, local revocation list blacklist.
- [x] Offline Roadside Inspector (`qr_scanner_view.dart` & `ed25519_verifier.dart`): instant offline verification, RFC 8032 signature verification, traffic light status display (VERT, ROUGE, ORANGE).
- [x] Offline Field Enroller (`enrolment_form_view.dart`): driver/vehicle data capture, photo box, pending queue counter.
- [x] Background sync manager (`sync_manager.dart`) and Backend Sync API (`/api/v1/sync/pull`, `/api/v1/sync/push`) with idempotency guarantees.
- [x] Full automated integration tests (50/50 passed across 6 test suites).

---

## Milestone 7: Secure Ticketing & Double-Entry Financial Ledger (COMPLETED)
- [x] Prisma schema models: `TicketTariff`, `TicketBatch`, `TicketSale`, `FinancialAccount`, `FinancialLedgerEntry`.
- [x] Physical ticket carnet management: sequential numbering, remaining inventory decrement, status transitions (`EN_STOCK_CENTRAL` $\rightarrow$ `ALLOUE_DISTRIBUTEUR` $\rightarrow$ `EPUISE`).
- [x] Point-of-Sale (POS) cashier: unit tariffs, Orange Money / MTN MoMo / Cash payments, official receipt number generation (`REC-YYYY-XXXXX`).
- [x] Immutable Double-Entry Financial Ledger in Guinean Francs (GNF): strict debit/credit separation, automatic balance tracking (BCRG `512100`, Caisse `531100`, Ventes `706100`).
- [x] Web Admin interactive view: `web-admin/src/features/ticketing/TicketingLedgerView.tsx`.
- [x] Full automated integration tests (59/59 passed across 7 test suites).

---

## Milestone 8: Communications & Real-Time Dispatch Hub (COMPLETED)
- [x] Guinean SMS Gateway Adapter (`smsService.js`): E.164 phone normalization (`+224...`), mock dev provider, Orange/MTN Guinea carrier API integration points, automated French notification templates.
- [x] Real-time Socket.IO Hub (`socketService.js`): JWT authentication handshake, room routing by user role (`role:DIRECTOR`) and commune (`commune:Matoto`), dispatch messaging.
- [x] Full automated integration tests (65/65 passed across 8 test suites).

---

## Milestone 9: Production Deployment & Dockerization (COMPLETED)
- [x] Multi-stage `backend/Dockerfile` with Node.js 22 LTS Debian slim, non-root user security, Prisma generation, and health check.
- [x] Multi-stage `web-admin/Dockerfile` with Vite build and optimized Nginx Alpine static serving (gzip, security headers, SPA fallback).
- [x] `docker-compose.yml` orchestrating `postgis/postgis:16-3.4`, `backend`, `web-admin`, persistent volumes, and health checks.
- [x] Production environment template `.env.production.example`.
- [x] Automated PostGIS database backup and retention scripts (`scripts/backup_db.ps1` and `scripts/backup_db.sh`).
- [x] Official Republic of Guinea / Ministère des Transports logo integrated across Web Admin (Navbar, Sidebar, Dashboard, Badges, Licences, Tickets), Mobile App, and PDF generators.
