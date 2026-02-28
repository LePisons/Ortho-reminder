-- AlterTable
ALTER TABLE "AlignerBatch" ADD COLUMN     "gooFileUrl" TEXT;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "trackingStartedAt" TIMESTAMP(3),
ALTER COLUMN "currentAligner" SET DEFAULT 0;
