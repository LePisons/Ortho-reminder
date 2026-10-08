import { ReferralsService } from './referrals.service';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../storage/r2.service';
import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('Referral workflow', () => {
  const admin = { userId: 'owner', role: 'ADMIN' };
  const colleague = { userId: 'colleague', role: 'REFERRER' };
  let db: any;
  let storage: any;
  let service: ReferralsService;
  beforeEach(() => {
    db = {
      referral: {
        findFirst: jest
          .fn()
          .mockResolvedValue({
            id: 'case',
            status: 'SUBMITTED',
            ownerId: 'owner',
            patientId: null,
            referrerId: 'colleague',
            fullName: 'Paciente',
            rut: '123456785',
            email: 'patient@example.test',
            phone: '+56912345678',
          }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      patient: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'patient' }),
      },
      referralFile: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 'file' }),
      },
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ name: 'Profesional', email: 'owner@example.test' }),
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      referralTimelineEvent: { create: jest.fn().mockResolvedValue({}) },
      referralNotificationEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    db.$transaction = jest.fn(async (callback: any) => callback(db));
    storage = {
      putObject: jest.fn().mockResolvedValue('key'),
      deleteObject: jest.fn().mockResolvedValue(undefined),
    };
    service = new ReferralsService(db as PrismaService, storage as R2Service);
  });
  it('creates accepted patients paused, without tracking or notification hooks', async () => {
    await expect(service.accept('case', {}, admin)).resolves.toEqual({
      patientId: 'patient',
    });
    const data = db.patient.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ userId: 'owner', status: 'PAUSED' });
    expect(data.trackingStartedAt).toBeUndefined();
    expect(data.whatsappOptedIn).toBeUndefined();
    expect(db.$transaction.mock.calls[0][1]).toEqual({
      isolationLevel: 'Serializable',
    });
  });
  it('rejects an already accepted case instead of creating a second patient', async () => {
    db.referral.findFirst.mockResolvedValue({ status: 'ACCEPTED' });
    await expect(service.accept('case', {}, admin)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(db.patient.create).not.toHaveBeenCalled();
  });
  it('detects duplicate RUT despite punctuation differences', async () => {
    db.patient.findMany.mockResolvedValue([{ rut: '12.345.678-5' }]);
    await expect(service.accept('case', {}, admin)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(db.patient.create).not.toHaveBeenCalled();
  });
  it('cannot link a patient from another owner', async () => {
    await expect(
      service.accept('case', { patientId: 'foreign' }, admin),
    ).rejects.toThrow('Paciente no disponible');
    expect(db.patient.findFirst).toHaveBeenCalledWith({
      where: { id: 'foreign', userId: 'owner', deletedAt: null },
    });
  });
  it('links an existing patient without modifying the internal record', async () => {
    db.patient.findFirst.mockResolvedValue({ id: 'existing' });
    await expect(
      service.accept('case', { patientId: 'existing' }, admin),
    ).resolves.toEqual({ patientId: 'existing' });
    expect(db.patient.create).not.toHaveBeenCalled();
  });
  it('converts serialization races into a retryable conflict', async () => {
    db.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('race', {
        code: 'P2034',
        clientVersion: '6',
      }),
    );
    await expect(service.accept('case', {}, admin)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
  it('requires both jaws before submission', async () => {
    db.referral.findFirst.mockResolvedValue({ status: 'DRAFT' });
    db.referralFile.findMany.mockResolvedValue([{ kind: 'STL_UPPER' }]);
    await expect(service.submit('case', colleague)).rejects.toThrow(
      'STL superior e inferior',
    );
    expect(db.referral.updateMany).not.toHaveBeenCalled();
  });
  it('submits a draft with both jaws and no patient creation', async () => {
    db.referral.findFirst.mockResolvedValue({ status: 'DRAFT' });
    db.referralFile.findMany.mockResolvedValue([
      { kind: 'STL_UPPER' },
      { kind: 'STL_LOWER' },
    ]);
    await service.submit('case', colleague);
    expect(db.referral.updateMany.mock.calls[0][0].data.status).toBe(
      'SUBMITTED',
    );
    expect(db.patient.create).not.toHaveBeenCalled();
  });
  it('disabling an owned colleague invalidates existing sessions', async () => {
    await service.colleagueAccess('colleague', false, admin);
    expect(db.user.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: 'colleague', role: 'REFERRER', referralOwnerId: 'owner' },
      data: { disabledAt: expect.any(Date), sessionVersion: { increment: 1 } },
    });
  });
  it('cleans up storage if revocation happens while uploading', async () => {
    db.referral.updateMany.mockResolvedValue({ count: 0 });
    const buffer = Buffer.alloc(134);
    buffer.writeUInt32LE(1, 80);
    await expect(
      service.upload(
        'case',
        'STL_UPPER',
        { buffer, size: 134, originalname: 'upper.stl' } as Express.Multer.File,
        colleague,
      ),
    ).rejects.toThrow();
    expect(storage.putObject).toHaveBeenCalled();
    expect(storage.deleteObject).toHaveBeenCalled();
    expect(db.referralFile.create).not.toHaveBeenCalled();
  });
});
