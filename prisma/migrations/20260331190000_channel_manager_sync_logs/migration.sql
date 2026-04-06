-- CreateTable
CREATE TABLE "channel_sync_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "connection_id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "sync_type" VARCHAR(50) NOT NULL,
    "direction" VARCHAR(10) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),
    "records_processed" INTEGER NOT NULL DEFAULT 0,
    "records_failed" INTEGER NOT NULL DEFAULT 0,
    "error_details" JSONB,
    "triggered_by" VARCHAR(50) NOT NULL,
    CONSTRAINT "channel_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "channel_sync_logs_connection_id_started_at_idx"
ON "channel_sync_logs"("connection_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "channel_sync_logs_hotel_id_started_at_idx"
ON "channel_sync_logs"("hotel_id", "started_at" DESC);

-- AddForeignKey
ALTER TABLE "channel_sync_logs"
ADD CONSTRAINT "channel_sync_logs_connection_id_fkey"
FOREIGN KEY ("connection_id") REFERENCES "channel_connections"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_sync_logs"
ADD CONSTRAINT "channel_sync_logs_hotel_id_fkey"
FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
