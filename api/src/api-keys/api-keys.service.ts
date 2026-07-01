import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

// Raw keys look like `ork_<40 url-safe chars>`. The first PREFIX_LEN characters
// (including the `ork_` marker) are stored in the clear as `prefix` for O(1)
// lookup and display; the whole key is bcrypt-hashed. The `ork_` marker also
// lets the combined auth guard route Bearer tokens to the right verifier.
export const API_KEY_PREFIX = 'ork_';
const PREFIX_LEN = API_KEY_PREFIX.length + 8; // "ork_" + 8 chars
const BCRYPT_ROUNDS = 12;

function generateRawKey(): string {
  // 30 bytes base64url ≈ 40 chars, no padding/special chars.
  const body = randomBytes(30).toString('base64url');
  return `${API_KEY_PREFIX}${body}`;
}

export interface VerifiedKey {
  userId: string;
  email: string;
  role: string;
}

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Create a key for `userId`. Returns the raw key exactly once — it is never
   * retrievable again.
   */
  async create(userId: string, name: string, actorId: string) {
    const raw = generateRawKey();
    const prefix = raw.slice(0, PREFIX_LEN);
    const hashedKey = await bcrypt.hash(raw, BCRYPT_ROUNDS);

    const record = await this.prisma.apiKey.create({
      data: { name, prefix, hashedKey, userId },
      select: { id: true, name: true, prefix: true, createdAt: true },
    });

    await this.audit.log({
      actorId,
      action: 'CREATE',
      entity: 'ApiKey',
      entityId: record.id,
      metadata: { name, prefix, userId },
    });

    return { ...record, key: raw };
  }

  /** List key metadata (never the secret). Admin-only route → all keys. */
  list() {
    return this.prisma.apiKey.findMany({
      select: {
        id: true,
        name: true,
        prefix: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
        user: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Revoke a key (idempotent). Admin-only route → any key. */
  async revoke(id: string, actorId: string) {
    const existing = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('API key not found');
    }
    if (!existing.revokedAt) {
      await this.prisma.apiKey.update({
        where: { id },
        data: { revokedAt: new Date() },
      });
      await this.audit.log({
        actorId,
        action: 'UPDATE',
        entity: 'ApiKey',
        entityId: id,
        metadata: { revoked: true },
      });
    }
    return { ok: true };
  }

  /**
   * Verify a raw key from an Authorization header. Returns the owning user in
   * the same shape JwtStrategy.validate produces, or null if invalid/revoked.
   */
  async verify(raw: string): Promise<VerifiedKey | null> {
    if (!raw.startsWith(API_KEY_PREFIX) || raw.length <= PREFIX_LEN) {
      return null;
    }
    const prefix = raw.slice(0, PREFIX_LEN);
    const record = await this.prisma.apiKey.findUnique({
      where: { prefix },
      include: { user: true },
    });
    if (!record || record.revokedAt) {
      return null;
    }
    const matches = await bcrypt.compare(raw, record.hashedKey);
    if (!matches) {
      return null;
    }

    // Fire-and-forget usage timestamp; must not block or fail the request.
    this.prisma.apiKey
      .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);

    return {
      userId: record.user.id,
      email: record.user.email,
      role: record.user.role,
    };
  }
}
