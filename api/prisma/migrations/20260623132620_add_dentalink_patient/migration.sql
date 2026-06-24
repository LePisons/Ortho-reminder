-- CreateTable
CREATE TABLE "DentalinkPatient" (
    "id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DentalinkPatient_pkey" PRIMARY KEY ("id")
);
