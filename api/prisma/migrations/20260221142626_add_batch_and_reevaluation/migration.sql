-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('NEEDED', 'ORDER_SENT', 'IN_PRODUCTION', 'DELIVERED_TO_CLINIC', 'HANDED_TO_PATIENT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReevaluationStatus" AS ENUM ('NEEDED', 'SCAN_UPLOADED', 'APPROVED');

-- CreateTable
CREATE TABLE "AlignerBatch" (
    "id" TEXT NOT NULL,
    "status" "BatchStatus" NOT NULL DEFAULT 'NEEDED',
    "orderDate" TIMESTAMP(3),
    "expectedDeliveryDate" TIMESTAMP(3),
    "actualDeliveryDate" TIMESTAMP(3),
    "notes" TEXT,
    "batchNumber" INTEGER NOT NULL DEFAULT 1,
    "alignerCount" INTEGER NOT NULL DEFAULT 0,
    "technicianEmail" TEXT,
    "technicianNotes" TEXT,
    "createdBy" TEXT,
    "patientId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlignerBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchEvent" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "fromStatus" "BatchStatus",
    "toStatus" "BatchStatus" NOT NULL,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BatchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reevaluation" (
    "id" TEXT NOT NULL,
    "status" "ReevaluationStatus" NOT NULL DEFAULT 'NEEDED',
    "scanDate" TIMESTAMP(3),
    "scanFileUrl" TEXT,
    "approvalDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdBy" TEXT,
    "patientId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reevaluation_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AlignerBatch" ADD CONSTRAINT "AlignerBatch_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchEvent" ADD CONSTRAINT "BatchEvent_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "AlignerBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reevaluation" ADD CONSTRAINT "Reevaluation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
