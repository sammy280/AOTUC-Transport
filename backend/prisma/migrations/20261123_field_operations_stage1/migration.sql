-- CreateEnum
CREATE TYPE "UserAccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CheckpointStatus" AS ENUM ('YES', 'NO', 'NOT_CHECKED');

-- CreateEnum
CREATE TYPE "InspectionOutcome" AS ENUM ('NOT_ASSESSED', 'CONFORME', 'NON_CONFORME', 'AVERTISSEMENT', 'INFRACTION');

-- CreateEnum
CREATE TYPE "MissionReportStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MissionReportDecision" AS ENUM ('APPROVED', 'REJECTED', 'CHANGES_REQUESTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FieldAssignmentStatus" ADD VALUE 'DRAFT';
ALTER TYPE "FieldAssignmentStatus" ADD VALUE 'AWAITING_REPORT';
ALTER TYPE "FieldAssignmentStatus" ADD VALUE 'SUBMITTED';
ALTER TYPE "FieldAssignmentStatus" ADD VALUE 'CHANGES_REQUESTED';
ALTER TYPE "FieldAssignmentStatus" ADD VALUE 'APPROVED';
ALTER TYPE "FieldAssignmentStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "account_status" "UserAccountStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "address" TEXT,
ADD COLUMN     "assigned_team_id" TEXT,
ADD COLUMN     "employee_number" TEXT;

-- Backfill account_status from is_active: preserve existing inactive accounts
UPDATE "users" SET "account_status" = 'INACTIVE' WHERE "is_active" = false;

-- AlterTable
ALTER TABLE "field_assignments" ADD COLUMN     "cancellation_reason" TEXT,
ADD COLUMN     "cancelled_at" TIMESTAMP(3),
ADD COLUMN     "cancelled_by_user_id" TEXT,
ADD COLUMN     "inspection_targets" JSONB,
ADD COLUMN     "objectives" TEXT;

-- CreateTable
CREATE TABLE "field_assignment_agents" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "agent_user_id" TEXT NOT NULL,
    "role_in_mission" TEXT NOT NULL DEFAULT 'MEMBER',
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_assignment_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_inspections" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "agent_user_id" TEXT NOT NULL,
    "commune_id" TEXT NOT NULL,
    "driver_id" TEXT,
    "vehicle_id" TEXT,
    "person_id" TEXT,
    "target_type" TEXT NOT NULL,
    "driver_name" TEXT,
    "driver_phone" TEXT,
    "license_number" TEXT,
    "plate_number" TEXT,
    "vehicle_type" TEXT,
    "has_valid_license" "CheckpointStatus" NOT NULL DEFAULT 'NOT_CHECKED',
    "has_municipal_sticker" "CheckpointStatus" NOT NULL DEFAULT 'NOT_CHECKED',
    "has_technical_control" "CheckpointStatus" NOT NULL DEFAULT 'NOT_CHECKED',
    "is_authorized_route" "CheckpointStatus" NOT NULL DEFAULT 'NOT_CHECKED',
    "has_safety_equipment" "CheckpointStatus" NOT NULL DEFAULT 'NOT_CHECKED',
    "outcome" "InspectionOutcome" NOT NULL DEFAULT 'NOT_ASSESSED',
    "violations" JSONB,
    "observations" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "location_name" TEXT,
    "inspected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_documents" (
    "id" TEXT NOT NULL,
    "inspection_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_hash" TEXT,
    "mime_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mission_reports" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "lead_author_id" TEXT NOT NULL,
    "current_version" INTEGER NOT NULL DEFAULT 1,
    "status" "MissionReportStatus" NOT NULL DEFAULT 'DRAFT',
    "objectives_assessed" TEXT,
    "summary" TEXT NOT NULL,
    "inspections_count" INTEGER NOT NULL DEFAULT 0,
    "violations_count" INTEGER NOT NULL DEFAULT 0,
    "observations" TEXT,
    "recommendations" TEXT,
    "conclusions" TEXT,
    "contributors" JSONB,
    "evidence_photos" JSONB,
    "supervisor_notes" TEXT,
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mission_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mission_report_versions" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "objectives_assessed" TEXT,
    "inspections_count" INTEGER NOT NULL,
    "violations_count" INTEGER NOT NULL,
    "observations" TEXT,
    "recommendations" TEXT,
    "conclusions" TEXT,
    "contributors" JSONB,
    "evidence_photos" JSONB,
    "submitted_by_user_id" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by_user_id" TEXT,
    "decision" "MissionReportDecision",
    "supervisor_comments" TEXT,
    "decision_at" TIMESTAMP(3),

    CONSTRAINT "mission_report_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "field_assignment_agents_assignment_id_idx" ON "field_assignment_agents"("assignment_id");

-- CreateIndex
CREATE INDEX "field_assignment_agents_agent_user_id_idx" ON "field_assignment_agents"("agent_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "field_assignment_agents_assignment_id_agent_user_id_key" ON "field_assignment_agents"("assignment_id", "agent_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "field_inspections_reference_key" ON "field_inspections"("reference");

-- CreateIndex
CREATE INDEX "field_inspections_assignment_id_idx" ON "field_inspections"("assignment_id");

-- CreateIndex
CREATE INDEX "field_inspections_agent_user_id_idx" ON "field_inspections"("agent_user_id");

-- CreateIndex
CREATE INDEX "field_inspections_commune_id_idx" ON "field_inspections"("commune_id");

-- CreateIndex
CREATE INDEX "field_inspections_driver_id_idx" ON "field_inspections"("driver_id");

-- CreateIndex
CREATE INDEX "field_inspections_vehicle_id_idx" ON "field_inspections"("vehicle_id");

-- CreateIndex
CREATE INDEX "field_inspections_person_id_idx" ON "field_inspections"("person_id");

-- CreateIndex
CREATE INDEX "field_inspections_plate_number_idx" ON "field_inspections"("plate_number");

-- CreateIndex
CREATE INDEX "field_inspections_license_number_idx" ON "field_inspections"("license_number");

-- CreateIndex
CREATE INDEX "field_inspections_outcome_idx" ON "field_inspections"("outcome");

-- CreateIndex
CREATE INDEX "inspection_documents_inspection_id_idx" ON "inspection_documents"("inspection_id");

-- CreateIndex
CREATE UNIQUE INDEX "mission_reports_reference_key" ON "mission_reports"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "mission_reports_assignment_id_key" ON "mission_reports"("assignment_id");

-- CreateIndex
CREATE INDEX "mission_reports_assignment_id_idx" ON "mission_reports"("assignment_id");

-- CreateIndex
CREATE INDEX "mission_reports_lead_author_id_idx" ON "mission_reports"("lead_author_id");

-- CreateIndex
CREATE INDEX "mission_reports_status_idx" ON "mission_reports"("status");

-- CreateIndex
CREATE INDEX "mission_report_versions_report_id_idx" ON "mission_report_versions"("report_id");

-- CreateIndex
CREATE INDEX "mission_report_versions_submitted_by_user_id_idx" ON "mission_report_versions"("submitted_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "mission_report_versions_report_id_version_number_key" ON "mission_report_versions"("report_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "users_employee_number_key" ON "users"("employee_number");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_assigned_team_id_fkey" FOREIGN KEY ("assigned_team_id") REFERENCES "field_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_assignments" ADD CONSTRAINT "field_assignments_cancelled_by_user_id_fkey" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_assignment_agents" ADD CONSTRAINT "field_assignment_agents_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "field_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_assignment_agents" ADD CONSTRAINT "field_assignment_agents_agent_user_id_fkey" FOREIGN KEY ("agent_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_inspections" ADD CONSTRAINT "field_inspections_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "field_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_inspections" ADD CONSTRAINT "field_inspections_agent_user_id_fkey" FOREIGN KEY ("agent_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_inspections" ADD CONSTRAINT "field_inspections_commune_id_fkey" FOREIGN KEY ("commune_id") REFERENCES "communes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_inspections" ADD CONSTRAINT "field_inspections_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_inspections" ADD CONSTRAINT "field_inspections_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_inspections" ADD CONSTRAINT "field_inspections_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_documents" ADD CONSTRAINT "inspection_documents_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "field_inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mission_reports" ADD CONSTRAINT "mission_reports_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "field_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mission_reports" ADD CONSTRAINT "mission_reports_lead_author_id_fkey" FOREIGN KEY ("lead_author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mission_reports" ADD CONSTRAINT "mission_reports_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mission_report_versions" ADD CONSTRAINT "mission_report_versions_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "mission_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mission_report_versions" ADD CONSTRAINT "mission_report_versions_submitted_by_user_id_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mission_report_versions" ADD CONSTRAINT "mission_report_versions_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

