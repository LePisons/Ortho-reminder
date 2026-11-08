import { ConfigService } from '@nestjs/config';
import { EmailProvider } from './email.provider';
describe('Email notification switch', () => {
  it.each([undefined, 'false', '0', ''])('suppresses delivery for %s even with credentials', async (flag) => {
    const provider = new EmailProvider(new ConfigService({ RESEND_API_KEY: 're_test', EMAIL_NOTIFICATIONS_ENABLED: flag }));
    const send = jest.spyOn((provider as any).resend.emails, 'send');
    expect(provider.isAvailable()).toBe(false);
    expect((await provider.send('test@example.test', 'test')).success).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
  it('requires both explicit opt-in and credentials', () => {
    expect(new EmailProvider(new ConfigService({ EMAIL_NOTIFICATIONS_ENABLED: 'true' })).isAvailable()).toBe(false);
    expect(new EmailProvider(new ConfigService({ EMAIL_NOTIFICATIONS_ENABLED: 'true', RESEND_API_KEY: 're_test' })).isAvailable()).toBe(true);
  });
});
