CREATE TABLE "ReferralNotificationEvent" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "referralId" TEXT NOT NULL,
 "action" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "deliveryId" TEXT
);
CREATE INDEX "ReferralNotificationEvent_deliveryId_createdAt_idx" ON "ReferralNotificationEvent"("deliveryId", "createdAt");
CREATE TABLE "ReferralNotificationDelivery" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "referralId" TEXT NOT NULL,
 "ownerId" TEXT NOT NULL,
 "recipient" TEXT NOT NULL,
 "actions" TEXT[] NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'PENDING',
 "attempts" INTEGER NOT NULL DEFAULT 0,
 "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "sentAt" TIMESTAMP(3)
);
CREATE INDEX "ReferralNotificationDelivery_status_availableAt_idx" ON "ReferralNotificationDelivery"("status", "availableAt");
