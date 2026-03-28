-- Phase 1 housekeeping foundations: DND status, inspection model, outbox, and task enrichment.

-- ============================================
-- ENUMS
-- ============================================

ALTER TYPE "housekeeping_status" ADD VALUE IF NOT EXISTS 'DND';

CREATE TYPE "housekeeping_inspection_outcome" AS ENUM ('PASSED', 'FAILED');

CREATE TYPE "outbox_event_status" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'DEAD_LETTER');

-- ============================================
-- RESERVATIONS
-- ============================================

ALTER TABLE "reservations"
ADD COLUMN "decline_housekeeping" BOOLEAN NOT NULL DEFAULT false;

-- ============================================
-- HOUSEKEEPING TASKS
-- ============================================

ALTER TABLE "housekeeping_tasks"
ADD COLUMN "actual_minutes" INTEGER,
ADD COLUMN "completion_notes" TEXT,
ADD COLUMN "completion_photos" JSONB,
ADD COLUMN "supplies_used" JSONB,
ADD COLUMN "dnd_at" TIMESTAMPTZ(6),
ADD COLUMN "dnd_by" UUID,
ADD COLUMN "dnd_reason" TEXT,
ADD COLUMN "cancelled_at" TIMESTAMPTZ(6),
ADD COLUMN "cancelled_by" UUID,
ADD COLUMN "cancellation_reason" TEXT;

CREATE INDEX "idx_hk_room_date_type" ON "housekeeping_tasks"("hotel_id", "room_id", "scheduled_for", "task_type");

-- ============================================
-- HOUSEKEEPING INSPECTIONS
-- ============================================

CREATE TABLE "housekeeping_inspections" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "hotel_id" UUID NOT NULL,
  "task_id" UUID NOT NULL,
  "room_id" UUID NOT NULL,
  "staff_id" UUID,
  "inspected_by" UUID NOT NULL,
  "scores" JSONB NOT NULL,
  "overall_score" INTEGER NOT NULL,
  "outcome" "housekeeping_inspection_outcome" NOT NULL,
  "auto_failed" BOOLEAN NOT NULL DEFAULT false,
  "failure_items" JSONB,
  "feedback_to_staff" TEXT,
  "requires_maintenance" BOOLEAN NOT NULL DEFAULT false,
  "maintenance_request_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "housekeeping_inspections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_hki_hotel_created" ON "housekeeping_inspections"("hotel_id", "created_at");
CREATE INDEX "idx_hki_task_created" ON "housekeeping_inspections"("task_id", "created_at");
CREATE INDEX "idx_hki_staff_created" ON "housekeeping_inspections"("staff_id", "created_at");
CREATE INDEX "idx_hki_room_created" ON "housekeeping_inspections"("room_id", "created_at");

ALTER TABLE "housekeeping_inspections"
ADD CONSTRAINT "housekeeping_inspections_task_id_fkey"
FOREIGN KEY ("task_id") REFERENCES "housekeeping_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "housekeeping_inspections"
ADD CONSTRAINT "housekeeping_inspections_room_id_fkey"
FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================
-- OUTBOX EVENTS
-- ============================================

CREATE TABLE "outbox_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "event_type" VARCHAR(120) NOT NULL,
  "aggregate_type" VARCHAR(80) NOT NULL,
  "aggregate_id" UUID NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "outbox_event_status" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 8,
  "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_error" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMPTZ(6),
  CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_outbox_status_next" ON "outbox_events"("status", "next_attempt_at");
CREATE INDEX "idx_outbox_type_created" ON "outbox_events"("event_type", "created_at");
CREATE INDEX "idx_outbox_aggregate" ON "outbox_events"("aggregate_type", "aggregate_id");
