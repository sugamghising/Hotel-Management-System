-- Phase 2 housekeeping foundations: shifts, staffing assignments, and lost-and-found tracking.

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE "housekeeping_shift_status" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

CREATE TYPE "lost_found_status" AS ENUM ('REPORTED', 'STORED', 'CLAIMED', 'DISPOSED');

-- ============================================
-- SHIFTS
-- ============================================

CREATE TABLE "housekeeping_shifts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "hotel_id" UUID NOT NULL,
  "shift_date" DATE NOT NULL,
  "start_time" TIMESTAMPTZ(6) NOT NULL,
  "end_time" TIMESTAMPTZ(6) NOT NULL,
  "status" "housekeeping_shift_status" NOT NULL DEFAULT 'PLANNED',
  "supervisor_id" UUID,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "housekeeping_shifts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_hks_hotel_date_status" ON "housekeeping_shifts"("hotel_id", "shift_date", "status");
CREATE INDEX "idx_hks_supervisor_date" ON "housekeeping_shifts"("hotel_id", "supervisor_id", "shift_date");

CREATE TABLE "housekeeping_shift_assignments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "hotel_id" UUID NOT NULL,
  "shift_id" UUID NOT NULL,
  "staff_id" UUID NOT NULL,
  "role" VARCHAR(40),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "housekeeping_shift_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_hkshift_staff" ON "housekeeping_shift_assignments"("shift_id", "staff_id");
CREATE INDEX "idx_hksa_hotel_staff" ON "housekeeping_shift_assignments"("hotel_id", "staff_id");
CREATE INDEX "idx_hksa_scope_shift" ON "housekeeping_shift_assignments"("organization_id", "hotel_id", "shift_id");

ALTER TABLE "housekeeping_shift_assignments"
ADD CONSTRAINT "housekeeping_shift_assignments_shift_id_fkey"
FOREIGN KEY ("shift_id") REFERENCES "housekeeping_shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================
-- LOST & FOUND
-- ============================================

CREATE TABLE "lost_found_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "hotel_id" UUID NOT NULL,
  "room_id" UUID,
  "item_name" VARCHAR(160) NOT NULL,
  "category" VARCHAR(80) NOT NULL,
  "description" TEXT,
  "location_found" VARCHAR(120) NOT NULL,
  "found_by" UUID NOT NULL,
  "found_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "lost_found_status" NOT NULL DEFAULT 'REPORTED',
  "storage_location" VARCHAR(120),
  "custody_notes" TEXT,
  "guest_id" UUID,
  "claimed_by_name" VARCHAR(180),
  "claimed_at" TIMESTAMPTZ(6),
  "disposed_at" TIMESTAMPTZ(6),
  "disposal_method" VARCHAR(120),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lost_found_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_lf_hotel_status_found" ON "lost_found_items"("hotel_id", "status", "found_at");
CREATE INDEX "idx_lf_hotel_room_found" ON "lost_found_items"("hotel_id", "room_id", "found_at");
CREATE INDEX "idx_lf_hotel_category" ON "lost_found_items"("hotel_id", "category");

ALTER TABLE "lost_found_items"
ADD CONSTRAINT "lost_found_items_room_id_fkey"
FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
