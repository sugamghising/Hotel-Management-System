-- Module 11 Phase 1: check-in/check-out records and assignment history foundation.

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE "assignment_type" AS ENUM ('INITIAL', 'AUTO', 'MANUAL', 'UPGRADE', 'CHANGE', 'WALK_IN');

-- ============================================
-- CHECK-IN RECORDS
-- ============================================

CREATE TABLE "check_in_records" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "hotel_id" UUID NOT NULL,
  "reservation_id" UUID NOT NULL,
  "reservation_room_id" UUID,
  "room_id" UUID NOT NULL,
  "assignment_type" "assignment_type" NOT NULL DEFAULT 'INITIAL',
  "early_check_in" BOOLEAN NOT NULL DEFAULT false,
  "pre_auth_amount" DECIMAL(10,2),
  "keys_issued" INTEGER NOT NULL DEFAULT 1,
  "key_card_ref" VARCHAR(100),
  "id_document_id" UUID,
  "notes" TEXT,
  "checked_in_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "checked_in_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "check_in_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_checkin_scope_time" ON "check_in_records"("organization_id", "hotel_id", "checked_in_at" DESC);
CREATE INDEX "idx_checkin_res_time" ON "check_in_records"("reservation_id", "checked_in_at" DESC);
CREATE INDEX "idx_checkin_room_time" ON "check_in_records"("room_id", "checked_in_at" DESC);

ALTER TABLE "check_in_records"
ADD CONSTRAINT "check_in_records_reservation_id_fkey"
FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "check_in_records"
ADD CONSTRAINT "check_in_records_room_id_fkey"
FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================
-- CHECK-OUT RECORDS
-- ============================================

CREATE TABLE "check_out_records" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "hotel_id" UUID NOT NULL,
  "reservation_id" UUID NOT NULL,
  "reservation_room_id" UUID,
  "room_id" UUID NOT NULL,
  "late_check_out" BOOLEAN NOT NULL DEFAULT false,
  "late_fee_amount" DECIMAL(10,2),
  "final_balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "settlement_amount" DECIMAL(10,2),
  "payment_method" "payment_method",
  "invoice_id" UUID,
  "keys_returned" INTEGER,
  "satisfaction_score" INTEGER,
  "notes" TEXT,
  "checked_out_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "checked_out_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "check_out_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "check_out_records_satisfaction_score_check" CHECK (
    "satisfaction_score" IS NULL OR ("satisfaction_score" >= 1 AND "satisfaction_score" <= 5)
  )
);

CREATE INDEX "idx_checkout_scope_time" ON "check_out_records"("organization_id", "hotel_id", "checked_out_at" DESC);
CREATE INDEX "idx_checkout_res_time" ON "check_out_records"("reservation_id", "checked_out_at" DESC);
CREATE INDEX "idx_checkout_room_time" ON "check_out_records"("room_id", "checked_out_at" DESC);

ALTER TABLE "check_out_records"
ADD CONSTRAINT "check_out_records_reservation_id_fkey"
FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "check_out_records"
ADD CONSTRAINT "check_out_records_room_id_fkey"
FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================
-- ROOM ASSIGNMENT HISTORY
-- ============================================

CREATE TABLE "room_assignments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "hotel_id" UUID NOT NULL,
  "reservation_id" UUID NOT NULL,
  "reservation_room_id" UUID,
  "room_id" UUID NOT NULL,
  "assignment_type" "assignment_type" NOT NULL DEFAULT 'MANUAL',
  "previous_room_id" UUID,
  "reason" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assigned_by" UUID,
  "released_at" TIMESTAMPTZ(6),
  "notes" TEXT,
  CONSTRAINT "room_assignments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_room_assign_scope_time" ON "room_assignments"("organization_id", "hotel_id", "assigned_at" DESC);
CREATE INDEX "idx_room_assign_res_active" ON "room_assignments"("reservation_id", "is_active", "assigned_at" DESC);
CREATE INDEX "idx_room_assign_room_active" ON "room_assignments"("room_id", "is_active");

ALTER TABLE "room_assignments"
ADD CONSTRAINT "room_assignments_reservation_id_fkey"
FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "room_assignments"
ADD CONSTRAINT "room_assignments_room_id_fkey"
FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
