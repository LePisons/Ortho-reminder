import { ReferralOriginalCleanupService } from './referral-original-cleanup.service';
describe('Original image cleanup', () => {
  it('deletes only queued originals with committed crops and retries storage failures', async () => {
    const db: any = {
      referralFile: {
        findMany: jest.fn().mockResolvedValue([{ id: 'a', key: 'original/a' }]),
        update: jest.fn(),
      },
    };
    const storage: any = {
      deleteObject: jest
        .fn()
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValue(undefined),
    };
    const worker = new ReferralOriginalCleanupService(db, storage);
    await worker.cleanup();
    expect(db.referralFile.update).not.toHaveBeenCalled();
    expect(db.referralFile.findMany.mock.calls[0][0].where).toMatchObject({
      removedAt: { not: null },
      storageDeletedAt: null,
      sourceFileId: null,
      crops: { some: { removedAt: null } },
    });
    await worker.cleanup();
    expect(storage.deleteObject).toHaveBeenNthCalledWith(2, 'original/a');
    expect(db.referralFile.update).toHaveBeenCalledWith({
      where: { id: 'a' },
      data: { storageDeletedAt: expect.any(Date) },
    });
  });
});
