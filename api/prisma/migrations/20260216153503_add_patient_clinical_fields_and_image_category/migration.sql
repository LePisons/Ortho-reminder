-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "diagnosis" TEXT,
ADD COLUMN     "observations" TEXT,
ADD COLUMN     "treatmentPlan" TEXT;

-- AlterTable
ALTER TABLE "PatientImage" ADD COLUMN     "category" TEXT;
