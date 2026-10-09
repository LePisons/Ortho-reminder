import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../storage/r2.service';

@Injectable()
export class ReferralOriginalCleanupService {
  private running = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
  ) {}

  @Interval(30_000)
  async cleanup() {
    if (this.running) return;
    this.running = true;
    try {
      // A committed crop is required. Existing originals are never swept retroactively.
      const originals = await this.prisma.referralFile.findMany({
        where: {
          removedAt: { not: null },
          storageDeletedAt: null,
          kind: 'PHOTO',
          sourceFileId: null,
          crops: { some: { removedAt: null } },
        },
        select: { id: true, key: true },
        take: 25,
        orderBy: { removedAt: 'asc' },
      });
      for (const original of originals) {
        try {
          await this.r2.deleteObject(original.key);
          await this.prisma.referralFile.update({
            where: { id: original.id },
            data: { storageDeletedAt: new Date() },
          });
        } catch {
          /* Persisted pending state retries after storage errors or restarts. */
        }
      }
    } finally {
      this.running = false;
    }
  }
}
