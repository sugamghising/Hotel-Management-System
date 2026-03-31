-- DropForeignKey
ALTER TABLE "lost_found_items" DROP CONSTRAINT "lost_found_items_room_id_fkey";

-- AlterTable
ALTER TABLE "communications" ADD COLUMN     "scheduled_for" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "hotels" ALTER COLUMN "check_in_time" SET DEFAULT '15:00:00'::time,
ALTER COLUMN "check_out_time" SET DEFAULT '11:00:00'::time,
ALTER COLUMN "current_business_date" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "communication_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "hotel_id" UUID,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" "communication_type" NOT NULL,
    "channel" "communication_channel" NOT NULL,
    "subject" VARCHAR(255),
    "body_template" TEXT NOT NULL,
    "language" CHAR(2) NOT NULL DEFAULT 'en',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communication_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_template_type_channel" ON "communication_templates"("organization_id", "type", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "communication_templates_organization_id_code_channel_langua_key" ON "communication_templates"("organization_id", "code", "channel", "language");

-- CreateIndex
CREATE INDEX "idx_comm_scheduled" ON "communications"("status", "scheduled_for");

-- AddForeignKey
ALTER TABLE "lost_found_items" ADD CONSTRAINT "lost_found_items_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "communication_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_templates" ADD CONSTRAINT "communication_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_templates" ADD CONSTRAINT "communication_templates_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "uq_asset_hotel_tag" RENAME TO "assets_hotel_id_asset_tag_key";

-- RenameIndex
ALTER INDEX "uq_hkshift_staff" RENAME TO "housekeeping_shift_assignments_shift_id_staff_id_key";

-- RenameIndex
ALTER INDEX "uq_pos_menu_hotel_sku" RENAME TO "pos_menu_items_hotel_id_sku_key";

-- RenameIndex
ALTER INDEX "uq_pos_outlet_hotel_code" RENAME TO "pos_outlets_hotel_id_code_key";
