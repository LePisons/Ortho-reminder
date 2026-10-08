import { ReferralsService } from './referrals.service';
import { referralChecklist } from './referral-checklist';
import { ForbiddenException } from '@nestjs/common';

describe('Setup approval and case progress', () => {
  let db: any, service: ReferralsService;
  const admin = { userId: 'owner', role: 'ADMIN' },
    colleague = { userId: 'colleague', role: 'REFERRER' };
  beforeEach(() => {
    db = {
      referral: {
        findFirst: jest.fn().mockResolvedValue({ id: 'case' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ status: 'ACCEPTED', stage: 'REVIEW' }),
        update: jest.fn(),
      },
      referralSetup: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'latest', title: 'V2', decision: null }),
        update: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'new' }),
      },
      user: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({
            name: 'Colega',
            email: 'colleague@example.test',
          }),
      },
      referralTimelineEvent: { create: jest.fn() },
      auditLog: { create: jest.fn() },
      referralNotificationEvent: { create: jest.fn() },
    };
    db.$transaction = jest.fn((fn) => fn(db));
    service = new ReferralsService(db, {} as any);
  });
  it('records approval of the latest version, identity, timestamp and notification', async () => {
    await service.decideSetup(
      'case',
      'latest',
      { decision: 'APPROVED', note: 'Conforme' },
      colleague,
    );
    expect(db.referral.updateMany.mock.calls[0][0].where).toMatchObject({
      id: 'case',
      referrerId: 'colleague',
      revokedAt: null,
    });
    expect(db.referralSetup.update.mock.calls[0][0]).toMatchObject({
      where: { id: 'latest' },
      data: {
        decision: 'APPROVED',
        decidedBy: 'colleague',
        decidedByName: 'Colega',
        decidedAt: expect.any(Date),
      },
    });
    expect(db.referral.update).toHaveBeenCalledWith({
      where: { id: 'case' },
      data: { stage: 'APPROVED' },
    });
    expect(db.referralNotificationEvent.create).toHaveBeenCalledWith({
      data: { referralId: 'case', action: 'SETUP_APPROVED' },
    });
  });
  it('requires a reason for changes and returns the case to planning', async () => {
    await expect(
      service.decideSetup(
        'case',
        'latest',
        { decision: 'CHANGES_REQUESTED', note: ' ' },
        colleague,
      ),
    ).rejects.toThrow('Describe');
    await service.decideSetup(
      'case',
      'latest',
      { decision: 'CHANGES_REQUESTED', note: 'Revisar línea media' },
      colleague,
    );
    expect(db.referral.update).toHaveBeenCalledWith({
      where: { id: 'case' },
      data: { stage: 'PLANNING' },
    });
    expect(
      db.referralTimelineEvent.create.mock.calls[0][0].data.note,
    ).toContain('Revisar línea media');
  });
  it('rejects decisions on an obsolete version', async () => {
    await expect(
      service.decideSetup('case', 'old', { decision: 'APPROVED' }, colleague),
    ).rejects.toThrow('último setup');
    expect(db.referralSetup.update).not.toHaveBeenCalled();
  });
  it('does not overwrite a previous decision', async () => {
    db.referralSetup.findFirst.mockResolvedValue({
      id: 'latest',
      decision: 'APPROVED',
    });
    await expect(
      service.decideSetup(
        'case',
        'latest',
        { decision: 'APPROVED' },
        colleague,
      ),
    ).rejects.toThrow();
    expect(db.referralSetup.update).not.toHaveBeenCalled();
  });
  it('requires acceptance before review and prevents approval outside review', async () => {
    for (const record of [
      { status: 'SUBMITTED', stage: 'REVIEW' },
      { status: 'ACCEPTED', stage: 'MANUFACTURING' },
    ]) {
      db.referral.findUniqueOrThrow.mockResolvedValue(record);
      await expect(
        service.decideSetup(
          'case',
          'latest',
          { decision: 'APPROVED' },
          colleague,
        ),
      ).rejects.toThrow();
    }
  });
  it('rejects admins approving on behalf of a colleague and external stage changes', async () => {
    await expect(
      service.decideSetup('case', 'latest', { decision: 'APPROVED' }, admin),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.changeStage(
        'case',
        { stage: 'DELIVERED', expectedStage: 'MANUFACTURING' },
        colleague,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('rechecks access inside the transaction after revocation', async () => {
    db.referral.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.decideSetup(
        'case',
        'latest',
        { decision: 'APPROVED' },
        colleague,
      ),
    ).rejects.toThrow('no disponible');
    expect(db.referralSetup.update).not.toHaveBeenCalled();
  });
  it('requires approval of the latest setup before manufacturing', async () => {
    db.referral.findUniqueOrThrow.mockResolvedValue({
      status: 'ACCEPTED',
      stage: 'APPROVED',
    });
    await expect(
      service.changeStage(
        'case',
        { stage: 'MANUFACTURING', expectedStage: 'APPROVED' },
        admin,
      ),
    ).rejects.toThrow('aprobado');
    db.referralSetup.findFirst.mockResolvedValue({ decision: 'APPROVED' });
    await service.changeStage(
      'case',
      { stage: 'MANUFACTURING', expectedStage: 'APPROVED' },
      admin,
    );
    expect(db.referral.update).toHaveBeenCalledWith({
      where: { id: 'case' },
      data: { stage: 'MANUFACTURING' },
    });
  });
  it('rejects skipping fabrication, stale changes and unexplained returns', async () => {
    await expect(
      service.changeStage(
        'case',
        { stage: 'DELIVERED', expectedStage: 'REVIEW' },
        admin,
      ),
    ).rejects.toThrow('no está permitido');
    await expect(
      service.changeStage(
        'case',
        { stage: 'PLANNING', expectedStage: 'APPROVED', note: 'Cambio' },
        admin,
      ),
    ).rejects.toThrow('estado cambió');
    await expect(
      service.changeStage(
        'case',
        { stage: 'PLANNING', expectedStage: 'REVIEW' },
        admin,
      ),
    ).rejects.toThrow('por qué');
  });
  it('new setups return the case to review without changing earlier decisions', async () => {
    db.referral.findUniqueOrThrow.mockResolvedValue({
      status: 'ACCEPTED',
      stage: 'APPROVED',
    });
    await service.setup(
      'case',
      { title: 'V3', url: 'https://example.test/setup' },
      admin,
    );
    expect(db.referralSetup.update).not.toHaveBeenCalled();
    expect(db.referral.update.mock.calls[0][0].data.stage).toBe('REVIEW');
  });
  it('blocks a new setup during manufacturing until an explicit return to planning', async () => {
    db.referral.findUniqueOrThrow.mockResolvedValue({
      status: 'ACCEPTED',
      stage: 'MANUFACTURING',
    });
    await expect(
      service.setup(
        'case',
        { title: 'V3', url: 'https://example.test/setup' },
        admin,
      ),
    ).rejects.toThrow('planificación');
    expect(db.referralSetup.create).not.toHaveBeenCalled();
  });
});

describe('Referral checklist', () => {
  it('requires both STL jaws and instructions, but does not require new radiographs', () => {
    const checklist = referralChecklist({
      reason: 'Alinear arcadas',
      files: [{ kind: 'STL_UPPER' }, { kind: 'STL_LOWER' }],
    });
    expect(checklist.canSubmit).toBe(true);
    expect(checklist.items.find((i) => i.key === 'XRAY')).toMatchObject({
      required: false,
      complete: false,
    });
    expect(
      referralChecklist({ reason: 'Alinear', files: [{ kind: 'STL_UPPER' }] })
        .canSubmit,
    ).toBe(false);
  });
  it('does not count unclassified photos as a complete photographic series', () => {
    const { items } = referralChecklist({
      reason: 'Alinear',
      files: [
        { kind: 'PHOTO', photoView: 'UNASSIGNED' },
        { kind: 'PHOTO', photoView: 'OCCLUSAL_UPPER' },
      ],
    });
    expect(items.find((i) => i.key === 'OCCLUSAL_UPPER')?.complete).toBe(true);
    expect(items.find((i) => i.key === 'OCCLUSAL_LOWER')?.complete).toBe(false);
  });
});
