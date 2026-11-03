# AGENTS.md — Guidelines for Coding Agents (Antigravity & OpenCode)

Project: **AOTUC-TRANSPORT v2.0**
Client: **Agence Organisatrice du Transport Urbain de Conakry (AOTUC), Guinea**
Primary UI Language: **French** (User-facing labels, forms, error messages, and statuses)
Code & API Language: **English** (Variable names, function names, database tables, comments, API routes)

---

## 1. Operating Rules for AI Assistants
1. **Never Assume — Inspect First**: Always check existing directory structure, package manifests (`package.json`), migrations, and environment configuration before creating or editing files.
2. **Step-by-Step Delivery**: Never dump hundreds of lines of code across unrelated modules at once. Work in verified vertical slices (Database -> API -> Tests -> Frontend).
3. **Preserve Integrity**: Do not overwrite, delete, reformat, migrate, or replace existing working files blindly.
4. **No Destructive Operations**: Never run destructive database resets, table drops, or secret rotations without explicit developer approval.
5. **No Invented Business Rules**: Distinguish strictly between confirmed requirements, technical recommendations, unconfirmed AOTUC business rules, and legal/regulatory matters.
6. **Security & Secrets**: Never commit `.env` files, private keys, database passwords, or auth tokens. Always maintain `.env.example`.
7. **Auditing & Reporting**: At the end of every significant task, provide the standard compact summary:
   - Objective
   - Changes
   - Commands
   - Verification
   - Decisions
   - Risks/limitations
   - Next step

---

## 2. Technology Stack & Conventions
- **Backend**: Node.js v22 LTS, Express.js (ESM), Prisma ORM, PostgreSQL 18 with PostGIS, Zod validation, Argon2id/bcrypt password hashing, JWT with refresh-token rotation.
- **Frontend (Web Admin)**: React, Vite, TypeScript, Tailwind CSS, MapLibre GL.
- **Mobile**: Flutter (Dart), SQLite offline storage, Ed25519 asymmetric QR verification with cached revocation lists.
- **Financial Ledger**: Double-entry, immutable ledger (`financial_ledger_entries`), exact decimal amounts (never floating point).
- **Validation**: Strict 3-level approval state machine (`SOUMIS` -> Level 2 Chef de Service review -> Level 3 Director approval -> `VALIDE`).
