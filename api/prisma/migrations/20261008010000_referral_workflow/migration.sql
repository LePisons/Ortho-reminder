ALTER TABLE "Referral" ADD COLUMN "stage" TEXT NOT NULL DEFAULT 'DRAFT';
UPDATE "Referral" SET "stage" = CASE "status"::text
  WHEN 'SUBMITTED' THEN 'RECEIVED' WHEN 'NEEDS_INFO' THEN 'NEEDS_INFO'
  WHEN 'ACCEPTED' THEN CASE WHEN EXISTS (SELECT 1 FROM "ReferralSetup" s WHERE s."referralId" = "Referral"."id") THEN 'REVIEW' ELSE 'PLANNING' END
  ELSE 'DRAFT' END;
ALTER TABLE "ReferralSetup" ADD COLUMN "decision" TEXT,
 ADD COLUMN "decisionNote" TEXT, ADD COLUMN "decidedAt" TIMESTAMP(3),
 ADD COLUMN "decidedBy" TEXT, ADD COLUMN "decidedByName" TEXT;
CREATE TABLE "ReferralTimelineEvent" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "referralId" TEXT NOT NULL REFERENCES "Referral"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "stage" TEXT NOT NULL, "actorName" TEXT NOT NULL, "note" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ReferralTimelineEvent_referralId_createdAt_idx" ON "ReferralTimelineEvent"("referralId", "createdAt");
