-- CreateEnum
CREATE TYPE "reservation_status" AS ENUM ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW', 'WAITLIST');

-- CreateEnum
CREATE TYPE "check_in_status" AS ENUM ('NOT_CHECKED_IN', 'EARLY_CHECK_IN', 'CHECKED_IN', 'LATE_CHECK_OUT', 'CHECKED_OUT');

-- CreateEnum
CREATE TYPE "booking_source" AS ENUM ('DIRECT_WEB', 'DIRECT_PHONE', 'DIRECT_WALKIN', 'BOOKING_COM', 'EXPEDIA', 'AIRBNB', 'AGODA', 'TRIPADVISOR', 'CORPORATE', 'TRAVEL_AGENT', 'METASEARCH');

-- CreateEnum
CREATE TYPE "guarantee_type" AS ENUM ('CREDIT_CARD', 'DEPOSIT', 'COMPANY_BILL', 'TRAVEL_AGENT', 'NONE');

-- CreateEnum
CREATE TYPE "cancellation_policy" AS ENUM ('FLEXIBLE', 'MODERATE', 'STRICT', 'NON_REFUNDABLE');

-- CreateEnum
CREATE TYPE "guest_type" AS ENUM ('TRANSIENT', 'CORPORATE', 'GROUP', 'CONTRACTUAL', 'COMP', 'STAFF', 'FAMILY_FRIENDS');

-- CreateEnum
CREATE TYPE "vip_status" AS ENUM ('NONE', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'BLACK');

-- CreateEnum
CREATE TYPE "room_reservation_status" AS ENUM ('RESERVED', 'ASSIGNED', 'OCCUPIED', 'CHECKED_OUT', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "room_status" AS ENUM ('VACANT_CLEAN', 'VACANT_DIRTY', 'VACANT_CLEANING', 'OCCUPIED_CLEAN', 'OCCUPIED_DIRTY', 'OCCUPIED_CLEANING', 'OUT_OF_ORDER', 'RESERVED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "bed_type" AS ENUM ('SINGLE', 'DOUBLE', 'QUEEN', 'KING', 'TWIN', 'BUNK', 'SOFA_BED', 'CRIB');

-- CreateEnum
CREATE TYPE "maintenance_status" AS ENUM ('NONE', 'SCHEDULED', 'IN_PROGRESS', 'URGENT');

-- CreateEnum
CREATE TYPE "pricing_type" AS ENUM ('DAILY', 'PACKAGE', 'DERIVED', 'NEGOTIATED');

-- CreateEnum
CREATE TYPE "meal_plan" AS ENUM ('ROOM_ONLY', 'BREAKFAST', 'HALF_BOARD', 'FULL_BOARD', 'ALL_INCLUSIVE');

-- CreateEnum
CREATE TYPE "folio_item_type" AS ENUM ('ROOM_CHARGE', 'TAX', 'SERVICE_CHARGE', 'POS_CHARGE', 'MINIBAR', 'LAUNDRY', 'SPA', 'TRANSPORT', 'PHONE', 'ADJUSTMENT', 'DISCOUNT', 'PAYMENT', 'REFUND', 'NO_SHOW_FEE');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'CHECK', 'MOBILE_PAYMENT', 'GIFT_CARD', 'LOYALTY_POINTS', 'DIRECT_BILL', 'DEPOSIT');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'VOIDED');

-- CreateEnum
CREATE TYPE "invoice_status" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'OVERDUE', 'VOID', 'CREDIT_NOTE');

-- CreateEnum
CREATE TYPE "housekeeping_type" AS ENUM ('CLEANING_DEPARTURE', 'CLEANING_STAYOVER', 'CLEANING_TOUCHUP', 'DEEP_CLEAN', 'TURNDOWN_SERVICE', 'INSPECTION', 'SPECIAL_REQUEST');

-- CreateEnum
CREATE TYPE "housekeeping_status" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'ISSUES_REPORTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "maintenance_category" AS ENUM ('PLUMBING', 'ELECTRICAL', 'HVAC', 'FURNITURE', 'APPLIANCE', 'STRUCTURAL', 'PAINTING', 'CLEANING', 'SAFETY', 'IT_EQUIPMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "maintenance_priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "maintenance_request_status" AS ENUM ('REPORTED', 'ACKNOWLEDGED', 'SCHEDULED', 'IN_PROGRESS', 'PENDING_PARTS', 'COMPLETED', 'VERIFIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "inventory_category" AS ENUM ('ROOM_SUPPLIES', 'MINIBAR', 'CLEANING', 'FANDB', 'MAINTENANCE', 'OFFICE', 'UNIFORM', 'MARKETING', 'OTHER');

-- CreateEnum
CREATE TYPE "transaction_type" AS ENUM ('PURCHASE', 'CONSUMPTION', 'ADJUSTMENT', 'RETURN', 'TRANSFER', 'WASTE', 'OPENING');

-- CreateEnum
CREATE TYPE "purchase_order_status" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED', 'CLOSED');

-- CreateEnum
CREATE TYPE "communication_type" AS ENUM ('RESERVATION_CONFIRMATION', 'CHECKIN_REMINDER', 'CHECKOUT_REMINDER', 'MODIFICATION', 'CANCELLATION', 'WELCOME', 'SURVEY', 'MARKETING', 'ALERT');

-- CreateEnum
CREATE TYPE "communication_channel" AS ENUM ('EMAIL', 'SMS', 'WHATSAPP', 'PUSH');

-- CreateEnum
CREATE TYPE "communication_status" AS ENUM ('PENDING', 'QUEUED', 'SENT', 'DELIVERED', 'OPENED', 'FAILED', 'BOUNCED');

-- CreateEnum
CREATE TYPE "night_audit_status" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "pos_order_status" AS ENUM ('OPEN', 'CLOSED', 'PAID', 'VOID', 'COMPED');

-- AlterTable
ALTER TABLE "hotels" ALTER COLUMN "check_in_time" SET DEFAULT '15:00:00'::time,
ALTER COLUMN "check_out_time" SET DEFAULT '11:00:00'::time;

-- CreateTable
CREATE TABLE "guests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "hotel_id" UUID,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "mobile" VARCHAR(50),
    "date_of_birth" DATE,
    "nationality" CHAR(2),
    "language_code" CHAR(2) NOT NULL DEFAULT 'en',
    "id_type" VARCHAR(50),
    "id_number" VARCHAR(255),
    "id_expiry_date" DATE,
    "address_line1" VARCHAR(255),
    "address_line2" VARCHAR(255),
    "city" VARCHAR(100),
    "state_province" VARCHAR(100),
    "postal_code" VARCHAR(20),
    "countryCode" CHAR(2),
    "guest_type" "guest_type" NOT NULL DEFAULT 'TRANSIENT',
    "vip_status" "vip_status" NOT NULL DEFAULT 'NONE',
    "vip_reason" TEXT,
    "company_name" VARCHAR(255),
    "company_tax_id" VARCHAR(100),
    "room_preferences" JSONB,
    "dietary_requirements" TEXT,
    "special_needs" TEXT,
    "total_stays" INTEGER NOT NULL DEFAULT 0,
    "total_nights" INTEGER NOT NULL DEFAULT 0,
    "total_revenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "last_stay_date" DATE,
    "average_rate" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "marketing_consent" BOOLEAN NOT NULL DEFAULT false,
    "email_opt_in" BOOLEAN NOT NULL DEFAULT false,
    "sms_opt_in" BOOLEAN NOT NULL DEFAULT false,
    "internal_notes" TEXT,
    "alert_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "guests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "guest_id" UUID NOT NULL,
    "confirmation_number" VARCHAR(50) NOT NULL,
    "external_ref" VARCHAR(100),
    "source" "booking_source" NOT NULL DEFAULT 'DIRECT_WEB',
    "channel_code" VARCHAR(50),
    "agent_id" UUID,
    "corporate_code" VARCHAR(50),
    "check_in_date" DATE NOT NULL,
    "check_out_date" DATE NOT NULL,
    "arrival_time" TIME(6),
    "departure_time" TIME(6),
    "nights" INTEGER NOT NULL,
    "status" "reservation_status" NOT NULL DEFAULT 'CONFIRMED',
    "check_in_status" "check_in_status" NOT NULL DEFAULT 'NOT_CHECKED_IN',
    "adult_count" INTEGER NOT NULL DEFAULT 1,
    "child_count" INTEGER NOT NULL DEFAULT 0,
    "infant_count" INTEGER NOT NULL DEFAULT 0,
    "currency_code" CHAR(3) NOT NULL DEFAULT 'USD',
    "total_amount" DECIMAL(12,2) NOT NULL,
    "tax_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paid_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "rate_plan_id" UUID NOT NULL,
    "rate_breakdown" JSONB NOT NULL,
    "average_rate" DECIMAL(10,2) NOT NULL,
    "cancellation_policy" "cancellation_policy" NOT NULL DEFAULT 'FLEXIBLE',
    "guarantee_type" "guarantee_type" NOT NULL,
    "guarantee_amount" DECIMAL(10,2),
    "card_token" VARCHAR(255),
    "card_last_four" CHAR(4),
    "card_expiry_month" CHAR(2),
    "card_expiry_year" CHAR(4),
    "card_brand" VARCHAR(20),
    "guest_notes" TEXT,
    "special_requests" TEXT,
    "internal_notes" TEXT,
    "cancelled_at" TIMESTAMPTZ(6),
    "cancelled_by" UUID,
    "cancellation_reason" TEXT,
    "cancellation_fee" DECIMAL(10,2),
    "no_show" BOOLEAN NOT NULL DEFAULT false,
    "booked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "booked_by" UUID NOT NULL,
    "modified_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation_rooms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reservation_id" UUID NOT NULL,
    "room_id" UUID,
    "room_type_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(6),
    "assigned_by" UUID,
    "check_in_at" TIMESTAMPTZ(6),
    "check_out_at" TIMESTAMPTZ(6),
    "room_rate" DECIMAL(10,2) NOT NULL,
    "adult_count" INTEGER NOT NULL DEFAULT 2,
    "child_count" INTEGER NOT NULL DEFAULT 0,
    "status" "room_reservation_status" NOT NULL DEFAULT 'RESERVED',

    CONSTRAINT "reservation_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "base_occupancy" INTEGER NOT NULL DEFAULT 2,
    "max_occupancy" INTEGER NOT NULL DEFAULT 2,
    "max_adults" INTEGER NOT NULL DEFAULT 2,
    "max_children" INTEGER NOT NULL DEFAULT 0,
    "size_sqm" DECIMAL(5,2),
    "size_sqft" DECIMAL(6,2),
    "bed_types" "bed_type"[],
    "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "view_type" VARCHAR(50),
    "default_cleaning_time" INTEGER NOT NULL DEFAULT 30,
    "images" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_bookable" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "room_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "room_type_id" UUID NOT NULL,
    "room_number" VARCHAR(20) NOT NULL,
    "floor" INTEGER,
    "building" VARCHAR(50),
    "wing" VARCHAR(50),
    "status" "room_status" NOT NULL DEFAULT 'VACANT_CLEAN',
    "is_out_of_order" BOOLEAN NOT NULL DEFAULT false,
    "ooo_reason" TEXT,
    "ooo_from" DATE,
    "ooo_until" DATE,
    "is_smoking" BOOLEAN NOT NULL DEFAULT false,
    "is_accessible" BOOLEAN NOT NULL DEFAULT false,
    "viewType" VARCHAR(50),
    "last_cleaned_at" TIMESTAMPTZ(6),
    "cleaning_priority" INTEGER NOT NULL DEFAULT 0,
    "maintenance_status" "maintenance_status" NOT NULL DEFAULT 'NONE',
    "rack_rate" DECIMAL(10,2),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_inventory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "room_type_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "total_rooms" INTEGER NOT NULL,
    "out_of_order" INTEGER NOT NULL DEFAULT 0,
    "blocked" INTEGER NOT NULL DEFAULT 0,
    "sold" INTEGER NOT NULL DEFAULT 0,
    "available" INTEGER NOT NULL,
    "overbooking_limit" INTEGER NOT NULL DEFAULT 0,
    "stop_sell" BOOLEAN NOT NULL DEFAULT false,
    "min_stay" INTEGER,
    "max_stay" INTEGER,
    "closed_to_arrival" BOOLEAN NOT NULL DEFAULT false,
    "closed_to_departure" BOOLEAN NOT NULL DEFAULT false,
    "rate_override" DECIMAL(10,2),
    "reason" VARCHAR(255),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "room_type_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "pricing_type" "pricing_type" NOT NULL DEFAULT 'DAILY',
    "base_rate" DECIMAL(10,2) NOT NULL,
    "currency_code" CHAR(3) NOT NULL DEFAULT 'USD',
    "min_advance_days" INTEGER,
    "max_advance_days" INTEGER,
    "min_stay" INTEGER NOT NULL DEFAULT 1,
    "max_stay" INTEGER,
    "is_refundable" BOOLEAN NOT NULL DEFAULT true,
    "cancellation_policy" "cancellation_policy" NOT NULL DEFAULT 'FLEXIBLE',
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "channel_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "meal_plan" "meal_plan" NOT NULL DEFAULT 'ROOM_ONLY',
    "included_amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pricing_rules" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "valid_from" DATE,
    "valid_until" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "rate_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_overrides" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rate_plan_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "rate" DECIMAL(10,2) NOT NULL,
    "stop_sell" BOOLEAN NOT NULL DEFAULT false,
    "min_stay" INTEGER,
    "reason" VARCHAR(255),

    CONSTRAINT "rate_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folio_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "item_type" "folio_item_type" NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "tax_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "revenue_code" VARCHAR(20) NOT NULL,
    "department" VARCHAR(50) NOT NULL,
    "posted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "posted_by" UUID NOT NULL,
    "is_voided" BOOLEAN NOT NULL DEFAULT false,
    "voided_at" TIMESTAMPTZ(6),
    "voided_by" UUID,
    "void_reason" TEXT,
    "source" VARCHAR(50),
    "source_ref" VARCHAR(100),
    "business_date" DATE NOT NULL,

    CONSTRAINT "folio_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency_code" CHAR(3) NOT NULL DEFAULT 'USD',
    "method" "payment_method" NOT NULL,
    "status" "payment_status" NOT NULL DEFAULT 'PENDING',
    "card_last_four" CHAR(4),
    "card_brand" VARCHAR(20),
    "transaction_id" VARCHAR(100),
    "auth_code" VARCHAR(50),
    "processed_at" TIMESTAMPTZ(6),
    "parent_payment_id" UUID,
    "is_refund" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "invoice_number" VARCHAR(50) NOT NULL,
    "issue_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_date" DATE NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "tax_total" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "amount_paid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "invoice_status" NOT NULL DEFAULT 'OPEN',
    "bill_to_name" VARCHAR(255) NOT NULL,
    "bill_to_address" JSONB NOT NULL,
    "document_url" TEXT,
    "sent_at" TIMESTAMPTZ(6),
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "housekeeping_tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "task_type" "housekeeping_type" NOT NULL,
    "status" "housekeeping_status" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "assigned_to" UUID,
    "assigned_at" TIMESTAMPTZ(6),
    "scheduled_for" DATE NOT NULL,
    "estimated_minutes" INTEGER NOT NULL DEFAULT 30,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "verified_at" TIMESTAMPTZ(6),
    "verified_by" UUID,
    "inspection_score" INTEGER,
    "issues_found" TEXT,
    "notes" TEXT,
    "guest_requests" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,

    CONSTRAINT "housekeeping_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "room_id" UUID,
    "category" "maintenance_category" NOT NULL,
    "priority" "maintenance_priority" NOT NULL DEFAULT 'LOW',
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "reported_by" UUID NOT NULL,
    "reported_by_type" VARCHAR(20) NOT NULL,
    "reported_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_to" UUID,
    "assigned_at" TIMESTAMPTZ(6),
    "scheduled_for" TIMESTAMPTZ(6),
    "estimated_hours" DOUBLE PRECISION,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "resolution" TEXT,
    "parts_used" JSONB,
    "labor_cost" DECIMAL(10,2),
    "parts_cost" DECIMAL(10,2),
    "status" "maintenance_request_status" NOT NULL DEFAULT 'REPORTED',
    "room_out_of_order" BOOLEAN NOT NULL DEFAULT false,
    "ooo_until" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "sku" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "category" "inventory_category" NOT NULL,
    "unit_of_measure" VARCHAR(20) NOT NULL,
    "par_level" INTEGER NOT NULL,
    "reorder_point" INTEGER NOT NULL,
    "reorder_qty" INTEGER NOT NULL,
    "current_stock" INTEGER NOT NULL DEFAULT 0,
    "reserved_stock" INTEGER NOT NULL DEFAULT 0,
    "available_stock" INTEGER NOT NULL DEFAULT 0,
    "avg_unit_cost" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "last_unit_cost" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "track_expiry" BOOLEAN NOT NULL DEFAULT false,
    "track_batches" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "item_id" UUID NOT NULL,
    "type" "transaction_type" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_cost" DECIMAL(10,4),
    "total_cost" DECIMAL(10,2),
    "ref_type" VARCHAR(50),
    "ref_id" UUID,
    "notes" TEXT,
    "performed_by" UUID NOT NULL,
    "performed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "batch_number" VARCHAR(50),
    "expiry_date" DATE,

    CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "contact_person" VARCHAR(100),
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "address" JSONB,
    "payment_terms" VARCHAR(50),
    "currency_code" CHAR(3) NOT NULL DEFAULT 'USD',
    "tax_id" VARCHAR(100),
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "rating" INTEGER,
    "last_order_date" DATE,
    "total_orders" INTEGER NOT NULL DEFAULT 0,
    "total_spend" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "po_number" VARCHAR(50) NOT NULL,
    "status" "purchase_order_status" NOT NULL DEFAULT 'DRAFT',
    "order_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expected_delivery" DATE,
    "received_date" DATE,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "tax_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "shipping_cost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "requested_by" UUID NOT NULL,
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "po_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,4) NOT NULL,
    "total_price" DECIMAL(10,2) NOT NULL,
    "received_qty" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "hotel_id" UUID,
    "guest_id" UUID,
    "reservation_id" UUID,
    "type" "communication_type" NOT NULL,
    "channel" "communication_channel" NOT NULL,
    "direction" VARCHAR(10) NOT NULL,
    "subject" VARCHAR(255),
    "content" TEXT NOT NULL,
    "template_id" UUID,
    "status" "communication_status" NOT NULL DEFAULT 'PENDING',
    "sent_at" TIMESTAMPTZ(6),
    "delivered_at" TIMESTAMPTZ(6),
    "opened_at" TIMESTAMPTZ(6),
    "from_address" VARCHAR(255),
    "to_address" VARCHAR(255),
    "external_id" VARCHAR(100),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "night_audits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "business_date" DATE NOT NULL,
    "status" "night_audit_status" NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "performed_by" UUID,
    "unbalanced_folios" INTEGER NOT NULL DEFAULT 0,
    "unchecked_out_res" INTEGER NOT NULL DEFAULT 0,
    "pending_charges" INTEGER NOT NULL DEFAULT 0,
    "room_discrepancies" INTEGER NOT NULL DEFAULT 0,
    "room_revenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "other_revenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "payments_received" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "auto_posted_charges" INTEGER NOT NULL DEFAULT 0,
    "no_shows_marked" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "notes" TEXT,

    CONSTRAINT "night_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "reservation_id" UUID,
    "order_number" VARCHAR(50) NOT NULL,
    "outlet" VARCHAR(100) NOT NULL,
    "table_number" VARCHAR(20),
    "room_number" VARCHAR(20),
    "status" "pos_order_status" NOT NULL DEFAULT 'OPEN',
    "subtotal" DECIMAL(10,2) NOT NULL,
    "tax_total" DECIMAL(10,2) NOT NULL,
    "discount_total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "service_charge" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "payment_method" "payment_method",
    "paid_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "posted_to_room" BOOLEAN NOT NULL DEFAULT false,
    "posted_to_folio_at" TIMESTAMPTZ(6),
    "server_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ(6),

    CONSTRAINT "pos_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_order_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "item_name" VARCHAR(255) NOT NULL,
    "item_code" VARCHAR(50),
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "total_price" DECIMAL(10,2) NOT NULL,
    "modifications" TEXT,
    "special_instructions" TEXT,
    "is_voided" BOOLEAN NOT NULL DEFAULT false,
    "void_reason" TEXT,

    CONSTRAINT "pos_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_connections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "channel_code" VARCHAR(50) NOT NULL,
    "channel_name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "api_key" VARCHAR(255),
    "api_secret" VARCHAR(255),
    "property_id" VARCHAR(100),
    "rate_plan_mappings" JSONB NOT NULL DEFAULT '[]',
    "room_mappings" JSONB NOT NULL DEFAULT '[]',
    "last_sync_at" TIMESTAMPTZ(6),
    "last_sync_status" VARCHAR(20),
    "sync_errors" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_guest_name" ON "guests"("organization_id", "last_name", "first_name");

-- CreateIndex
CREATE INDEX "idx_guest_vip" ON "guests"("hotel_id", "vip_status");

-- CreateIndex
CREATE UNIQUE INDEX "guests_organization_id_email_key" ON "guests"("organization_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "reservations_confirmation_number_key" ON "reservations"("confirmation_number");

-- CreateIndex
CREATE INDEX "idx_res_hotel_dates" ON "reservations"("hotel_id", "check_in_date", "status");

-- CreateIndex
CREATE INDEX "idx_res_confirmation" ON "reservations"("hotel_id", "confirmation_number");

-- CreateIndex
CREATE INDEX "idx_res_guest" ON "reservations"("guest_id", "check_in_date" DESC);

-- CreateIndex
CREATE INDEX "idx_res_external" ON "reservations"("external_ref");

-- CreateIndex
CREATE INDEX "reservation_rooms_reservation_id_idx" ON "reservation_rooms"("reservation_id");

-- CreateIndex
CREATE INDEX "idx_resroom_room_dates" ON "reservation_rooms"("room_id", "check_in_at", "check_out_at");

-- CreateIndex
CREATE INDEX "idx_roomtype_active" ON "room_types"("hotel_id", "is_active", "is_bookable");

-- CreateIndex
CREATE UNIQUE INDEX "room_types_hotel_id_code_key" ON "room_types"("hotel_id", "code");

-- CreateIndex
CREATE INDEX "idx_room_status" ON "rooms"("hotel_id", "status");

-- CreateIndex
CREATE INDEX "idx_room_type_status" ON "rooms"("hotel_id", "room_type_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_hotel_id_room_number_key" ON "rooms"("hotel_id", "room_number");

-- CreateIndex
CREATE INDEX "idx_inventory_avail" ON "room_inventory"("room_type_id", "date", "available");

-- CreateIndex
CREATE UNIQUE INDEX "room_inventory_room_type_id_date_key" ON "room_inventory"("room_type_id", "date");

-- CreateIndex
CREATE INDEX "idx_rateplan_valid" ON "rate_plans"("hotel_id", "is_active", "valid_from", "valid_until");

-- CreateIndex
CREATE UNIQUE INDEX "rate_plans_hotel_id_code_key" ON "rate_plans"("hotel_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "rate_overrides_rate_plan_id_date_key" ON "rate_overrides"("rate_plan_id", "date");

-- CreateIndex
CREATE INDEX "idx_folio_res_posted" ON "folio_items"("reservation_id", "posted_at");

-- CreateIndex
CREATE INDEX "idx_folio_hotel_date" ON "folio_items"("hotel_id", "business_date");

-- CreateIndex
CREATE INDEX "idx_folio_type" ON "folio_items"("item_type", "posted_at");

-- CreateIndex
CREATE INDEX "idx_payment_res" ON "payments"("reservation_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_payment_trans" ON "payments"("transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "idx_invoice_hotel_date" ON "invoices"("hotel_id", "issue_date");

-- CreateIndex
CREATE INDEX "idx_hk_hotel_date_status" ON "housekeeping_tasks"("hotel_id", "scheduled_for", "status");

-- CreateIndex
CREATE INDEX "idx_hk_staff_status" ON "housekeeping_tasks"("assigned_to", "status");

-- CreateIndex
CREATE INDEX "idx_maint_hotel_status" ON "maintenance_requests"("hotel_id", "status", "priority");

-- CreateIndex
CREATE INDEX "idx_maint_room" ON "maintenance_requests"("room_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_hotel_id_sku_key" ON "inventory_items"("hotel_id", "sku");

-- CreateIndex
CREATE INDEX "idx_invtrans_item_date" ON "inventory_transactions"("item_id", "performed_at");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_hotel_id_code_key" ON "vendors"("hotel_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_po_number_key" ON "purchase_orders"("po_number");

-- CreateIndex
CREATE INDEX "idx_po_hotel_status" ON "purchase_orders"("hotel_id", "status");

-- CreateIndex
CREATE INDEX "idx_comm_guest" ON "communications"("guest_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_comm_res" ON "communications"("reservation_id");

-- CreateIndex
CREATE UNIQUE INDEX "night_audits_hotel_id_business_date_key" ON "night_audits"("hotel_id", "business_date");

-- CreateIndex
CREATE UNIQUE INDEX "pos_orders_order_number_key" ON "pos_orders"("order_number");

-- CreateIndex
CREATE INDEX "idx_pos_hotel_date" ON "pos_orders"("hotel_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "channel_connections_hotel_id_channel_code_key" ON "channel_connections"("hotel_id", "channel_code");

-- AddForeignKey
ALTER TABLE "guests" ADD CONSTRAINT "guests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guests" ADD CONSTRAINT "guests_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_rate_plan_id_fkey" FOREIGN KEY ("rate_plan_id") REFERENCES "rate_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_rooms" ADD CONSTRAINT "reservation_rooms_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_rooms" ADD CONSTRAINT "reservation_rooms_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_rooms" ADD CONSTRAINT "reservation_rooms_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_types" ADD CONSTRAINT "room_types_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_types" ADD CONSTRAINT "room_types_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_inventory" ADD CONSTRAINT "room_inventory_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_overrides" ADD CONSTRAINT "rate_overrides_rate_plan_id_fkey" FOREIGN KEY ("rate_plan_id") REFERENCES "rate_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folio_items" ADD CONSTRAINT "folio_items_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_order_items" ADD CONSTRAINT "pos_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "pos_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
