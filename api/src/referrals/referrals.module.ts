import { Module } from '@nestjs/common';
import { ReferralsController } from './referrals.controller';
import { ReferralsService } from './referrals.service';
import { ReferralUploadGuard } from './referral-upload.guard';
import { ReferralNotificationsService } from './referral-notifications.service';
import { EmailProvider } from '../messaging/providers/email.provider';

@Module({
  controllers: [ReferralsController],
  providers: [
    ReferralsService,
    ReferralUploadGuard,
    ReferralNotificationsService,
    EmailProvider,
  ],
})
export class ReferralsModule {}
