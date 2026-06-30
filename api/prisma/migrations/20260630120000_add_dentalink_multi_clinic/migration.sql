-- AlterTable: track which Dentalink clinic account a linked patient belongs to
ALTER TABLE "Patient" ADD COLUMN "dentalinkClinic" TEXT;

-- AlterTable: scope the Dentalink roster by clinic. Existing rows belong to the
-- original clinic (Quiero Frenillos); the column default backfills them, then we
-- swap the single-column primary key for a composite (clinic, id) key.
ALTER TABLE "DentalinkPatient" ADD COLUMN "clinic" TEXT NOT NULL DEFAULT 'quiero-frenillos';

ALTER TABLE "DentalinkPatient" DROP CONSTRAINT "DentalinkPatient_pkey";

ALTER TABLE "DentalinkPatient" ADD CONSTRAINT "DentalinkPatient_pkey" PRIMARY KEY ("clinic", "id");
