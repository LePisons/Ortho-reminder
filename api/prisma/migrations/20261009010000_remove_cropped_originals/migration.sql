ALTER TABLE "ReferralFile" ADD COLUMN "removedAt" TIMESTAMP(3), ADD COLUMN "storageDeletedAt" TIMESTAMP(3);
CREATE INDEX "ReferralFile_removedAt_storageDeletedAt_idx" ON "ReferralFile"("removedAt", "storageDeletedAt");
