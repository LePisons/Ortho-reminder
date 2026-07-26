-- A deck can now stand on its own, for a case that is not an Alnix patient:
-- `patientId` becomes optional and `subjectName` carries who the deck is about.
ALTER TABLE "Presentation" ALTER COLUMN "patientId" DROP NOT NULL;
ALTER TABLE "Presentation" ADD COLUMN "subjectName" TEXT;

-- Assets carry the record slot they fill, so an external case's uploads can be
-- laid out like a patient's photo grid.
ALTER TABLE "PresentationAsset" ADD COLUMN "role" TEXT;
ALTER TABLE "PresentationAsset" ADD COLUMN "label" TEXT;
