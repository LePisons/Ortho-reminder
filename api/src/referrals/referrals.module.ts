import { Module } from '@nestjs/common';
import { ReferralOriginalCleanupService } from './referral-original-cleanup.service';
import { ReferralsController } from './referrals.controller';
import { ReferralsService } from './referrals.service';
import { ReferralUploadGuard } from './referral-upload.guard';
import { ReferralNotificationsService } from './referral-notifications.service';
import { EmailProvider } from '../messaging/providers/email.provider';

@Module({
  controllers: [ReferralsController],
  providers: [
    ReferralOriginalCleanupService,
    ReferralsService,
    ReferralUploadGuard,
    ReferralNotificationsService,
    EmailProvider,
  ],
})
export class ReferralsModule {}
