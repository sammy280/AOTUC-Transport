-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "RoleType" AS ENUM ('SUPER_ADMIN', 'DIRECTOR', 'CHEF_SERVICE', 'AGENT_TERRAIN', 'SYNDICAT', 'DISTRIBUTEUR', 'AUTHORITY');

-- CreateEnum
CREATE TYPE "DriverStatus" AS ENUM ('BROUILLON', 'EN_ATTENTE_VALIDATION', 'ACTIF', 'SUSPENDU', 'INACTIF');

-- CreateEnum
CREATE TYPE "OwnerType" AS ENUM ('INDIVIDU', 'ENTREPRISE');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('TAXI_COLLECTIF', 'MAGBANA_MINIBUS', 'BUS_URBAIN', 'MOTOTAXI', 'AUTRE');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('BROUILLON', 'EN_ATTENTE_VALIDATION', 'ACTIF', 'EN_PANNE', 'SUSPENDU', 'RETIRE');

-- CreateEnum
CREATE TYPE "UnionStatus" AS ENUM ('ACTIF', 'SUSPENDU', 'EN_ATTENTE_VALIDATION', 'REJETE');

-- CreateEnum
CREATE TYPE "AuthorityStatus" AS ENUM ('ACTIF', 'EN_ATTENTE_VALIDATION', 'SUSPENDU', 'INACTIF');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('PHOTO_PORTRAIT', 'CNI_RECTO', 'CNI_VERSO', 'PERMIS_CONDUIRE', 'PERMIS_CONDUIRE_RECTO', 'PERMIS_CONDUIRE_VERSO', 'CARTE_GRISE', 'VISITE_TECHNIQUE', 'PHOTO_VEHICULE_AVANT', 'PHOTO_VEHICULE_ARRIERE', 'PHOTO_VEHICULE_GAUCHE', 'PHOTO_VEHICULE_DROITE', 'ATTESTATION_SYNDICALE', 'AUTRE');

-- CreateEnum
CREATE TYPE "ValidationEntityType" AS ENUM ('DRIVER_ENROLMENT', 'VEHICLE_ENROLMENT', 'OWNER_ENROLMENT');

-- CreateEnum
CREATE TYPE "ValidationStatus" AS ENUM ('BROUILLON', 'SOUMIS_NIVEAU2', 'EN_ATTENTE_NIVEAU3', 'RETOURNE_POUR_CORRECTION', 'VALIDE', 'REJETE');

-- CreateEnum
CREATE TYPE "ValidationAction" AS ENUM ('SUBMIT', 'FORWARD_TO_L3', 'RETURN_FOR_CORRECTION', 'APPROVE_FINAL', 'REJECT');

-- CreateEnum
CREATE TYPE "CredentialStatus" AS ENUM ('ACTIF', 'SUSPENDU', 'EXPIRE', 'PERDU', 'REMPLACE', 'REVOQUE');

-- CreateEnum
CREATE TYPE "CredentialType" AS ENUM ('DRIVER_BADGE', 'TRANSPORT_LICENCE');

-- CreateEnum
CREATE TYPE "StopDirection" AS ENUM ('ALLER', 'RETOUR', 'CIRCULAIRE');

-- CreateEnum
CREATE TYPE "TicketBatchStatus" AS ENUM ('EN_STOCK_CENTRAL', 'ALLOUE_DISTRIBUTEUR', 'EPUISE', 'ANNULE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('ESPECES', 'ORANGE_MONEY', 'MTN_MOMO', 'VIREMENT_BANCAIRE');

-- CreateEnum
CREATE TYPE "FinancialAccountType" AS ENUM ('ACTIF', 'PASSIF', 'PRODUIT', 'CHARGE');

-- CreateEnum
CREATE TYPE "LedgerTransactionType" AS ENUM ('ALLOCATION_DISTRIBUTEUR', 'VENTE_TICKETS_DIRECTE', 'ENCAISSEMENT_MOBILE_MONEY', 'VERSEMENT_BANQUE_BCRG', 'REGULARISATION_COMPTABLE');

-- CreateEnum
CREATE TYPE "FieldAssignmentStatus" AS ENUM ('PLANNED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "communes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "administrative_origin" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" "RoleType" NOT NULL,
    "label_fr" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone_number" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "job_title" TEXT,
    "avatar_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "commune_id" TEXT,
    "union_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replaced_by_token" TEXT,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "target_module" TEXT NOT NULL,
    "target_record_id" TEXT,
    "previous_values" JSONB,
    "new_values" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "reason" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "persons" (
    "id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "nin" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "email" TEXT,
    "date_of_birth" TIMESTAMP(3),
    "address" TEXT,
    "commune_id" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "gps_captured_at" TIMESTAMP(3),
    "registered_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "persons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drivers" (
    "id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "driving_license_number" TEXT NOT NULL,
    "license_category" TEXT NOT NULL DEFAULT 'B',
    "license_expiration_date" TIMESTAMP(3) NOT NULL,
    "status" "DriverStatus" NOT NULL DEFAULT 'EN_ATTENTE_VALIDATION',
    "is_payment_confirmed" BOOLEAN NOT NULL DEFAULT true,
    "emergency_contact_name" TEXT,
    "emergency_contact_phone" TEXT,
    "emergency_contact_relation" TEXT,
    "union_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owners" (
    "id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "owner_type" "OwnerType" NOT NULL DEFAULT 'INDIVIDU',
    "business_name" TEXT,
    "tax_number" TEXT,
    "union_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "plate_number" TEXT NOT NULL,
    "registration_card_number" TEXT NOT NULL,
    "chassis_vin" TEXT NOT NULL,
    "atr_number" TEXT,
    "aotuc_license_number" TEXT,
    "vehicle_type" "VehicleType" NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER,
    "seating_capacity" INTEGER,
    "status" "VehicleStatus" NOT NULL DEFAULT 'EN_ATTENTE_VALIDATION',
    "is_payment_confirmed" BOOLEAN NOT NULL DEFAULT true,
    "super_admin_confirmed" BOOLEAN NOT NULL DEFAULT true,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "gps_captured_at" TIMESTAMP(3),
    "registered_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_inspections" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "certificate_number" TEXT NOT NULL,
    "inspection_center" TEXT NOT NULL,
    "inspection_date" TIMESTAMP(3) NOT NULL,
    "expiration_date" TIMESTAMP(3) NOT NULL,
    "is_conform" BOOLEAN NOT NULL DEFAULT true,
    "remarks" TEXT,
    "inspection_doc_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_assignments" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "transport_line_id" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_date" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "assigned_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport_unions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "registration_number" TEXT,
    "president_name" TEXT,
    "fonction" TEXT,
    "contact_phone" TEXT,
    "contact_email" TEXT,
    "headquarters_address" TEXT,
    "logo_url" TEXT,
    "photo_url" TEXT,
    "cni_number" TEXT,
    "status" "UnionStatus" NOT NULL DEFAULT 'ACTIF',
    "commune_id" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "gps_captured_at" TIMESTAMP(3),
    "registered_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transport_unions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authorities" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "fonction" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "service" TEXT,
    "phone_number" TEXT,
    "email" TEXT,
    "cni_number" TEXT,
    "badge_number" TEXT,
    "photo_url" TEXT,
    "status" "AuthorityStatus" NOT NULL DEFAULT 'ACTIF',
    "notes" TEXT,
    "commune_id" TEXT,
    "registered_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "authorities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "storage_path" TEXT NOT NULL,
    "file_hash_sha256" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL,
    "uploaded_by_user_id" TEXT NOT NULL,
    "person_id" TEXT,
    "vehicle_id" TEXT,
    "union_id" TEXT,
    "authority_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validation_requests" (
    "id" TEXT NOT NULL,
    "request_number" TEXT NOT NULL,
    "entity_type" "ValidationEntityType" NOT NULL,
    "target_entity_id" TEXT NOT NULL,
    "submitter_id" TEXT NOT NULL,
    "current_level" INTEGER NOT NULL DEFAULT 1,
    "current_status" "ValidationStatus" NOT NULL DEFAULT 'BROUILLON',
    "commune_id" TEXT,
    "submitted_at" TIMESTAMP(3),
    "final_decision_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "validation_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validation_steps" (
    "id" TEXT NOT NULL,
    "validation_request_id" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "reviewer_id" TEXT NOT NULL,
    "action" "ValidationAction" NOT NULL,
    "previous_status" "ValidationStatus" NOT NULL,
    "new_status" "ValidationStatus" NOT NULL,
    "comment" TEXT,
    "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "validation_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_badges" (
    "id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "badge_number" TEXT NOT NULL,
    "qr_payload" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "key_id" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "status" "CredentialStatus" NOT NULL DEFAULT 'ACTIF',
    "suspended_at" TIMESTAMP(3),
    "suspension_reason" TEXT,
    "replaces_badge_id" TEXT,
    "printed_at" TIMESTAMP(3),
    "print_count" INTEGER NOT NULL DEFAULT 0,
    "is_payment_confirmed" BOOLEAN NOT NULL DEFAULT true,
    "payment_reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport_licences" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "transport_line_code" TEXT,
    "licence_number" TEXT NOT NULL,
    "qr_payload" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "key_id" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "status" "CredentialStatus" NOT NULL DEFAULT 'ACTIF',
    "suspended_at" TIMESTAMP(3),
    "suspension_reason" TEXT,
    "replaces_licence_id" TEXT,
    "printed_at" TIMESTAMP(3),
    "print_count" INTEGER NOT NULL DEFAULT 0,
    "is_payment_confirmed" BOOLEAN NOT NULL DEFAULT true,
    "super_admin_confirmed_at" TIMESTAMP(3),
    "super_admin_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transport_licences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credential_revocations" (
    "id" TEXT NOT NULL,
    "credential_type" "CredentialType" NOT NULL,
    "credential_id" TEXT NOT NULL,
    "serial_number" TEXT NOT NULL,
    "revoked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_by_user_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "is_permanent" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "credential_revocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport_lines" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color_hex" TEXT NOT NULL DEFAULT '#2563EB',
    "description" TEXT,
    "origin_name" TEXT NOT NULL,
    "destination_name" TEXT NOT NULL,
    "distance_km" DOUBLE PRECISION,
    "estimated_minutes" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "path_coordinates" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transport_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport_stops" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "commune_id" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "is_sheltered" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transport_stops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "line_stops" (
    "id" TEXT NOT NULL,
    "line_id" TEXT NOT NULL,
    "stop_id" TEXT NOT NULL,
    "stop_order" INTEGER NOT NULL,
    "direction" "StopDirection" NOT NULL DEFAULT 'ALLER',
    "distance_from_start_km" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "line_stops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_tariffs" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceGnf" INTEGER NOT NULL,
    "vehicle_category" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_tariffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_batches" (
    "id" TEXT NOT NULL,
    "batch_number" TEXT NOT NULL,
    "tariff_id" TEXT NOT NULL,
    "start_serial" BIGINT NOT NULL,
    "end_serial" BIGINT NOT NULL,
    "total_count" INTEGER NOT NULL,
    "remaining_count" INTEGER NOT NULL,
    "status" "TicketBatchStatus" NOT NULL DEFAULT 'EN_STOCK_CENTRAL',
    "allocated_to_user_id" TEXT,
    "allocated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_sales" (
    "id" TEXT NOT NULL,
    "receipt_number" TEXT NOT NULL,
    "tariff_id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "seller_user_id" TEXT NOT NULL,
    "quantity_sold" INTEGER NOT NULL,
    "unit_price_gnf" INTEGER NOT NULL,
    "total_amount_gnf" BIGINT NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL DEFAULT 'ESPECES',
    "payment_ref" TEXT,
    "buyer_name" TEXT,
    "buyer_phone" TEXT,
    "sale_timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_accounts" (
    "id" TEXT NOT NULL,
    "account_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FinancialAccountType" NOT NULL,
    "balance_gnf" BIGINT NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'GNF',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_ledger_entries" (
    "id" TEXT NOT NULL,
    "entry_number" TEXT NOT NULL,
    "debit_account_id" TEXT NOT NULL,
    "credit_account_id" TEXT NOT NULL,
    "amount_gnf" BIGINT NOT NULL,
    "transaction_type" "LedgerTransactionType" NOT NULL,
    "reference_code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_teams" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "commune_id" TEXT,
    "leader_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "field_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_assignments" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "commune_id" TEXT NOT NULL,
    "location_name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "assigned_user_id" TEXT,
    "team_id" TEXT,
    "supervisor_id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "target_people" INTEGER NOT NULL DEFAULT 0,
    "target_vehicles" INTEGER NOT NULL DEFAULT 0,
    "instructions" TEXT,
    "supervisor_notes" TEXT,
    "status" "FieldAssignmentStatus" NOT NULL DEFAULT 'PLANNED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "field_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_receipts" (
    "id" TEXT NOT NULL,
    "receipt_number" TEXT NOT NULL,
    "assignment_id" TEXT,
    "agent_user_id" TEXT NOT NULL,
    "person_id" TEXT,
    "vehicle_id" TEXT,
    "commune_id" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "notes" TEXT,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "communes_code_key" ON "communes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "communes_name_key" ON "communes"("name");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_number_key" ON "users"("phone_number");

-- CreateIndex
CREATE INDEX "users_phone_number_idx" ON "users"("phone_number");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_commune_id_idx" ON "users"("commune_id");

-- CreateIndex
CREATE INDEX "users_union_id_idx" ON "users"("union_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_key" ON "user_roles"("user_id", "role_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_idx" ON "refresh_tokens"("family");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_target_module_idx" ON "audit_logs"("target_module");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "persons_nin_key" ON "persons"("nin");

-- CreateIndex
CREATE UNIQUE INDEX "persons_phone_number_key" ON "persons"("phone_number");

-- CreateIndex
CREATE INDEX "persons_nin_idx" ON "persons"("nin");

-- CreateIndex
CREATE INDEX "persons_phone_number_idx" ON "persons"("phone_number");

-- CreateIndex
CREATE INDEX "persons_commune_id_idx" ON "persons"("commune_id");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_person_id_key" ON "drivers"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_driving_license_number_key" ON "drivers"("driving_license_number");

-- CreateIndex
CREATE INDEX "drivers_driving_license_number_idx" ON "drivers"("driving_license_number");

-- CreateIndex
CREATE INDEX "drivers_status_idx" ON "drivers"("status");

-- CreateIndex
CREATE INDEX "drivers_union_id_idx" ON "drivers"("union_id");

-- CreateIndex
CREATE UNIQUE INDEX "owners_person_id_key" ON "owners"("person_id");

-- CreateIndex
CREATE INDEX "owners_union_id_idx" ON "owners"("union_id");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_plate_number_key" ON "vehicles"("plate_number");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_registration_card_number_key" ON "vehicles"("registration_card_number");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_chassis_vin_key" ON "vehicles"("chassis_vin");

-- CreateIndex
CREATE INDEX "vehicles_plate_number_idx" ON "vehicles"("plate_number");

-- CreateIndex
CREATE INDEX "vehicles_chassis_vin_idx" ON "vehicles"("chassis_vin");

-- CreateIndex
CREATE INDEX "vehicles_atr_number_idx" ON "vehicles"("atr_number");

-- CreateIndex
CREATE INDEX "vehicles_aotuc_license_number_idx" ON "vehicles"("aotuc_license_number");

-- CreateIndex
CREATE INDEX "vehicles_status_idx" ON "vehicles"("status");

-- CreateIndex
CREATE INDEX "vehicles_owner_id_idx" ON "vehicles"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_inspections_certificate_number_key" ON "vehicle_inspections"("certificate_number");

-- CreateIndex
CREATE INDEX "vehicle_inspections_vehicle_id_idx" ON "vehicle_inspections"("vehicle_id");

-- CreateIndex
CREATE INDEX "vehicle_inspections_expiration_date_idx" ON "vehicle_inspections"("expiration_date");

-- CreateIndex
CREATE INDEX "vehicle_assignments_vehicle_id_idx" ON "vehicle_assignments"("vehicle_id");

-- CreateIndex
CREATE INDEX "vehicle_assignments_driver_id_idx" ON "vehicle_assignments"("driver_id");

-- CreateIndex
CREATE INDEX "vehicle_assignments_transport_line_id_idx" ON "vehicle_assignments"("transport_line_id");

-- CreateIndex
CREATE INDEX "vehicle_assignments_is_active_idx" ON "vehicle_assignments"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "transport_unions_code_key" ON "transport_unions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "transport_unions_name_key" ON "transport_unions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "transport_unions_registration_number_key" ON "transport_unions"("registration_number");

-- CreateIndex
CREATE INDEX "transport_unions_status_idx" ON "transport_unions"("status");

-- CreateIndex
CREATE INDEX "transport_unions_code_idx" ON "transport_unions"("code");

-- CreateIndex
CREATE INDEX "authorities_status_idx" ON "authorities"("status");

-- CreateIndex
CREATE INDEX "authorities_institution_idx" ON "authorities"("institution");

-- CreateIndex
CREATE INDEX "authorities_commune_id_idx" ON "authorities"("commune_id");

-- CreateIndex
CREATE INDEX "documents_uploaded_by_user_id_idx" ON "documents"("uploaded_by_user_id");

-- CreateIndex
CREATE INDEX "documents_person_id_idx" ON "documents"("person_id");

-- CreateIndex
CREATE INDEX "documents_vehicle_id_idx" ON "documents"("vehicle_id");

-- CreateIndex
CREATE INDEX "documents_union_id_idx" ON "documents"("union_id");

-- CreateIndex
CREATE INDEX "documents_authority_id_idx" ON "documents"("authority_id");

-- CreateIndex
CREATE INDEX "documents_category_idx" ON "documents"("category");

-- CreateIndex
CREATE UNIQUE INDEX "validation_requests_request_number_key" ON "validation_requests"("request_number");

-- CreateIndex
CREATE INDEX "validation_requests_target_entity_id_idx" ON "validation_requests"("target_entity_id");

-- CreateIndex
CREATE INDEX "validation_requests_submitter_id_idx" ON "validation_requests"("submitter_id");

-- CreateIndex
CREATE INDEX "validation_requests_commune_id_idx" ON "validation_requests"("commune_id");

-- CreateIndex
CREATE INDEX "validation_requests_current_status_idx" ON "validation_requests"("current_status");

-- CreateIndex
CREATE INDEX "validation_requests_current_level_idx" ON "validation_requests"("current_level");

-- CreateIndex
CREATE INDEX "validation_steps_validation_request_id_idx" ON "validation_steps"("validation_request_id");

-- CreateIndex
CREATE INDEX "validation_steps_reviewer_id_idx" ON "validation_steps"("reviewer_id");

-- CreateIndex
CREATE INDEX "validation_steps_level_idx" ON "validation_steps"("level");

-- CreateIndex
CREATE UNIQUE INDEX "driver_badges_badge_number_key" ON "driver_badges"("badge_number");

-- CreateIndex
CREATE INDEX "driver_badges_driver_id_idx" ON "driver_badges"("driver_id");

-- CreateIndex
CREATE INDEX "driver_badges_badge_number_idx" ON "driver_badges"("badge_number");

-- CreateIndex
CREATE INDEX "driver_badges_status_idx" ON "driver_badges"("status");

-- CreateIndex
CREATE INDEX "driver_badges_expires_at_idx" ON "driver_badges"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "transport_licences_licence_number_key" ON "transport_licences"("licence_number");

-- CreateIndex
CREATE INDEX "transport_licences_vehicle_id_idx" ON "transport_licences"("vehicle_id");

-- CreateIndex
CREATE INDEX "transport_licences_licence_number_idx" ON "transport_licences"("licence_number");

-- CreateIndex
CREATE INDEX "transport_licences_status_idx" ON "transport_licences"("status");

-- CreateIndex
CREATE INDEX "transport_licences_expires_at_idx" ON "transport_licences"("expires_at");

-- CreateIndex
CREATE INDEX "credential_revocations_credential_id_idx" ON "credential_revocations"("credential_id");

-- CreateIndex
CREATE INDEX "credential_revocations_serial_number_idx" ON "credential_revocations"("serial_number");

-- CreateIndex
CREATE INDEX "credential_revocations_credential_type_idx" ON "credential_revocations"("credential_type");

-- CreateIndex
CREATE INDEX "credential_revocations_revoked_at_idx" ON "credential_revocations"("revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "transport_lines_code_key" ON "transport_lines"("code");

-- CreateIndex
CREATE INDEX "transport_lines_code_idx" ON "transport_lines"("code");

-- CreateIndex
CREATE INDEX "transport_lines_is_active_idx" ON "transport_lines"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "transport_stops_code_key" ON "transport_stops"("code");

-- CreateIndex
CREATE INDEX "transport_stops_code_idx" ON "transport_stops"("code");

-- CreateIndex
CREATE INDEX "transport_stops_commune_id_idx" ON "transport_stops"("commune_id");

-- CreateIndex
CREATE INDEX "line_stops_line_id_idx" ON "line_stops"("line_id");

-- CreateIndex
CREATE INDEX "line_stops_stop_id_idx" ON "line_stops"("stop_id");

-- CreateIndex
CREATE INDEX "line_stops_stop_order_idx" ON "line_stops"("stop_order");

-- CreateIndex
CREATE UNIQUE INDEX "line_stops_line_id_stop_id_direction_key" ON "line_stops"("line_id", "stop_id", "direction");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_tariffs_code_key" ON "ticket_tariffs"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_batches_batch_number_key" ON "ticket_batches"("batch_number");

-- CreateIndex
CREATE INDEX "ticket_batches_batch_number_idx" ON "ticket_batches"("batch_number");

-- CreateIndex
CREATE INDEX "ticket_batches_status_idx" ON "ticket_batches"("status");

-- CreateIndex
CREATE INDEX "ticket_batches_allocated_to_user_id_idx" ON "ticket_batches"("allocated_to_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_sales_receipt_number_key" ON "ticket_sales"("receipt_number");

-- CreateIndex
CREATE INDEX "ticket_sales_receipt_number_idx" ON "ticket_sales"("receipt_number");

-- CreateIndex
CREATE INDEX "ticket_sales_seller_user_id_idx" ON "ticket_sales"("seller_user_id");

-- CreateIndex
CREATE INDEX "ticket_sales_sale_timestamp_idx" ON "ticket_sales"("sale_timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "financial_accounts_account_code_key" ON "financial_accounts"("account_code");

-- CreateIndex
CREATE UNIQUE INDEX "financial_ledger_entries_entry_number_key" ON "financial_ledger_entries"("entry_number");

-- CreateIndex
CREATE INDEX "financial_ledger_entries_entry_number_idx" ON "financial_ledger_entries"("entry_number");

-- CreateIndex
CREATE INDEX "financial_ledger_entries_debit_account_id_idx" ON "financial_ledger_entries"("debit_account_id");

-- CreateIndex
CREATE INDEX "financial_ledger_entries_credit_account_id_idx" ON "financial_ledger_entries"("credit_account_id");

-- CreateIndex
CREATE INDEX "financial_ledger_entries_created_at_idx" ON "financial_ledger_entries"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "field_teams_code_key" ON "field_teams"("code");

-- CreateIndex
CREATE INDEX "field_teams_commune_id_idx" ON "field_teams"("commune_id");

-- CreateIndex
CREATE INDEX "field_teams_leader_id_idx" ON "field_teams"("leader_id");

-- CreateIndex
CREATE UNIQUE INDEX "field_assignments_reference_key" ON "field_assignments"("reference");

-- CreateIndex
CREATE INDEX "field_assignments_commune_id_idx" ON "field_assignments"("commune_id");

-- CreateIndex
CREATE INDEX "field_assignments_assigned_user_id_idx" ON "field_assignments"("assigned_user_id");

-- CreateIndex
CREATE INDEX "field_assignments_team_id_idx" ON "field_assignments"("team_id");

-- CreateIndex
CREATE INDEX "field_assignments_supervisor_id_idx" ON "field_assignments"("supervisor_id");

-- CreateIndex
CREATE INDEX "field_assignments_status_idx" ON "field_assignments"("status");

-- CreateIndex
CREATE INDEX "field_assignments_start_date_idx" ON "field_assignments"("start_date");

-- CreateIndex
CREATE UNIQUE INDEX "field_receipts_receipt_number_key" ON "field_receipts"("receipt_number");

-- CreateIndex
CREATE INDEX "field_receipts_assignment_id_idx" ON "field_receipts"("assignment_id");

-- CreateIndex
CREATE INDEX "field_receipts_agent_user_id_idx" ON "field_receipts"("agent_user_id");

-- CreateIndex
CREATE INDEX "field_receipts_person_id_idx" ON "field_receipts"("person_id");

-- CreateIndex
CREATE INDEX "field_receipts_vehicle_id_idx" ON "field_receipts"("vehicle_id");

-- CreateIndex
CREATE INDEX "field_receipts_commune_id_idx" ON "field_receipts"("commune_id");

-- CreateIndex
CREATE INDEX "field_receipts_receipt_number_idx" ON "field_receipts"("receipt_number");

-- CreateIndex
CREATE INDEX "field_receipts_issued_at_idx" ON "field_receipts"("issued_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_commune_id_fkey" FOREIGN KEY ("commune_id") REFERENCES "communes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_union_id_fkey" FOREIGN KEY ("union_id") REFERENCES "transport_unions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persons" ADD CONSTRAINT "persons_commune_id_fkey" FOREIGN KEY ("commune_id") REFERENCES "communes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_union_id_fkey" FOREIGN KEY ("union_id") REFERENCES "transport_unions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owners" ADD CONSTRAINT "owners_union_id_fkey" FOREIGN KEY ("union_id") REFERENCES "transport_unions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owners" ADD CONSTRAINT "owners_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_inspections" ADD CONSTRAINT "vehicle_inspections_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_assignments" ADD CONSTRAINT "vehicle_assignments_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_assignments" ADD CONSTRAINT "vehicle_assignments_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_assignments" ADD CONSTRAINT "vehicle_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_assignments" ADD CONSTRAINT "vehicle_assignments_transport_line_id_fkey" FOREIGN KEY ("transport_line_id") REFERENCES "transport_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_unions" ADD CONSTRAINT "transport_unions_commune_id_fkey" FOREIGN KEY ("commune_id") REFERENCES "communes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authorities" ADD CONSTRAINT "authorities_commune_id_fkey" FOREIGN KEY ("commune_id") REFERENCES "communes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authorities" ADD CONSTRAINT "authorities_registered_by_user_id_fkey" FOREIGN KEY ("registered_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_union_id_fkey" FOREIGN KEY ("union_id") REFERENCES "transport_unions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_authority_id_fkey" FOREIGN KEY ("authority_id") REFERENCES "authorities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_requests" ADD CONSTRAINT "validation_requests_submitter_id_fkey" FOREIGN KEY ("submitter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_requests" ADD CONSTRAINT "validation_requests_commune_id_fkey" FOREIGN KEY ("commune_id") REFERENCES "communes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_steps" ADD CONSTRAINT "validation_steps_validation_request_id_fkey" FOREIGN KEY ("validation_request_id") REFERENCES "validation_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_steps" ADD CONSTRAINT "validation_steps_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_badges" ADD CONSTRAINT "driver_badges_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_licences" ADD CONSTRAINT "transport_licences_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_stops" ADD CONSTRAINT "transport_stops_commune_id_fkey" FOREIGN KEY ("commune_id") REFERENCES "communes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "line_stops" ADD CONSTRAINT "line_stops_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "transport_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "line_stops" ADD CONSTRAINT "line_stops_stop_id_fkey" FOREIGN KEY ("stop_id") REFERENCES "transport_stops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_batches" ADD CONSTRAINT "ticket_batches_tariff_id_fkey" FOREIGN KEY ("tariff_id") REFERENCES "ticket_tariffs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_batches" ADD CONSTRAINT "ticket_batches_allocated_to_user_id_fkey" FOREIGN KEY ("allocated_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_sales" ADD CONSTRAINT "ticket_sales_tariff_id_fkey" FOREIGN KEY ("tariff_id") REFERENCES "ticket_tariffs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_sales" ADD CONSTRAINT "ticket_sales_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "ticket_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_sales" ADD CONSTRAINT "ticket_sales_seller_user_id_fkey" FOREIGN KEY ("seller_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_ledger_entries" ADD CONSTRAINT "financial_ledger_entries_debit_account_id_fkey" FOREIGN KEY ("debit_account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_ledger_entries" ADD CONSTRAINT "financial_ledger_entries_credit_account_id_fkey" FOREIGN KEY ("credit_account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_ledger_entries" ADD CONSTRAINT "financial_ledger_entries_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_teams" ADD CONSTRAINT "field_teams_commune_id_fkey" FOREIGN KEY ("commune_id") REFERENCES "communes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_teams" ADD CONSTRAINT "field_teams_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_assignments" ADD CONSTRAINT "field_assignments_commune_id_fkey" FOREIGN KEY ("commune_id") REFERENCES "communes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_assignments" ADD CONSTRAINT "field_assignments_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_assignments" ADD CONSTRAINT "field_assignments_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "field_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_assignments" ADD CONSTRAINT "field_assignments_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_receipts" ADD CONSTRAINT "field_receipts_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "field_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_receipts" ADD CONSTRAINT "field_receipts_agent_user_id_fkey" FOREIGN KEY ("agent_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_receipts" ADD CONSTRAINT "field_receipts_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_receipts" ADD CONSTRAINT "field_receipts_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_receipts" ADD CONSTRAINT "field_receipts_commune_id_fkey" FOREIGN KEY ("commune_id") REFERENCES "communes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

