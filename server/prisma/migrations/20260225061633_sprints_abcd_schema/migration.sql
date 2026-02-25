-- AlterTable
ALTER TABLE "dogs" ADD COLUMN     "allergies" TEXT,
ADD COLUMN     "emergency_vet_name" TEXT,
ADD COLUMN     "emergency_vet_phone" TEXT,
ADD COLUMN     "last_groom_date" DATE,
ADD COLUMN     "special_needs" TEXT;

-- AlterTable
ALTER TABLE "vaccinations" ADD COLUMN     "cloudinary_public_id" TEXT;

-- CreateTable
CREATE TABLE "grooming_service_prices" (
    "id" TEXT NOT NULL,
    "sub_service_id" TEXT NOT NULL,
    "size_category" TEXT,
    "price_cents" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "grooming_service_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grooming_add_ons" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "price_cents" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "grooming_add_ons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_add_ons" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "add_on_id" TEXT NOT NULL,
    "price_cents" INTEGER NOT NULL,

    CONSTRAINT "booking_add_ons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_agreements" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "required_for" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agreement_signatures" (
    "id" TEXT NOT NULL,
    "agreement_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "typed_name" TEXT NOT NULL,
    "agreed_to_terms" BOOLEAN NOT NULL DEFAULT true,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "signed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agreement_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boarding_details" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "feeding_schedule" TEXT,
    "food_type" TEXT,
    "food_brand" TEXT,
    "feeding_notes" TEXT,
    "drop_off_time" TEXT,
    "pick_up_time" TEXT,
    "special_items" TEXT,
    "emergency_contact" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "boarding_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_badges" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "badge" TEXT NOT NULL,
    "earned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "customer_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aim_insights" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "data" JSONB,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aim_insights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "grooming_service_prices_sub_service_id_size_category_key" ON "grooming_service_prices"("sub_service_id", "size_category");

-- CreateIndex
CREATE UNIQUE INDEX "grooming_add_ons_name_key" ON "grooming_add_ons"("name");

-- CreateIndex
CREATE UNIQUE INDEX "booking_add_ons_booking_id_add_on_id_key" ON "booking_add_ons"("booking_id", "add_on_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_agreements_name_key" ON "service_agreements"("name");

-- CreateIndex
CREATE INDEX "agreement_signatures_customer_id_agreement_id_idx" ON "agreement_signatures"("customer_id", "agreement_id");

-- CreateIndex
CREATE UNIQUE INDEX "boarding_details_booking_id_key" ON "boarding_details"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_badges_customer_id_badge_key" ON "customer_badges"("customer_id", "badge");

-- CreateIndex
CREATE INDEX "aim_insights_type_expires_at_idx" ON "aim_insights"("type", "expires_at");

-- AddForeignKey
ALTER TABLE "grooming_service_prices" ADD CONSTRAINT "grooming_service_prices_sub_service_id_fkey" FOREIGN KEY ("sub_service_id") REFERENCES "grooming_sub_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_add_ons" ADD CONSTRAINT "booking_add_ons_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_add_ons" ADD CONSTRAINT "booking_add_ons_add_on_id_fkey" FOREIGN KEY ("add_on_id") REFERENCES "grooming_add_ons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_signatures" ADD CONSTRAINT "agreement_signatures_agreement_id_fkey" FOREIGN KEY ("agreement_id") REFERENCES "service_agreements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_signatures" ADD CONSTRAINT "agreement_signatures_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boarding_details" ADD CONSTRAINT "boarding_details_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_badges" ADD CONSTRAINT "customer_badges_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

