/*
  Warnings:

  - You are about to drop the column `messageContent` on the `MessageLog` table. All the data in the column will be lost.
  - You are about to drop the column `sentAt` on the `MessageLog` table. All the data in the column will be lost.
  - The `status` column on the `MessageLog` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `channel` to the `MessageLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `content` to the `MessageLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `recipient` to the `MessageLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `triggeredBy` to the `MessageLog` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('WHATSAPP', 'EMAIL');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "MessageTemplateType" AS ENUM ('ALIGNER_CHANGE_REMINDER', 'APPOINTMENT_REMINDER_48H', 'APPOINTMENT_REMINDER_2H', 'BATCH_PICKUP_READY', 'LAB_ORDER_REQUEST', 'PROGRESS_MILESTONE_50', 'MISSED_APPOINTMENT', 'ORTHODONTIST_ALERT_BATCH_URGENT', 'ORTHODONTIST_ALERT_WEEKLY_SUMMARY', 'ORTHODONTIST_ALERT_OVERDUE_DELIVERY', 'TREATMENT_COMPLETED', 'WELCOME', 'CHANGE_CONFIRMATION', 'CHANGE_FOLLOWUP_NO', 'FALLBACK_UNRECOGNIZED');

-- DropForeignKey
ALTER TABLE "MessageLog" DROP CONSTRAINT "MessageLog_patientId_fkey";

-- AlterTable
ALTER TABLE "MessageLog" DROP COLUMN "messageContent",
DROP COLUMN "sentAt",
ADD COLUMN     "channel" "MessageChannel" NOT NULL,
ADD COLUMN     "content" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "recipient" TEXT NOT NULL,
ADD COLUMN     "templateId" TEXT,
ADD COLUMN     "triggeredBy" TEXT NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "MessageStatus" NOT NULL DEFAULT 'PENDING',
ALTER COLUMN "patientId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "whatsappOptedIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsappOptedInAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "MessageTemplateType" NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "content" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'es',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlignerChangeEvent" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "alignerNumber" INTEGER NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "confirmedBy" TEXT,
    "nextReminderAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlignerChangeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentRecord" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentDate" TIMESTAMP(3) NOT NULL,
    "alignersGiven" INTEGER NOT NULL,
    "startingAligner" INTEGER NOT NULL,
    "nextApptEstimate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "OnboardingToken" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_name_key" ON "MessageTemplate"("name");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingToken_patientId_key" ON "OnboardingToken"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingToken_token_key" ON "OnboardingToken"("token");

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MessageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlignerChangeEvent" ADD CONSTRAINT "AlignerChangeEvent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentRecord" ADD CONSTRAINT "AppointmentRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingToken" ADD CONSTRAINT "OnboardingToken_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
