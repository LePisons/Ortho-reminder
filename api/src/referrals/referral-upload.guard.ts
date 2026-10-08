import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ReferralsService } from './referrals.service';

@Injectable()
export class ReferralUploadGuard implements CanActivate {
  constructor(private readonly referrals: ReferralsService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    // Guards run before Multer buffers the upload.
    await this.referrals.access(req.params.id, req.user);
    return true;
  }
}
