/*
  Warnings:

  - You are about to drop the column `currency` on the `hotels` table. All the data in the column will be lost.
  - You are about to alter the column `name` on the `hotels` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `code` on the `hotels` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `timezone` on the `hotels` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - The `status` column on the `hotels` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `status` on the `organizations` table. All the data in the column will be lost.
  - You are about to alter the column `name` on the `organizations` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `legal_name` on the `organizations` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `email` on the `organizations` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `phone` on the `organizations` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to drop the column `key` on the `permissions` table. All the data in the column will be lost.
  - You are about to drop the column `scope` on the `roles` table. All the data in the column will be lost.
  - You are about to alter the column `name` on the `roles` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - The primary key for the `user_roles` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `hotel_id` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `user_type` on the `users` table. All the data in the column will be lost.
  - You are about to alter the column `email` on the `users` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `password_hash` on the `users` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `first_name` on the `users` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `last_name` on the `users` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `phone` on the `users` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - The `status` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `auth_sessions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `hotel_branches` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[organization_id,code]` on the table `hotels` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[code]` on the table `organizations` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[code]` on the table `permissions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organization_id,code]` on the table `roles` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[user_id,role_id,hotel_id]` on the table `user_roles` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organization_id,email]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `address_line1` to the `hotels` table without a default value. This is not possible if the table is not empty.
  - Added the required column `city` to the `hotels` table without a default value. This is not possible if the table is not empty.
  - Added the required column `country_code` to the `hotels` table without a default value. This is not possible if the table is not empty.
  - Added the required column `email` to the `hotels` table without a default value. This is not possible if the table is not empty.
  - Added the required column `phone` to the `hotels` table without a default value. This is not possible if the table is not empty.
  - Added the required column `postal_code` to the `hotels` table without a default value. This is not possible if the table is not empty.
  - Added the required column `code` to the `organizations` table without a default value. This is not possible if the table is not empty.
  - Made the column `legal_name` on table `organizations` required. This step will fail if there are existing NULL values in that column.
  - Made the column `email` on table `organizations` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `code` to the `permissions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `display_name` to the `permissions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `code` to the `roles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `user_roles` table without a default value. This is not possible if the table is not empty.
  - Made the column `first_name` on table `users` required. This step will fail if there are existing NULL values in that column.
  - Made the column `last_name` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "organization_type" AS ENUM ('CHAIN', 'INDEPENDENT');

-- CreateEnum
CREATE TYPE "subscription_tier" AS ENUM ('TRIAL', 'BASIC', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION');

-- CreateEnum
CREATE TYPE "employment_type" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'SEASONAL');

-- CreateEnum
CREATE TYPE "property_type" AS ENUM ('HOTEL', 'RESORT', 'MOTEL', 'HOSTEL', 'APARTMENT', 'VILLA', 'BNB');

-- CreateEnum
CREATE TYPE "hotel_status" AS ENUM ('ACTIVE', 'INACTIVE', 'UNDER_CONSTRUCTION', 'MAINTENANCE', 'CLOSED');

-- CreateEnum
CREATE TYPE "audit_risk_level" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- DropForeignKey
ALTER TABLE "auth_sessions" DROP CONSTRAINT "auth_sessions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "hotel_branches" DROP CONSTRAINT "hotel_branches_hotel_id_fkey";

-- DropForeignKey
ALTER TABLE "role_permissions" DROP CONSTRAINT "role_permissions_permission_id_fkey";

-- DropForeignKey
ALTER TABLE "role_permissions" DROP CONSTRAINT "role_permissions_role_id_fkey";

-- DropForeignKey
ALTER TABLE "roles" DROP CONSTRAINT "roles_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_hotel_id_fkey";

-- DropForeignKey
ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_role_id_fkey";

-- DropForeignKey
ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_user_id_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_hotel_id_fkey";

-- DropIndex
DROP INDEX "hotels_code_key";

-- DropIndex
DROP INDEX "hotels_organization_id_status_idx";

-- DropIndex
DROP INDEX "organizations_status_idx";

-- DropIndex
DROP INDEX "permissions_key_key";

-- DropIndex
DROP INDEX "roles_organization_id_name_key";

-- DropIndex
DROP INDEX "roles_scope_idx";

-- DropIndex
DROP INDEX "user_roles_user_id_hotel_id_idx";

-- DropIndex
DROP INDEX "users_email_key";

-- DropIndex
DROP INDEX "users_hotel_id_idx";

-- DropIndex
DROP INDEX "users_hotel_id_status_idx";

-- DropIndex
DROP INDEX "users_organization_id_status_idx";

-- AlterTable
ALTER TABLE "hotels" DROP COLUMN "currency",
ADD COLUMN     "address_line1" VARCHAR(255) NOT NULL,
ADD COLUMN     "address_line2" VARCHAR(255),
ADD COLUMN     "amenities" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "brand" VARCHAR(100),
ADD COLUMN     "check_in_time" TIME(6) NOT NULL DEFAULT '15:00:00'::time,
ADD COLUMN     "check_out_time" TIME(6) NOT NULL DEFAULT '11:00:00'::time,
ADD COLUMN     "city" VARCHAR(100) NOT NULL,
ADD COLUMN     "closing_date" DATE,
ADD COLUMN     "country_code" CHAR(2) NOT NULL,
ADD COLUMN     "created_by" UUID,
ADD COLUMN     "currency_code" CHAR(3) NOT NULL DEFAULT 'USD',
ADD COLUMN     "default_language" CHAR(2) NOT NULL DEFAULT 'en',
ADD COLUMN     "deleted_by" UUID,
ADD COLUMN     "email" VARCHAR(255) NOT NULL,
ADD COLUMN     "fax" VARCHAR(50),
ADD COLUMN     "latitude" DECIMAL(10,8),
ADD COLUMN     "legal_name" VARCHAR(255),
ADD COLUMN     "longitude" DECIMAL(11,8),
ADD COLUMN     "opening_date" DATE,
ADD COLUMN     "operational_settings" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "phone" VARCHAR(50) NOT NULL,
ADD COLUMN     "policies" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "postal_code" VARCHAR(20) NOT NULL,
ADD COLUMN     "property_type" "property_type" NOT NULL DEFAULT 'HOTEL',
ADD COLUMN     "star_rating" DECIMAL(2,1),
ADD COLUMN     "state_province" VARCHAR(100),
ADD COLUMN     "total_floors" INTEGER,
ADD COLUMN     "total_rooms" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updated_by" UUID,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "website" VARCHAR(255),
ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
ALTER COLUMN "name" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "code" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "timezone" SET DEFAULT 'UTC',
ALTER COLUMN "timezone" SET DATA TYPE VARCHAR(50),
DROP COLUMN "status",
ADD COLUMN     "status" "hotel_status" NOT NULL DEFAULT 'ACTIVE',
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "organizations" DROP COLUMN "status",
ADD COLUMN     "code" VARCHAR(50) NOT NULL,
ADD COLUMN     "created_by" UUID,
ADD COLUMN     "deleted_by" UUID,
ADD COLUMN     "enabled_features" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "logo_url" TEXT,
ADD COLUMN     "max_hotels" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "max_rooms" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "max_users" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "organization_type" "organization_type" NOT NULL DEFAULT 'INDEPENDENT',
ADD COLUMN     "settings" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "subscription_end_date" TIMESTAMPTZ(6),
ADD COLUMN     "subscription_start_date" TIMESTAMPTZ(6),
ADD COLUMN     "subscription_status" "subscription_status" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "subscription_tier" "subscription_tier" NOT NULL DEFAULT 'TRIAL',
ADD COLUMN     "tax_id" VARCHAR(100),
ADD COLUMN     "updated_by" UUID,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "website" VARCHAR(255),
ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
ALTER COLUMN "name" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "legal_name" SET NOT NULL,
ALTER COLUMN "legal_name" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "email" SET NOT NULL,
ALTER COLUMN "email" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "phone" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "permissions" DROP COLUMN "key",
ADD COLUMN     "category" VARCHAR(50),
ADD COLUMN     "code" VARCHAR(100) NOT NULL,
ADD COLUMN     "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "display_name" VARCHAR(200) NOT NULL,
ADD COLUMN     "is_system" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "role_permissions" ADD COLUMN     "granted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "granted_by" UUID;

-- AlterTable
ALTER TABLE "roles" DROP COLUMN "scope",
ADD COLUMN     "code" VARCHAR(100) NOT NULL,
ADD COLUMN     "created_by" UUID,
ADD COLUMN     "deleted_by" UUID,
ADD COLUMN     "is_system" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "settings" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "updated_by" UUID,
ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
ALTER COLUMN "name" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_pkey",
ADD COLUMN     "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "assigned_by" UUID,
ADD COLUMN     "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "expires_at" TIMESTAMPTZ(6),
ADD COLUMN     "id" UUID NOT NULL DEFAULT gen_random_uuid(),
ADD COLUMN     "organization_id" UUID NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "hotel_id" DROP NOT NULL,
ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "users" DROP COLUMN "hotel_id",
DROP COLUMN "user_type",
ADD COLUMN     "avatar_url" TEXT,
ADD COLUMN     "created_by" UUID,
ADD COLUMN     "date_of_birth" DATE,
ADD COLUMN     "deleted_by" UUID,
ADD COLUMN     "department" VARCHAR(100),
ADD COLUMN     "display_name" VARCHAR(200),
ADD COLUMN     "email_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "email_verified_at" TIMESTAMPTZ(6),
ADD COLUMN     "employee_id" VARCHAR(50),
ADD COLUMN     "employment_type" "employment_type",
ADD COLUMN     "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "gender" VARCHAR(20),
ADD COLUMN     "hire_date" DATE,
ADD COLUMN     "is_super_admin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "job_title" VARCHAR(100),
ADD COLUMN     "language_code" CHAR(2) NOT NULL DEFAULT 'en',
ADD COLUMN     "last_login_ip" INET,
ADD COLUMN     "locked_until" TIMESTAMPTZ(6),
ADD COLUMN     "manager_id" UUID,
ADD COLUMN     "mfa_backup_codes" JSONB,
ADD COLUMN     "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mfa_secret" VARCHAR(255),
ADD COLUMN     "middle_name" VARCHAR(100),
ADD COLUMN     "password_changed_at" TIMESTAMPTZ(6),
ADD COLUMN     "password_reset_expires" TIMESTAMPTZ(6),
ADD COLUMN     "password_reset_token" VARCHAR(255),
ADD COLUMN     "phone_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phone_verified_at" TIMESTAMPTZ(6),
ADD COLUMN     "preferences" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "termination_date" DATE,
ADD COLUMN     "timezone" VARCHAR(50) NOT NULL DEFAULT 'UTC',
ADD COLUMN     "updated_by" UUID,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
ALTER COLUMN "email" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "password_hash" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "first_name" SET NOT NULL,
ALTER COLUMN "first_name" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "last_name" SET NOT NULL,
ALTER COLUMN "last_name" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "phone" SET DATA TYPE VARCHAR(50),
DROP COLUMN "status",
ADD COLUMN     "status" "user_status" NOT NULL DEFAULT 'PENDING_VERIFICATION',
ALTER COLUMN "last_login_at" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMPTZ(6);

-- DropTable
DROP TABLE "auth_sessions";

-- DropTable
DROP TABLE "hotel_branches";

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),
    "replaced_by_id" UUID,
    "ip_address" INET,
    "user_agent" TEXT,
    "device_fingerprint" VARCHAR(255),
    "device_name" VARCHAR(100),
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "hotel_id" UUID,
    "user_id" UUID,
    "user_email" VARCHAR(255),
    "user_role" VARCHAR(100),
    "action" VARCHAR(100) NOT NULL,
    "resource_type" VARCHAR(100) NOT NULL,
    "resource_id" UUID,
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" INET,
    "user_agent" TEXT,
    "changes" JSONB,
    "metadata" JSONB,
    "risk_level" "audit_risk_level" NOT NULL DEFAULT 'LOW',
    "is_sensitive" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_refresh_token_user" ON "refresh_tokens"("user_id", "expires_at" DESC);

-- CreateIndex
CREATE INDEX "idx_refresh_token_expires" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "idx_refresh_token_device" ON "refresh_tokens"("user_id", "device_fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_user_id_token_hash_key" ON "refresh_tokens"("user_id", "token_hash");

-- CreateIndex
CREATE INDEX "idx_audit_org_time" ON "audit_logs"("organization_id", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "idx_audit_user_time" ON "audit_logs"("user_id", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "idx_audit_resource" ON "audit_logs"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "idx_audit_risk" ON "audit_logs"("risk_level", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "idx_audit_action" ON "audit_logs"("action", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "idx_hotel_status" ON "hotels"("status");

-- CreateIndex
CREATE INDEX "idx_hotel_org" ON "hotels"("organization_id");

-- CreateIndex
CREATE INDEX "idx_hotel_country" ON "hotels"("country_code");

-- CreateIndex
CREATE UNIQUE INDEX "hotels_organization_id_code_key" ON "hotels"("organization_id", "code");

-- CreateIndex
CREATE INDEX "idx_org_subscription_status" ON "organizations"("subscription_status");

-- CreateIndex
CREATE INDEX "idx_org_created_at" ON "organizations"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_org_code" ON "organizations"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "idx_permission_category" ON "permissions"("category");

-- CreateIndex
CREATE INDEX "idx_role_perm_role" ON "role_permissions"("role_id");

-- CreateIndex
CREATE INDEX "idx_role_perm_permission" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE INDEX "idx_role_org" ON "roles"("organization_id");

-- CreateIndex
CREATE INDEX "idx_role_system" ON "roles"("is_system", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_organization_id_code_key" ON "roles"("organization_id", "code");

-- CreateIndex
CREATE INDEX "idx_user_roles_user" ON "user_roles"("user_id");

-- CreateIndex
CREATE INDEX "idx_user_roles_role" ON "user_roles"("role_id");

-- CreateIndex
CREATE INDEX "idx_user_roles_hotel" ON "user_roles"("hotel_id");

-- CreateIndex
CREATE INDEX "idx_user_roles_org" ON "user_roles"("organization_id");

-- CreateIndex
CREATE INDEX "idx_user_roles_active" ON "user_roles"("user_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_hotel_id_key" ON "user_roles"("user_id", "role_id", "hotel_id");

-- CreateIndex
CREATE INDEX "idx_user_org" ON "users"("organization_id");

-- CreateIndex
CREATE INDEX "idx_user_employee_id" ON "users"("employee_id", "organization_id");

-- CreateIndex
CREATE INDEX "idx_user_status" ON "users"("status");

-- CreateIndex
CREATE INDEX "idx_user_super_admin" ON "users"("is_super_admin");

-- CreateIndex
CREATE UNIQUE INDEX "users_organization_id_email_key" ON "users"("organization_id", "email");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_replaced_by_id_fkey" FOREIGN KEY ("replaced_by_id") REFERENCES "refresh_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
