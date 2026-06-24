-- CreateEnum
CREATE TYPE "PipelineStage" AS ENUM ('REQUIRED_FILES', 'IN_PRODUCTION', 'READY_FOR_PICKUP', 'IN_TREATMENT', 'ENDING_SOON', 'REEVALUATION');

-- CreateEnum
CREATE TYPE "MessageTrigger" AS ENUM ('cron', 'manual', 'webhook', 'telegram_bot');

-- CreateEnum
CREATE TYPE "AlignerChangeReason" AS ENUM ('manual_adjustment', 'manual_start', 'onboarding', 'auto_onboarding', 'cron', 'patient_reply');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INCOMING', 'OUTGOING');

-- AlterEnum
ALTER TYPE "MessageStatus" ADD VALUE 'READ';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MessageTemplateType" ADD VALUE 'BATCH_ENDING_LAB_ALERT';
ALTER TYPE "MessageTemplateType" ADD VALUE 'APPOINTMENT_NEEDED';

-- DropForeignKey
ALTER TABLE "AlignerChangeEvent" DROP CONSTRAINT "AlignerChangeEvent_patientId_fkey";

-- DropForeignKey
ALTER TABLE "AppointmentRecord" DROP CONSTRAINT "AppointmentRecord_patientId_fkey";

-- DropForeignKey
ALTER TABLE "MessageLog" DROP CONSTRAINT "MessageLog_patientId_fkey";

-- DropForeignKey
ALTER TABLE "OnboardingToken" DROP CONSTRAINT "OnboardingToken_patientId_fkey";

-- DropIndex
DROP INDEX "Patient_email_key";

-- DropIndex
DROP INDEX "Patient_phone_key";

-- DropIndex
DROP INDEX "Patient_rut_key";

-- AlterTable: convert confirmedBy from text to enum, preserving existing values
ALTER TABLE "AlignerChangeEvent"
ALTER COLUMN "confirmedBy" TYPE "AlignerChangeReason" USING ("confirmedBy"::text::"AlignerChangeReason");

-- AlterTable: message log structural columns (previously applied via db push)
ALTER TABLE "MessageLog" DROP COLUMN "errorMessage",
ADD COLUMN     "direction" "MessageDirection" NOT NULL DEFAULT 'OUTGOING',
ADD COLUMN     "error" TEXT,
ADD COLUMN     "isRead" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "providerMessageId" TEXT;

-- AlterTable: convert triggeredBy from text to enum, preserving existing values
ALTER TABLE "MessageLog"
ALTER COLUMN "triggeredBy" TYPE "MessageTrigger" USING ("triggeredBy"::text::"MessageTrigger");

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "lastAlignerSetAt" TIMESTAMP(3),
ADD COLUMN     "lastAppointmentDate" TIMESTAMP(3),
ADD COLUMN     "pipelineOverride" "PipelineStage";

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AlignerBatch_patientId_idx" ON "AlignerBatch"("patientId");

-- CreateIndex
CREATE INDEX "AlignerChangeEvent_patientId_idx" ON "AlignerChangeEvent"("patientId");

-- CreateIndex
CREATE INDEX "Appointment_patientId_idx" ON "Appointment"("patientId");

-- CreateIndex
CREATE INDEX "AppointmentRecord_patientId_idx" ON "AppointmentRecord"("patientId");

-- CreateIndex
CREATE INDEX "BatchEvent_batchId_idx" ON "BatchEvent"("batchId");

-- CreateIndex
CREATE INDEX "ClinicalRecord_patientId_idx" ON "ClinicalRecord"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageLog_providerMessageId_key" ON "MessageLog"("providerMessageId");

-- CreateIndex
CREATE INDEX "MessageLog_patientId_idx" ON "MessageLog"("patientId");

-- CreateIndex
CREATE INDEX "MessageLog_templateId_idx" ON "MessageLog"("templateId");

-- CreateIndex
CREATE INDEX "Note_patientId_idx" ON "Note"("patientId");

-- CreateIndex
CREATE INDEX "Patient_userId_idx" ON "Patient"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_userId_rut_key" ON "Patient"("userId", "rut");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_userId_email_key" ON "Patient"("userId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_userId_phone_key" ON "Patient"("userId", "phone");

-- CreateIndex
CREATE INDEX "PatientImage_patientId_idx" ON "PatientImage"("patientId");

-- CreateIndex
CREATE INDEX "Reevaluation_patientId_idx" ON "Reevaluation"("patientId");

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlignerChangeEvent" ADD CONSTRAINT "AlignerChangeEvent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentRecord" ADD CONSTRAINT "AppointmentRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingToken" ADD CONSTRAINT "OnboardingToken_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
