import { ReferralsService } from './referrals.service';
import { safePredictions, validateCropRecipe } from './crop-validation';

const recipe = {
  centerX: 100,
  centerY: 100,
  width: 100,
  height: 100,
  rotation: 0,
  flipX: false,
  flipY: false,
};
describe('Denticrop private crops', () => {
  let db: any,
    storage: any,
    service: ReferralsService,
    fetchMock: jest.SpyInstance;
  const actor = { userId: 'colleague', role: 'REFERRER' };
  const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const file = {
    buffer,
    size: buffer.length,
    originalname: 'recorte.jpg',
  } as Express.Multer.File;
  beforeEach(() => {
    db = {
      referral: {
        findFirst: jest.fn().mockResolvedValue({ id: 'case', revokedAt: null }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      referralFile: {
        findFirst: jest.fn().mockResolvedValue({ id: 'original' }),
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn().mockResolvedValue({ id: 'crop' }),
      },
      auditLog: { create: jest.fn() },
      referralNotificationEvent: { create: jest.fn() },
    };
    db.$transaction = jest.fn((fn) => fn(db));
    storage = {
      putObject: jest.fn(),
      deleteObject: jest.fn().mockResolvedValue(undefined),
    };
    service = new ReferralsService(db, storage);
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });
  afterEach(() => jest.restoreAllMocks());
  it('saves a new private file linked to the scoped original, without overwriting it', async () => {
    await service.saveCrop(
      'case',
      'original',
      JSON.stringify(recipe),
      'OCCLUSAL_UPPER',
      file,
      actor,
    );
    expect(db.referralFile.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'original',
        referralId: 'case',
        kind: 'PHOTO',
        sourceFileId: null,
      },
    });
    expect(db.referralFile.create.mock.calls[0][0].data).toMatchObject({
      sourceFileId: 'original',
      editRecipe: recipe,
      kind: 'PHOTO',
      photoView: 'OCCLUSAL_UPPER',
    });
    expect(db.referral.updateMany.mock.calls[0][0].where).toMatchObject({
      referrerId: 'colleague',
      revokedAt: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('rejects foreign files, non-photo originals and crops used as a source', async () => {
    db.referralFile.findFirst.mockResolvedValue(null);
    await expect(
      service.saveCrop(
        'case',
        'foreign',
        JSON.stringify(recipe),
        'UNASSIGNED',
        file,
        actor,
      ),
    ).rejects.toThrow('original');
    expect(storage.putObject).not.toHaveBeenCalled();
  });
  it('does not process revoked cases even for the owner', async () => {
    db.referral.findFirst.mockResolvedValue({ revokedAt: new Date() });
    await expect(
      service.cropProposal('case', 'original', 'true', file, {
        userId: 'owner',
        role: 'ADMIN',
      }),
    ).rejects.toThrow('disponible');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('requires explicit consent before any external processing', async () => {
    await expect(
      service.cropProposal('case', 'original', 'false', file, actor),
    ).rejects.toThrow('Confirma');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('does not send without configuration', async () => {
    jest.spyOn(service, 'cropConfig').mockReturnValue({ available: false });
    await expect(
      service.cropProposal('case', 'original', 'true', file, actor),
    ).rejects.toThrow('configurada');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('cleans up a crop if access is revoked during upload', async () => {
    db.referral.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.saveCrop(
        'case',
        'original',
        JSON.stringify(recipe),
        'UNASSIGNED',
        file,
        actor,
      ),
    ).rejects.toThrow();
    expect(storage.deleteObject).toHaveBeenCalled();
    expect(db.referralFile.create).not.toHaveBeenCalled();
  });
  it('returns only safe predictions and audits consent without image content', async () => {
    jest.spyOn(service, 'cropConfig').mockReturnValue({ available: true });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        predictions: [
          {
            x: 300,
            y: 300,
            width: 100,
            height: 100,
            confidence: 0.9,
            class: 'frontal',
            secret: 'omit',
          },
        ],
      }),
    });
    const result = await service.cropProposal(
      'case',
      'original',
      'true',
      file,
      actor,
    );
    expect(result.predictions[0]).not.toHaveProperty('secret');
    expect(db.auditLog.create.mock.calls[0][0].data.metadata).toEqual({
      fileId: 'original',
      provider: 'Roboflow',
    });
    expect(fetchMock.mock.calls[0][1].body).toBe(buffer.toString('base64'));
  });
  it('rejects oversized previews before contacting the provider', async () => {
    await expect(
      service.cropProposal(
        'case',
        'original',
        'true',
        { ...file, size: 600000 },
        actor,
      ),
    ).rejects.toThrow('reducida');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
describe('Crop validation', () => {
  it('rejects malformed, excessive and injected recipes', () => {
    for (const value of [
      'null',
      '[]',
      'broken',
      JSON.stringify({ ...recipe, width: 0 }),
      JSON.stringify({ ...recipe, rotation: 200000 }),
      JSON.stringify({ ...recipe, sourceFileId: 'foreign' }),
    ])
      expect(() => validateCropRecipe(value)).toThrow();
  });
  it('removes low confidence and invalid predictions', () => {
    expect(
      safePredictions({
        predictions: [
          {
            x: 20,
            y: 30,
            width: 10,
            height: 10,
            confidence: 0.1,
            class: 'low',
          },
          {
            x: 20,
            y: 30,
            width: -1,
            height: 10,
            confidence: 0.9,
            class: 'bad',
          },
        ],
      }),
    ).toEqual([]);
  });
});
