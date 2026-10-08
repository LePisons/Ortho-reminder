import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ReferralInputDto,
  UploadReferralFileDto,
  PhotoViewDto,
} from './referrals.dto';
import { ReferralsService } from './referrals.service';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../storage/r2.service';

describe('Treatment request and photo organization', () => {
  const input = {
    fullName: 'Paciente de prueba',
    rut: '123456785',
    email: 'test@example.test',
    phone: '+56912345678',
    reason: 'Solicitud de prueba',
  };
  it('accepts existing referrals without a treatment request', async () => {
    expect(
      await validate(plainToInstance(ReferralInputDto, input)),
    ).toHaveLength(0);
  });
  it('validates nested instructions and strips unknown fields', async () => {
    const dto = plainToInstance(ReferralInputDto, {
      ...input,
      treatment: { upperMidline: 'Mantener', ownerId: 'other' },
    });
    expect(await validate(dto, { whitelist: true })).toHaveLength(0);
    expect(dto.treatment).toEqual({ upperMidline: 'Mantener' });
    const invalid = plainToInstance(ReferralInputDto, {
      ...input,
      treatment: { upperMidline: 'x'.repeat(1001) },
    });
    expect(await validate(invalid)).not.toHaveLength(0);
  });
  it('rejects invalid photo views and non-object requests', async () => {
    expect(
      await validate(plainToInstance(PhotoViewDto, { photoView: 'ANYTHING' })),
    ).not.toHaveLength(0);
    expect(
      await validate(
        plainToInstance(UploadReferralFileDto, {
          kind: 'PHOTO',
          photoView: 'OCCLUSAL_UPPER',
        }),
      ),
    ).toHaveLength(0);
    expect(
      await validate(
        plainToInstance(ReferralInputDto, { ...input, treatment: 'free form' }),
      ),
    ).not.toHaveLength(0);
  });
  function fixture() {
    const db = {
      referral: {
        findFirst: jest.fn().mockResolvedValue({ id: 'case', status: 'DRAFT' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      referralFile: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      referralNotificationEvent: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(),
    };
    db.$transaction.mockImplementation((callback) => callback(db));
    const storage = { putObject: jest.fn() };
    const service = new ReferralsService(
      db as unknown as PrismaService,
      storage as unknown as R2Service,
    );
    return { db, storage, service };
  }
  const actor = { userId: 'colleague', role: 'REFERRER' };
  it('saves instructions without discarding previous fields on legacy edits', async () => {
    const { service, db } = fixture();
    await service.edit(
      'case',
      { ...input, treatment: { elasticCuts: '13 y 23' } },
      actor,
    );
    expect(db.referral.updateMany.mock.calls[0][0].data.treatment).toEqual({
      elasticCuts: '13 y 23',
    });
    await service.edit('case', input, actor);
    expect(db.referral.updateMany.mock.calls[1][0].data).not.toHaveProperty(
      'treatment',
    );
  });
  it('changes only classification for a photo belonging to the accessible case', async () => {
    const { service, db, storage } = fixture();
    await service.classifyPhoto('case', 'photo', 'OCCLUSAL_LOWER', actor);
    expect(db.referralFile.updateMany).toHaveBeenCalledWith({
      where: { id: 'photo', referralId: 'case', kind: 'PHOTO' },
      data: { photoView: 'OCCLUSAL_LOWER' },
    });
    expect(storage.putObject).not.toHaveBeenCalled();
    expect(db.auditLog.create).toHaveBeenCalled();
  });
  it('stops a classification if access was revoked while the request ran', async () => {
    const { service, db } = fixture();
    db.referral.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.classifyPhoto('case', 'photo', 'OCCLUSAL_LOWER', actor),
    ).rejects.toThrow('Derivación no disponible');
    expect(db.referralFile.updateMany).not.toHaveBeenCalled();
  });
  it('cannot classify a file from another case or an STL', async () => {
    const { service, db } = fixture();
    db.referralFile.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.classifyPhoto('case', 'foreign', 'OCCLUSAL_LOWER', actor),
    ).rejects.toThrow('Fotografía no disponible');
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
});
