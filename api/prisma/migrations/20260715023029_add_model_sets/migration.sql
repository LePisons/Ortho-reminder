-- CreateTable
CREATE TABLE "ModelSet" (
    "id" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "label" TEXT,
    "upperKey" TEXT,
    "lowerKey" TEXT,
    "upperSize" INTEGER,
    "lowerSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "patientId" TEXT NOT NULL,

    CONSTRAINT "ModelSet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModelSet_patientId_idx" ON "ModelSet"("patientId");

-- AddForeignKey
ALTER TABLE "ModelSet" ADD CONSTRAINT "ModelSet_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
