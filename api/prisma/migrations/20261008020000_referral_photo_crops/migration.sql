ALTER TABLE "ReferralFile" ADD COLUMN "sourceFileId" TEXT, ADD COLUMN "editRecipe" JSONB;
ALTER TABLE "ReferralFile" ADD CONSTRAINT "ReferralFile_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "ReferralFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "ReferralFile_sourceFileId_idx" ON "ReferralFile"("sourceFileId");
