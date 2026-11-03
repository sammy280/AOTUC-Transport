# AOTUC-TRANSPORT v2.0

> **Plateforme Intégrée de Gestion du Transport Urbain de Conakry**  
> Client: **Agence Organisatrice du Transport Urbain de Conakry (AOTUC), République de Guinée**

---

## Overview
AOTUC-TRANSPORT is an enterprise-grade government urban transport management platform engineered to digitize, regulate, and secure public transportation across the capital city of Conakry, Guinea.

The platform centralizes the lifecycle of:
- **Transport Actors:** Drivers (*Chauffeurs*), Vehicle Owners (*Propriétaires*), Vehicles (*Véhicules*), and Transport Unions (*Syndicats*).
- **Administrative Governance:** Strict 3-level approval workflow with auditable validation records.
- **Official Credentials:** Tamper-resistant, cryptographically signed CR80 driver badges and windshield vehicle transport licences with offline-verifiable QR codes.
- **Geographic Network (GIS):** PostGIS-backed Conakry commune boundaries, transport lines, and bus stops with MapLibre GL.
- **Financial & Ticket Operations:** Fixed-precision immutable ledger for ticket book allocations, sales, and distributor settlements.
- **Inspection & Field Enrolment:** Offline-first Flutter mobile application with SQLite and Ed25519 public key verification.

---

## Monorepo Layout
```
AOTUC-TRANSPORT/
├── backend/          # Node.js / Express REST API with Prisma & PostGIS
├── web-admin/        # React + Vite + TypeScript administration dashboard
├── mobile/           # Flutter application (Field Enrolment & Inspector modes)
├── docs/             # Architecture, Database, Security & Business documentation
├── scripts/          # Database seeding and utility scripts
├── .gitignore        # Version control ignore rules
├── AGENTS.md         # Instructions for AI assistants (Antigravity & OpenCode)
└── README.md
```

---

## Development Environment
- **Operating System:** Windows 10/11 (PowerShell)
- **Node.js:** v22.x LTS
- **Database:** PostgreSQL 18 with PostGIS extension
- **Primary Interface Language:** French (`fr-FR`)
- **Code & API Conventions:** English
