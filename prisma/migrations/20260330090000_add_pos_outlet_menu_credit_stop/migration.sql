-- AlterTable
ALTER TABLE "guests"
ADD COLUMN "is_credit_stopped" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "credit_stop_reason" TEXT;

-- CreateTable
CREATE TABLE "pos_outlets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "allow_room_posting" BOOLEAN NOT NULL DEFAULT true,
    "allow_direct_bill" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "open_time" TIME(6),
    "close_time" TIME(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_outlets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_menu_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "outlet_id" UUID NOT NULL,
    "sku" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(100) NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_menu_items_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "pos_orders"
ADD COLUMN "outlet_id" UUID;

-- Backfill existing order outlets from legacy outlet name.
INSERT INTO "pos_outlets" (
    "organization_id",
    "hotel_id",
    "code",
    "name",
    "allow_room_posting",
    "allow_direct_bill",
    "is_active"
)
SELECT DISTINCT
    p."organization_id",
    p."hotel_id",
    'LEGACY-' || SUBSTRING(md5(p."hotel_id"::text || ':' || lower(trim(p."outlet"))) FROM 1 FOR 8),
    p."outlet",
    true,
    true,
    true
FROM "pos_orders" p
WHERE p."outlet" IS NOT NULL
AND NOT EXISTS (
    SELECT 1
    FROM "pos_outlets" o
    WHERE o."hotel_id" = p."hotel_id"
      AND o."name" = p."outlet"
);

UPDATE "pos_orders" p
SET "outlet_id" = o."id"
FROM "pos_outlets" o
WHERE p."outlet_id" IS NULL
  AND p."hotel_id" = o."hotel_id"
  AND p."outlet" = o."name";

INSERT INTO "pos_outlets" (
    "organization_id",
    "hotel_id",
    "code",
    "name",
    "allow_room_posting",
    "allow_direct_bill",
    "is_active"
)
SELECT DISTINCT
    p."organization_id",
    p."hotel_id",
    'LEGACY-DEFAULT',
    'Legacy Outlet',
    true,
    true,
    true
FROM "pos_orders" p
WHERE p."outlet_id" IS NULL
AND NOT EXISTS (
    SELECT 1
    FROM "pos_outlets" o
    WHERE o."hotel_id" = p."hotel_id"
      AND o."code" = 'LEGACY-DEFAULT'
);

UPDATE "pos_orders" p
SET "outlet_id" = o."id"
FROM "pos_outlets" o
WHERE p."outlet_id" IS NULL
  AND p."hotel_id" = o."hotel_id"
  AND o."code" = 'LEGACY-DEFAULT';

ALTER TABLE "pos_orders"
ALTER COLUMN "outlet_id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "uq_pos_outlet_hotel_code" ON "pos_outlets"("hotel_id", "code");

-- CreateIndex
CREATE INDEX "idx_pos_outlet_hotel_active" ON "pos_outlets"("hotel_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "uq_pos_menu_hotel_sku" ON "pos_menu_items"("hotel_id", "sku");

-- CreateIndex
CREATE INDEX "idx_pos_menu_outlet_active" ON "pos_menu_items"("outlet_id", "is_active");

-- CreateIndex
CREATE INDEX "idx_pos_menu_hotel_category" ON "pos_menu_items"("hotel_id", "category");

-- CreateIndex
CREATE INDEX "idx_pos_outlet_date" ON "pos_orders"("outlet_id", "created_at");

-- AddForeignKey
ALTER TABLE "pos_outlets" ADD CONSTRAINT "pos_outlets_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_menu_items" ADD CONSTRAINT "pos_menu_items_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_menu_items" ADD CONSTRAINT "pos_menu_items_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "pos_outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "pos_outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
