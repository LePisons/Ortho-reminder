-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "clinic" TEXT,
ADD COLUMN     "doctor" TEXT,
ADD COLUMN     "dentalinkId" INTEGER;

-- CreateIndex
CREATE INDEX "Patient_userId_clinic_idx" ON "Patient"("userId", "clinic");

-- CreateIndex
CREATE INDEX "Patient_userId_doctor_idx" ON "Patient"("userId", "doctor");
