import {
  Controller,
  Get,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import request = require('supertest');
import { ReferralsController } from './referrals.controller';
import { ReferralsService } from './referrals.service';
import { ReferralUploadGuard } from './referral-upload.guard';
import { ExternalAccessGuard } from '../auth/external-access.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../storage/r2.service';

@Controller('internal')
class InternalProbe {
  @Get() read() {
    return { private: true };
  }
}

describe('External referral HTTP boundaries', () => {
  let app: INestApplication;
  const cases = [
    {
      id: 'a',
      ownerId: 'admin-a',
      referrerId: 'colleague-a',
      revokedAt: null,
      patientId: null,
      fullName: 'Caso A',
      status: 'DRAFT',
    },
    {
      id: 'b',
      ownerId: 'admin-a',
      referrerId: 'colleague-b',
      revokedAt: null,
      patientId: null,
      fullName: 'Caso B',
      status: 'DRAFT',
    },
    {
      id: 'revoked',
      ownerId: 'admin-a',
      referrerId: 'colleague-a',
      revokedAt: new Date(),
      patientId: null,
      status: 'DRAFT',
    },
  ];
  const matches = (c: (typeof cases)[number], w: any) =>
    (!w.id || c.id === w.id) &&
    (!w.ownerId || c.ownerId === w.ownerId) &&
    (!w.referrerId || c.referrerId === w.referrerId) &&
    (w.revokedAt !== null || c.revokedAt === null);
  const prisma = {
    referral: {
      findFirst: jest.fn(
        async ({ where }: any) => cases.find((c) => matches(c, where)) || null,
      ),
      findMany: jest.fn(async ({ where }: any) =>
        cases.filter((c) => matches(c, where)),
      ),
    },
    referralFile: { findFirst: jest.fn(async () => null) },
    auditLog: { create: jest.fn(async () => ({})) },
    referralNotificationEvent: { create: jest.fn(async () => ({})) },
  };
  const r2 = { putObject: jest.fn(), getObject: jest.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ReferralsController, InternalProbe],
      providers: [
        ReferralsService,
        ReferralUploadGuard,
        RolesGuard,
        { provide: PrismaService, useValue: prisma },
        { provide: R2Service, useValue: r2 },
      ],
    }).compile();
    app = module.createNestApplication();
    // Only in this test app: simulate identities established by CombinedAuthGuard.
    app.use((req: any, _res: any, next: () => void) => {
      req.user = {
        userId: req.headers['x-test-user'] || 'colleague-a',
        role: req.headers['x-test-role'] || 'REFERRER',
        mustChangePassword: req.headers['x-test-initial'] === 'yes',
      };
      next();
    });
    app.useGlobalGuards(new ExternalAccessGuard(module.get(Reflector)));
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });

  it('denies an external user an unmarked internal route', async () => {
    await request(app.getHttpServer()).get('/internal').expect(403);
  });
  it.each(['crop-proposal', 'crops'])(
    'blocks foreign and revoked crop uploads before processing: %s',
    async (action) => {
      for (const id of ['b', 'revoked']) {
        await request(app.getHttpServer())
          .post(`/referrals/${id}/files/original/${action}`)
          .field('consent', 'true')
          .attach('file', Buffer.from('not-an-image'), 'preview.jpg')
          .expect(404);
      }
      expect(r2.putObject).not.toHaveBeenCalled();
    },
  );
  it('keeps crop configuration scoped and uncached', async () => {
    await request(app.getHttpServer())
      .get('/referrals/b/crop-config')
      .expect(404);
    const response = await request(app.getHttpServer())
      .get('/referrals/a/crop-config')
      .expect(200);
    expect(Object.keys(response.body)).toEqual(['available']);
    expect(response.headers['cache-control']).toBe('no-store');
  });
  it('blocks case access until the initial password has been changed', async () => {
    await request(app.getHttpServer())
      .get('/referrals')
      .set('x-test-initial', 'yes')
      .expect(403);
  });
  it('lists only the current colleague’s unrevoked cases', async () => {
    const res = await request(app.getHttpServer())
      .get('/referrals')
      .expect(200);
    expect(res.body.map((r: any) => r.id)).toEqual(['a']);
    expect(res.headers['cache-control']).toBe('no-store');
  });
  it.each(['b', 'revoked', 'unknown'])(
    'hides inaccessible case %s',
    async (id) => {
      await request(app.getHttpServer()).get(`/referrals/${id}`).expect(404);
      await request(app.getHttpServer())
        .patch(`/referrals/${id}/files/photo/view`)
        .send({ photoView: 'OCCLUSAL_UPPER' })
        .expect(404);
      await request(app.getHttpServer())
        .get(`/referrals/${id}/files/any`)
        .expect(404);
      await request(app.getHttpServer())
        .post(`/referrals/${id}/comments`)
        .send({ content: 'Hola' })
        .expect(404);
    },
  );
  it('denies another administrator access to the case', async () => {
    await request(app.getHttpServer())
      .get('/referrals/a')
      .set('x-test-role', 'ADMIN')
      .set('x-test-user', 'admin-b')
      .expect(404);
  });
  it.each(['colleagues', 'shareable-patients', 'a/duplicates'])(
    'denies external access to admin route %s',
    async (path) => {
      await request(app.getHttpServer()).get(`/referrals/${path}`).expect(403);
    },
  );
  it.each([
    'a/accept',
    'a/revoke',
    'a/setups',
    'a/request-info',
    'share',
    'colleagues',
  ])('denies external mutation %s', async (path) => {
    await request(app.getHttpServer())
      .post(`/referrals/${path}`)
      .send({ role: 'ADMIN', ownerId: 'colleague-a' })
      .expect(403);
  });
  it('does not let STAFF inherit referral access', async () => {
    await request(app.getHttpServer())
      .get('/referrals')
      .set('x-test-role', 'STAFF')
      .expect(403);
  });
  it('checks ownership before accepting an upload', async () => {
    await request(app.getHttpServer())
      .post('/referrals/b/files')
      .field('kind', 'STL_UPPER')
      .attach('file', Buffer.from('invalid'), 'test.stl')
      .expect(404);
    expect(r2.putObject).not.toHaveBeenCalled();
  });
  it('rejects non-STL bytes even when named .stl', async () => {
    await request(app.getHttpServer())
      .post('/referrals/a/files')
      .field('kind', 'STL_UPPER')
      .attach('file', Buffer.from('<script>alert(1)</script>'), 'test.stl')
      .expect(400);
    expect(r2.putObject).not.toHaveBeenCalled();
  });
  it('rejects an unrecognized upload category', async () => {
    await request(app.getHttpServer())
      .post('/referrals/a/files')
      .field('kind', 'EXECUTABLE')
      .attach('file', Buffer.from('MZ'), 'test.exe')
      .expect(400);
  });
  it('does not allow a file id from another case', async () => {
    await request(app.getHttpServer())
      .get('/referrals/a/files/file-from-b')
      .expect(404);
    expect(prisma.referralFile.findFirst).toHaveBeenLastCalledWith({
      where: { id: 'file-from-b', referralId: 'a', removedAt: null },
    });
    expect(r2.getObject).not.toHaveBeenCalled();
  });
  it('rejects unsafe setup URLs for administrators', async () => {
    await request(app.getHttpServer())
      .post('/referrals/a/setups')
      .set('x-test-role', 'ADMIN')
      .set('x-test-user', 'admin-a')
      .send({ title: 'Setup', url: 'javascript:alert(1)' })
      .expect(400);
  });
  it.each(['b', 'revoked'])(
    'blocks decisions on inaccessible case %s',
    async (id) => {
      await request(app.getHttpServer())
        .post(`/referrals/${id}/setups/setup/decision`)
        .send({ decision: 'APPROVED' })
        .expect(404);
    },
  );
  it('does not let a colleague change workflow stages', async () => {
    await request(app.getHttpServer())
      .patch('/referrals/a/stage')
      .send({ stage: 'DELIVERED', expectedStage: 'MANUFACTURING' })
      .expect(403);
  });
  it('does not let an administrator impersonate a setup approval', async () => {
    await request(app.getHttpServer())
      .post('/referrals/a/setups/setup/decision')
      .set('x-test-role', 'ADMIN')
      .set('x-test-user', 'admin-a')
      .send({ decision: 'APPROVED' })
      .expect(403);
  });
  it('validates decisions before any mutation', async () => {
    await request(app.getHttpServer())
      .post('/referrals/a/setups/setup/decision')
      .send({ decision: 'ANYTHING' })
      .expect(400);
  });
});
