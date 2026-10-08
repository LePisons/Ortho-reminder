import { ConfigService } from '@nestjs/config';
import {
  ReferralNotificationsService,
  referralNotificationHtml,
} from './referral-notifications.service';
import { ReferralsService } from './referrals.service';

describe('Referral activity notifications', () => {
  let db: any, email: any, config: any, service: ReferralNotificationsService;
  const delivery = {
    id: 'delivery',
    referralId: 'case',
    ownerId: 'owner',
    recipient: 'owner@example.test',
    actions: ['UPLOAD', 'UPLOAD', 'COMMENT'],
    attempts: 0,
  };
  beforeEach(() => {
    db = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: true }]),
      referralNotificationEvent: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn(),
        create: jest.fn(),
      },
      referralNotificationDelivery: {
        findMany: jest.fn().mockResolvedValue([delivery]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'delivery' }),
      },
      referral: {
        findFirst: jest.fn().mockResolvedValue({ id: 'case' }),
        findUnique: jest
          .fn()
          .mockResolvedValue({
            ownerId: 'owner',
            revokedAt: null,
            owner: {
              email: 'owner@example.test',
              role: 'ADMIN',
              disabledAt: null,
            },
          }),
      },
      auditLog: { create: jest.fn() },
    };
    db.$transaction = jest.fn((callback) => callback(db));
    email = {
      isAvailable: jest.fn().mockReturnValue(true),
      send: jest.fn().mockResolvedValue({ success: true }),
    };
    config = new ConfigService({ ALLOWED_ORIGINS: 'https://app.example.test' });
    service = new ReferralNotificationsService(db, email, config);
  });
  it('sends only to the owner, with a protected case link and stable retry key', async () => {
    await service.dispatch();
    expect(db.referral.findFirst.mock.calls[0][0].where).toMatchObject({
      ownerId: 'owner',
      revokedAt: null,
      owner: { role: 'ADMIN', disabledAt: null, email: delivery.recipient },
    });
    expect(email.send).toHaveBeenCalledWith(
      delivery.recipient,
      expect.stringContaining('https://app.example.test/derivaciones/case'),
      expect.any(String),
      'referral-activity/delivery',
    );
    expect(db.referralNotificationDelivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery' },
      data: { status: 'SENT', sentAt: expect.any(Date) },
    });
  });
  it('retains failed deliveries and retries with the same provider key', async () => {
    email.send.mockResolvedValueOnce({ success: false });
    await service.dispatch();
    expect(db.referralNotificationDelivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery' },
      data: { availableAt: expect.any(Date) },
    });
    await service.dispatch();
    expect(email.send.mock.calls.map((call) => call[3])).toEqual([
      'referral-activity/delivery',
      'referral-activity/delivery',
    ]);
  });
  it('does not send when another worker claimed the delivery', async () => {
    db.referralNotificationDelivery.updateMany.mockResolvedValue({ count: 0 });
    await service.dispatch();
    expect(email.send).not.toHaveBeenCalled();
  });
  it('cancels deliveries when access or the owner address changes', async () => {
    db.referral.findFirst.mockResolvedValue(null);
    await service.dispatch();
    expect(email.send).not.toHaveBeenCalled();
    expect(db.referralNotificationDelivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery' },
      data: { status: 'CANCELLED' },
    });
  });
  it('keeps events untouched until email and a secure origin are configured', async () => {
    email.isAvailable.mockReturnValue(false);
    await service.dispatch();
    email.isAvailable.mockReturnValue(true);
    config.set('ALLOWED_ORIGINS', 'http://app.example.test');
    await service.dispatch();
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
  });
  it('groups fresh uploads with an older action into one delivery', async () => {
    const first = { id: 'a', referralId: 'case', action: 'CREATE' };
    db.referralNotificationEvent.findMany
      .mockResolvedValueOnce([first])
      .mockResolvedValueOnce([
        first,
        { id: 'b', referralId: 'case', action: 'UPLOAD' },
      ]);
    await service.groupPending();
    expect(db.referralNotificationDelivery.create).toHaveBeenCalledTimes(1);
    expect(db.referralNotificationDelivery.create).toHaveBeenCalledWith({
      data: {
        referralId: 'case',
        ownerId: 'owner',
        recipient: delivery.recipient,
        actions: ['CREATE', 'UPLOAD'],
      },
    });
    expect(
      db.referralNotificationEvent.updateMany.mock.calls[0][0].where,
    ).toEqual({ id: { in: ['a', 'b'] }, deliveryId: null });
  });
  it('does not group concurrently with another worker', async () => {
    db.$queryRaw.mockResolvedValue([{ locked: false }]);
    await service.groupPending();
    expect(db.referralNotificationEvent.findMany).not.toHaveBeenCalled();
  });
  it('queues only colleague changes in the same transaction as the audit', async () => {
    const referrals = new ReferralsService(db, {} as any);
    for (const action of [
      'CREATE',
      'UPDATE',
      'SUBMIT',
      'COMMENT',
      'UPLOAD',
      'PHOTO_CLASSIFIED',
    ]) {
      await (referrals as any).audit(
        db,
        { userId: 'colleague', role: 'REFERRER' },
        action,
        'case',
      );
    }
    expect(db.referralNotificationEvent.create).toHaveBeenCalledTimes(6);
    db.referralNotificationEvent.create.mockClear();
    await (referrals as any).audit(
      db,
      { userId: 'owner', role: 'ADMIN' },
      'COMMENT',
      'case',
    );
    await (referrals as any).audit(
      db,
      { userId: 'colleague', role: 'REFERRER' },
      'READ',
      'case',
    );
    await (referrals as any).audit(
      db,
      { userId: 'colleague', role: 'REFERRER' },
      'DOWNLOAD',
      'case',
    );
    expect(db.referralNotificationEvent.create).not.toHaveBeenCalled();
  });
  it('renders only static activity descriptions and escapes the link', () => {
    const html = referralNotificationHtml(
      ['UPLOAD', 'UPLOAD', '<script>secret</script>'],
      'https://example.test/?a="&b=1',
    );
    expect(html).toContain('Adjuntó archivos (2)');
    expect(html).not.toContain('secret');
    expect(html).toContain('&quot;&amp;b=1');
  });
});
