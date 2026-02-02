-- AlterTable
ALTER TABLE "hotels" ADD COLUMN     "last_modified_by_device" VARCHAR(255),
ALTER COLUMN "check_in_time" SET DEFAULT '15:00:00'::time,
ALTER COLUMN "check_out_time" SET DEFAULT '11:00:00'::time;

-- CreateTable
CREATE TABLE "sync_metadata" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "device_id" VARCHAR(255) NOT NULL,
    "resource_type" VARCHAR(100) NOT NULL,
    "last_synced_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_sync_version" BIGINT NOT NULL DEFAULT 0,
    "device_name" VARCHAR(200),
    "device_platform" VARCHAR(50),
    "app_version" VARCHAR(50),
    "sync_status" VARCHAR(50) NOT NULL DEFAULT 'IDLE',
    "last_error" TEXT,
    "last_error_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "global_version" BIGSERIAL NOT NULL,
    "organization_id" UUID NOT NULL,
    "hotel_id" UUID,
    "resource_type" VARCHAR(100) NOT NULL,
    "resource_id" UUID NOT NULL,
    "operation" VARCHAR(20) NOT NULL,
    "user_id" UUID,
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,
    "client_id" VARCHAR(255),
    "client_timestamp" TIMESTAMPTZ(6),
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "change_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offline_write_queue" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "device_id" VARCHAR(255) NOT NULL,
    "client_request_id" UUID NOT NULL,
    "operation" VARCHAR(50) NOT NULL,
    "resource_type" VARCHAR(100) NOT NULL,
    "resource_id" UUID,
    "command_payload" JSONB NOT NULL,
    "client_timestamp" TIMESTAMPTZ(6) NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(6),
    "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "conflict_resolution" JSONB,
    "server_resource_id" UUID,
    "server_version" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offline_write_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_conflicts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "resource_type" VARCHAR(100) NOT NULL,
    "resource_id" UUID NOT NULL,
    "user_id" UUID,
    "device_id" VARCHAR(255),
    "conflict_type" VARCHAR(50) NOT NULL,
    "client_state" JSONB NOT NULL,
    "server_state" JSONB NOT NULL,
    "resolved_state" JSONB,
    "resolution_strategy" VARCHAR(50),
    "resolved_by" UUID,
    "resolved_at" TIMESTAMPTZ(6),
    "detected_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "sync_conflicts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_sync_meta_user_device" ON "sync_metadata"("user_id", "device_id");

-- CreateIndex
CREATE INDEX "idx_sync_meta_resource" ON "sync_metadata"("resource_type", "last_synced_at");

-- CreateIndex
CREATE UNIQUE INDEX "sync_metadata_user_id_device_id_resource_type_key" ON "sync_metadata"("user_id", "device_id", "resource_type");

-- CreateIndex
CREATE INDEX "idx_change_log_version" ON "change_log"("global_version");

-- CreateIndex
CREATE INDEX "idx_change_log_org_version" ON "change_log"("organization_id", "global_version");

-- CreateIndex
CREATE INDEX "idx_change_log_resource" ON "change_log"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "idx_change_log_timestamp" ON "change_log"("timestamp" DESC);

-- CreateIndex
CREATE INDEX "idx_offline_queue_user" ON "offline_write_queue"("user_id", "status");

-- CreateIndex
CREATE INDEX "idx_offline_queue_device" ON "offline_write_queue"("device_id", "status");

-- CreateIndex
CREATE INDEX "idx_offline_queue_status" ON "offline_write_queue"("status", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "offline_write_queue_user_id_client_request_id_key" ON "offline_write_queue"("user_id", "client_request_id");

-- CreateIndex
CREATE INDEX "idx_conflict_org" ON "sync_conflicts"("organization_id", "detected_at" DESC);

-- CreateIndex
CREATE INDEX "idx_conflict_resource" ON "sync_conflicts"("resource_type", "resource_id");

-- AddForeignKey
ALTER TABLE "sync_metadata" ADD CONSTRAINT "sync_metadata_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_log" ADD CONSTRAINT "change_log_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_log" ADD CONSTRAINT "change_log_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_log" ADD CONSTRAINT "change_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_write_queue" ADD CONSTRAINT "offline_write_queue_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_conflicts" ADD CONSTRAINT "sync_conflicts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_conflicts" ADD CONSTRAINT "sync_conflicts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_conflicts" ADD CONSTRAINT "sync_conflicts_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
