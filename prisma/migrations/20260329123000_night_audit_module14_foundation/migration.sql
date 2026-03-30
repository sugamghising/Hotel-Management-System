-- Module 14 Night Audit foundation fields and constraints

-- Hotel business-date state for night audit advance/rollback
ALTER TABLE "hotels"
ADD COLUMN "current_business_date" DATE NOT NULL DEFAULT CURRENT_DATE;

-- Reservation linkage for night-audit no-show rollback
ALTER TABLE "reservations"
ADD COLUMN "no_show_audit_id" UUID;

CREATE INDEX "idx_res_no_show_audit" ON "reservations"("no_show_audit_id");

-- Housekeeping batch linkage for deterministic rollback
ALTER TABLE "housekeeping_tasks"
ADD COLUMN "night_audit_batch_id" UUID;

CREATE INDEX "idx_hk_night_audit_batch" ON "housekeeping_tasks"("night_audit_batch_id");

-- Maintenance request linkage for deterministic rollback of generated tasks
ALTER TABLE "maintenance_requests"
ADD COLUMN "source_ref" VARCHAR(100);

CREATE INDEX "idx_maint_source_ref" ON "maintenance_requests"("source_ref");

-- Enforce single IN_PROGRESS night audit per hotel at DB level
CREATE UNIQUE INDEX "uq_night_audit_hotel_in_progress"
ON "night_audits"("hotel_id")
WHERE "status" = 'IN_PROGRESS';
