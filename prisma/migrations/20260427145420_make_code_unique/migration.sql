-- AlterTable
ALTER TABLE "hotels" ALTER COLUMN "check_in_time" SET DEFAULT '15:00:00'::time,
ALTER COLUMN "check_out_time" SET DEFAULT '11:00:00'::time;

-- AddForeignKey
ALTER TABLE "channel_connections" ADD CONSTRAINT "channel_connections_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "uq_org_code" RENAME TO "organizations_code_key";
