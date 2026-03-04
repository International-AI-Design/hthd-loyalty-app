-- AlterTable
ALTER TABLE "dogs" ADD COLUMN     "altered_date" DATE,
ADD COLUMN     "altered_status" TEXT,
ADD COLUMN     "color" TEXT,
ADD COLUMN     "emergency_agent" TEXT,
ADD COLUMN     "emergency_agent_phone" TEXT,
ADD COLUMN     "emergency_agent_relationship" TEXT,
ADD COLUMN     "emergency_vet_cost_limit" INTEGER,
ADD COLUMN     "feeding_method" TEXT,
ADD COLUMN     "feeding_notes" TEXT,
ADD COLUMN     "food_type" TEXT,
ADD COLUMN     "good_with" TEXT,
ADD COLUMN     "microchip_number" TEXT,
ADD COLUMN     "vet_address" TEXT,
ADD COLUMN     "vet_email" TEXT,
ADD COLUMN     "vet_name" TEXT,
ADD COLUMN     "vet_phone" TEXT;

-- Backfill alteredStatus from isNeutered
UPDATE "dogs" SET "altered_status" = 'neutered' WHERE "is_neutered" = true;
UPDATE "dogs" SET "altered_status" = 'intact' WHERE "is_neutered" = false;
