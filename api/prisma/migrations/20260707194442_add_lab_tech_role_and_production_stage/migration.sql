-- CreateEnum
CREATE TYPE "ProductionStage" AS ENUM ('RECEIVED', 'PRINTING_MODELS', 'THERMOFORMING', 'TRIMMING_POLISHING', 'PACKAGING', 'COMPLETED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'LAB_TECH';

-- AlterTable
ALTER TABLE "AlignerBatch" ADD COLUMN     "modelsPrinted" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "productionStage" "ProductionStage";
