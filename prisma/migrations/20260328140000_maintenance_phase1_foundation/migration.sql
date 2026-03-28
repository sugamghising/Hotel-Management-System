-- Module 13 Phase 1 foundation: maintenance expansion, preventive schedules, and assets.

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE "recurrence_frequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM');

-- ============================================
-- MAINTENANCE REQUEST EXTENSIONS
-- ============================================

ALTER TABLE "maintenance_requests"
ADD COLUMN "reservation_id" UUID,
ADD COLUMN "asset_id" UUID,
ADD COLUMN "preventive_schedule_id" UUID,
ADD COLUMN "source" VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "location_details" VARCHAR(255),
ADD COLUMN "guest_reported" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "target_completion_at" TIMESTAMPTZ(6),
ADD COLUMN "paused_at" TIMESTAMPTZ(6),
ADD COLUMN "pause_reason" TEXT,
ADD COLUMN "verified_by" UUID,
ADD COLUMN "verified_at" TIMESTAMPTZ(6),
ADD COLUMN "cancelled_by" UUID,
ADD COLUMN "cancellation_reason" TEXT,
ADD COLUMN "vendor_cost" DECIMAL(10,2),
ADD COLUMN "total_cost" DECIMAL(10,2),
ADD COLUMN "guest_charge_posted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "guest_charge_folio_item_id" UUID,
ADD COLUMN "escalation_level" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "escalated_at" TIMESTAMPTZ(6);

-- ============================================
-- ASSETS
-- ============================================

CREATE TABLE "assets" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "hotel_id" UUID NOT NULL,
  "room_id" UUID,
  "asset_tag" VARCHAR(100) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "category" VARCHAR(100) NOT NULL,
  "manufacturer" VARCHAR(100),
  "model_number" VARCHAR(100),
  "serial_number" VARCHAR(100),
  "status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  "purchase_date" DATE,
  "install_date" DATE,
  "warranty_until" DATE,
  "life_expectancy_months" INTEGER,
  "accumulated_service_cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),

  CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_asset_hotel_tag" ON "assets"("hotel_id", "asset_tag");
CREATE INDEX "idx_asset_hotel_active" ON "assets"("hotel_id", "is_active");
CREATE INDEX "idx_asset_room" ON "assets"("room_id");

ALTER TABLE "assets"
ADD CONSTRAINT "assets_room_id_fkey"
FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- PREVENTIVE SCHEDULES
-- ============================================

CREATE TABLE "preventive_schedules" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "hotel_id" UUID NOT NULL,
  "room_id" UUID,
  "asset_id" UUID,
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "category" "maintenance_category" NOT NULL,
  "priority" "maintenance_priority" NOT NULL DEFAULT 'MEDIUM',
  "frequency" "recurrence_frequency" NOT NULL,
  "frequency_value" INTEGER NOT NULL DEFAULT 1,
  "start_date" DATE NOT NULL,
  "end_date" DATE,
  "next_run_at" TIMESTAMPTZ(6) NOT NULL,
  "last_generated_at" TIMESTAMPTZ(6),
  "estimated_hours" DOUBLE PRECISION,
  "default_title" VARCHAR(255),
  "default_description" TEXT,
  "auto_assign_to" UUID,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "preventive_schedules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_preventive_hotel_due" ON "preventive_schedules"("hotel_id", "is_active", "next_run_at");
CREATE INDEX "idx_preventive_room" ON "preventive_schedules"("room_id", "is_active");
CREATE INDEX "idx_preventive_asset" ON "preventive_schedules"("asset_id", "is_active");

ALTER TABLE "preventive_schedules"
ADD CONSTRAINT "preventive_schedules_room_id_fkey"
FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "preventive_schedules"
ADD CONSTRAINT "preventive_schedules_asset_id_fkey"
FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- MAINTENANCE REQUEST FKs + INDEXES
-- ============================================

CREATE INDEX "idx_maint_hotel_sla" ON "maintenance_requests"("hotel_id", "status", "target_completion_at");
CREATE INDEX "idx_maint_assigned" ON "maintenance_requests"("assigned_to", "status", "priority");
CREATE INDEX "idx_maint_escalation" ON "maintenance_requests"("hotel_id", "status", "escalation_level");
CREATE INDEX "idx_maint_schedule" ON "maintenance_requests"("preventive_schedule_id", "status");

ALTER TABLE "maintenance_requests"
ADD CONSTRAINT "maintenance_requests_asset_id_fkey"
FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "maintenance_requests"
ADD CONSTRAINT "maintenance_requests_preventive_schedule_id_fkey"
FOREIGN KEY ("preventive_schedule_id") REFERENCES "preventive_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
