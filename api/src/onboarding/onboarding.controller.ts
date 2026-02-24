import { Controller, Get, Param, Post } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get(':token')
  async validateToken(@Param('token') token: string) {
    return this.onboardingService.validateToken(token);
  }

  @Post(':token/optin')
  async optIn(@Param('token') token: string) {
    return this.onboardingService.optIn(token);
  }
}
