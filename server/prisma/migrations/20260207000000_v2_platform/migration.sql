-- V2 Platform Migration
-- Captures all schema changes since the claim_flow migration.
-- Uses IF NOT EXISTS / DO blocks for idempotency (safe on already-pushed databases).

-- Enrich customers table
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "gingr_owner_id" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "sms_deals_opted_out" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS "customers_gingr_owner_id_key" ON "customers"("gingr_owner_id");

-- Enrich dogs table
ALTER TABLE "dogs" ADD COLUMN IF NOT EXISTS "size_category" TEXT;
ALTER TABLE "dogs" ADD COLUMN IF NOT EXISTS "gingr_animal_id" TEXT;
ALTER TABLE "dogs" ADD COLUMN IF NOT EXISTS "weight" DECIMAL(5,1);
ALTER TABLE "dogs" ADD COLUMN IF NOT EXISTS "temperament" TEXT;
ALTER TABLE "dogs" ADD COLUMN IF NOT EXISTS "care_instructions" TEXT;
ALTER TABLE "dogs" ADD COLUMN IF NOT EXISTS "is_neutered" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "dogs" ADD COLUMN IF NOT EXISTS "photo_url" TEXT;
ALTER TABLE "dogs" ADD COLUMN IF NOT EXISTS "social_notes" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "dogs_gingr_animal_id_key" ON "dogs"("gingr_animal_id");

-- Gingr Visits
CREATE TABLE IF NOT EXISTS "gingr_visits" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "gingr_reservation_id" TEXT NOT NULL,
    "visit_date" TIMESTAMP(3) NOT NULL,
    "service_type" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "points_earned" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "gingr_visits_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "gingr_visits_gingr_reservation_id_key" ON "gingr_visits"("gingr_reservation_id");
CREATE INDEX IF NOT EXISTS "gingr_visits_customer_id_visit_date_idx" ON "gingr_visits"("customer_id", "visit_date");
DO $$ BEGIN
  ALTER TABLE "gingr_visits" ADD CONSTRAINT "gingr_visits_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Service Types
CREATE TABLE IF NOT EXISTS "service_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "base_price_cents" INTEGER NOT NULL,
    "duration_minutes" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "service_types_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "service_types_name_key" ON "service_types"("name");

-- Capacity Rules
CREATE TABLE IF NOT EXISTS "capacity_rules" (
    "id" TEXT NOT NULL,
    "service_type_id" TEXT NOT NULL,
    "day_of_week" INTEGER,
    "max_capacity" INTEGER NOT NULL,
    "start_time" TEXT,
    "end_time" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "capacity_rules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "capacity_rules_service_type_id_day_of_week_start_time_key" ON "capacity_rules"("service_type_id", "day_of_week", "start_time");
DO $$ BEGIN
  ALTER TABLE "capacity_rules" ADD CONSTRAINT "capacity_rules_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "service_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Capacity Overrides
CREATE TABLE IF NOT EXISTS "capacity_overrides" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "max_capacity" INTEGER,
    "service_type_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "capacity_overrides_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "capacity_overrides_date_service_type_id_key" ON "capacity_overrides"("date", "service_type_id");

-- Bookings
CREATE TABLE IF NOT EXISTS "bookings" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "service_type_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "start_date" DATE,
    "end_date" DATE,
    "start_time" TEXT,
    "end_time" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "total_cents" INTEGER NOT NULL,
    "notes" TEXT,
    "cancel_reason" TEXT,
    "checked_in_at" TIMESTAMP(3),
    "checked_in_by" TEXT,
    "checked_out_at" TIMESTAMP(3),
    "checked_out_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "bookings_customer_id_date_idx" ON "bookings"("customer_id", "date");
CREATE INDEX IF NOT EXISTS "bookings_service_type_id_date_status_idx" ON "bookings"("service_type_id", "date", "status");
DO $$ BEGIN
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "service_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_checked_in_by_fkey" FOREIGN KEY ("checked_in_by") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_checked_out_by_fkey" FOREIGN KEY ("checked_out_by") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Booking Dogs
CREATE TABLE IF NOT EXISTS "booking_dogs" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "dog_id" TEXT NOT NULL,
    "notes" TEXT,
    "condition_rating" INTEGER,
    "condition_photo" TEXT,
    "quoted_price_cents" INTEGER,
    CONSTRAINT "booking_dogs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "booking_dogs_booking_id_dog_id_key" ON "booking_dogs"("booking_id", "dog_id");
DO $$ BEGIN
  ALTER TABLE "booking_dogs" ADD CONSTRAINT "booking_dogs_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "booking_dogs" ADD CONSTRAINT "booking_dogs_dog_id_fkey" FOREIGN KEY ("dog_id") REFERENCES "dogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Pricing Rules
CREATE TABLE IF NOT EXISTS "pricing_rules" (
    "id" TEXT NOT NULL,
    "service_type_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value_cents" INTEGER,
    "percentage" DECIMAL(5,2),
    "min_dogs" INTEGER,
    "membership_plan_id" TEXT,
    "day_of_week" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id")
);

-- Wallets
CREATE TABLE IF NOT EXISTS "wallets" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "balance_cents" INTEGER NOT NULL DEFAULT 0,
    "tier" TEXT NOT NULL DEFAULT 'basic',
    "stripe_customer_id" TEXT,
    "auto_reload_enabled" BOOLEAN NOT NULL DEFAULT false,
    "auto_reload_threshold_cents" INTEGER,
    "auto_reload_amount_cents" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "wallets_customer_id_key" ON "wallets"("customer_id");
CREATE UNIQUE INDEX IF NOT EXISTS "wallets_stripe_customer_id_key" ON "wallets"("stripe_customer_id");
DO $$ BEGIN
  ALTER TABLE "wallets" ADD CONSTRAINT "wallets_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Wallet Transactions
CREATE TABLE IF NOT EXISTS "wallet_transactions" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "balance_after_cents" INTEGER NOT NULL,
    "description" TEXT,
    "booking_id" TEXT,
    "stripe_payment_intent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "wallet_transactions_wallet_id_created_at_idx" ON "wallet_transactions"("wallet_id", "created_at");
DO $$ BEGIN
  ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Payments
CREATE TABLE IF NOT EXISTS "payments" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "booking_id" TEXT,
    "total_cents" INTEGER NOT NULL,
    "wallet_amount_cents" INTEGER NOT NULL DEFAULT 0,
    "card_amount_cents" INTEGER NOT NULL DEFAULT 0,
    "tip_cents" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "stripe_payment_intent_id" TEXT,
    "points_awarded" INTEGER NOT NULL DEFAULT 0,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "payments_stripe_payment_intent_id_key" ON "payments"("stripe_payment_intent_id");
CREATE UNIQUE INDEX IF NOT EXISTS "payments_idempotency_key_key" ON "payments"("idempotency_key");
CREATE INDEX IF NOT EXISTS "payments_customer_id_created_at_idx" ON "payments"("customer_id", "created_at");
DO $$ BEGIN
  ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Membership Plans
CREATE TABLE IF NOT EXISTS "membership_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "monthly_price_cents" INTEGER NOT NULL,
    "included_days_per_month" INTEGER NOT NULL DEFAULT 0,
    "discount_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "points_multiplier" DECIMAL(3,2) NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "membership_plans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "membership_plans_name_key" ON "membership_plans"("name");
DO $$ BEGIN
  ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "service_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_membership_plan_id_fkey" FOREIGN KEY ("membership_plan_id") REFERENCES "membership_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Subscriptions
CREATE TABLE IF NOT EXISTS "subscriptions" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "membership_plan_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "stripe_subscription_id" TEXT,
    "current_period_start" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_customer_id_key" ON "subscriptions"("customer_id");
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_stripe_subscription_id_key" ON "subscriptions"("stripe_subscription_id");
DO $$ BEGIN
  ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_membership_plan_id_fkey" FOREIGN KEY ("membership_plan_id") REFERENCES "membership_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Conversations
CREATE TABLE IF NOT EXISTS "conversations" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT,
    "channel" TEXT NOT NULL,
    "phone_number" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "assigned_staff_id" TEXT,
    "context_summary" TEXT,
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "conversations_customer_id_channel_idx" ON "conversations"("customer_id", "channel");
CREATE INDEX IF NOT EXISTS "conversations_phone_number_idx" ON "conversations"("phone_number");
DO $$ BEGIN
  ALTER TABLE "conversations" ADD CONSTRAINT "conversations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assigned_staff_id_fkey" FOREIGN KEY ("assigned_staff_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Messages
CREATE TABLE IF NOT EXISTS "messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "intent" TEXT,
    "confidence" DECIMAL(3,2),
    "model_used" TEXT,
    "tool_calls" JSONB,
    "twilio_sid" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "messages_twilio_sid_key" ON "messages"("twilio_sid");
CREATE INDEX IF NOT EXISTS "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");
DO $$ BEGIN
  ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Scheduled Notifications
CREATE TABLE IF NOT EXISTS "scheduled_notifications" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT,
    "customer_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),
    "content" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "scheduled_notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "scheduled_notifications_scheduled_for_status_idx" ON "scheduled_notifications"("scheduled_for", "status");
DO $$ BEGIN
  ALTER TABLE "scheduled_notifications" ADD CONSTRAINT "scheduled_notifications_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Staff Schedules
CREATE TABLE IF NOT EXISTS "staff_schedules" (
    "id" TEXT NOT NULL,
    "staff_user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'general',
    "date" DATE NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "staff_schedules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "staff_schedules_staff_user_id_date_key" ON "staff_schedules"("staff_user_id", "date");
DO $$ BEGIN
  ALTER TABLE "staff_schedules" ADD CONSTRAINT "staff_schedules_staff_user_id_fkey" FOREIGN KEY ("staff_user_id") REFERENCES "staff_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Report Cards
CREATE TABLE IF NOT EXISTS "report_cards" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "dog_id" TEXT NOT NULL,
    "staff_user_id" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "activities" TEXT,
    "meals" TEXT,
    "social_behavior" TEXT,
    "mood" TEXT,
    "photo_urls" TEXT[],
    "rating" INTEGER,
    "sent_at" TIMESTAMP(3),
    "sent_via" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "report_cards_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_dog_id_fkey" FOREIGN KEY ("dog_id") REFERENCES "dogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_staff_user_id_fkey" FOREIGN KEY ("staff_user_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Intake Forms
CREATE TABLE IF NOT EXISTS "intake_forms" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT,
    "phone_number" TEXT,
    "current_step" INTEGER NOT NULL DEFAULT 1,
    "total_steps" INTEGER NOT NULL DEFAULT 8,
    "data" JSONB NOT NULL DEFAULT '{}',
    "ai_flags" JSONB,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "intake_forms_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "intake_forms_phone_number_idx" ON "intake_forms"("phone_number");
DO $$ BEGIN
  ALTER TABLE "intake_forms" ADD CONSTRAINT "intake_forms_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Grooming Price Tiers
CREATE TABLE IF NOT EXISTS "grooming_price_tiers" (
    "id" TEXT NOT NULL,
    "size_category" TEXT NOT NULL,
    "condition_rating" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "estimated_minutes" INTEGER NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "grooming_price_tiers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "grooming_price_tiers_size_category_condition_rating_key" ON "grooming_price_tiers"("size_category", "condition_rating");

-- Service Bundles
CREATE TABLE IF NOT EXISTS "service_bundles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "discount_type" TEXT NOT NULL,
    "discount_value" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "service_bundles_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "service_bundle_items" (
    "id" TEXT NOT NULL,
    "bundle_id" TEXT NOT NULL,
    "service_type_id" TEXT NOT NULL,
    CONSTRAINT "service_bundle_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "service_bundle_items_bundle_id_service_type_id_key" ON "service_bundle_items"("bundle_id", "service_type_id");
DO $$ BEGIN
  ALTER TABLE "service_bundle_items" ADD CONSTRAINT "service_bundle_items_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "service_bundles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "service_bundle_items" ADD CONSTRAINT "service_bundle_items_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "service_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Vaccinations
CREATE TABLE IF NOT EXISTS "vaccinations" (
    "id" TEXT NOT NULL,
    "dog_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date_given" DATE NOT NULL,
    "expires_at" DATE,
    "vet_name" TEXT,
    "document_url" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_by" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "vaccinations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "vaccinations_dog_id_name_idx" ON "vaccinations"("dog_id", "name");
CREATE INDEX IF NOT EXISTS "vaccinations_expires_at_idx" ON "vaccinations"("expires_at");
DO $$ BEGIN
  ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_dog_id_fkey" FOREIGN KEY ("dog_id") REFERENCES "dogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Medications
CREATE TABLE IF NOT EXISTS "medications" (
    "id" TEXT NOT NULL,
    "dog_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dosage" TEXT,
    "frequency" TEXT,
    "instructions" TEXT,
    "start_date" DATE,
    "end_date" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "medications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "medications_dog_id_is_active_idx" ON "medications"("dog_id", "is_active");
DO $$ BEGIN
  ALTER TABLE "medications" ADD CONSTRAINT "medications_dog_id_fkey" FOREIGN KEY ("dog_id") REFERENCES "dogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Behavior Notes
CREATE TABLE IF NOT EXISTS "behavior_notes" (
    "id" TEXT NOT NULL,
    "dog_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "severity" INTEGER NOT NULL DEFAULT 1,
    "reported_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "behavior_notes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "behavior_notes_dog_id_category_idx" ON "behavior_notes"("dog_id", "category");
DO $$ BEGIN
  ALTER TABLE "behavior_notes" ADD CONSTRAINT "behavior_notes_dog_id_fkey" FOREIGN KEY ("dog_id") REFERENCES "dogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "behavior_notes" ADD CONSTRAINT "behavior_notes_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Vaccination Requirements
CREATE TABLE IF NOT EXISTS "vaccination_requirements" (
    "id" TEXT NOT NULL,
    "vaccination_name" TEXT NOT NULL,
    "service_type_id" TEXT,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "grace_period_days" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "vaccination_requirements_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "vaccination_requirements_vaccination_name_service_type_id_key" ON "vaccination_requirements"("vaccination_name", "service_type_id");
