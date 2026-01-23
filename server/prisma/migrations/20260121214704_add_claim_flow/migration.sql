-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "account_status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "claimed_at" TIMESTAMP(3),
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'organic',
ALTER COLUMN "password_hash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "verification_codes" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "verification_codes_customer_id_type_idx" ON "verification_codes"("customer_id", "type");

-- AddForeignKey
ALTER TABLE "verification_codes" ADD CONSTRAINT "verification_codes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
