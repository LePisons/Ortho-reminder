import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { CookieOriginGuard } from './cookie-origin.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';

describe('Live session revocation', () => {
  let strategy: JwtStrategy;
  const db = { user: { findUnique: jest.fn() } };
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-only-secret-at-least-32-characters';
    strategy = new JwtStrategy(db as unknown as PrismaService);
  });
  it('reads current roles rather than trusting an old ADMIN claim', async () => {
    db.user.findUnique.mockResolvedValue({
      id: 'u',
      role: 'REFERRER',
      email: 'a@example.test',
      sessionVersion: 0,
      disabledAt: null,
      mustChangePassword: false,
    });
    expect((await strategy.validate({ sub: 'u', role: 'ADMIN' })).role).toBe(
      'REFERRER',
    );
  });
  it.each([
    null,
    { disabledAt: new Date(), sessionVersion: 0 },
    { disabledAt: null, sessionVersion: 2 },
  ])('rejects deleted, disabled or replaced sessions', async (row) => {
    db.user.findUnique.mockResolvedValue(row);
    await expect(
      strategy.validate({ sub: 'u', sessionVersion: 0 }),
    ).rejects.toThrow();
  });
});

describe('Cookie origin protection', () => {
  const reflector = new Reflector();
  const guard = new CookieOriginGuard(reflector);
  const context = (origin?: string, method = 'POST', cookie = true) =>
    ({
      getHandler: () => () => undefined,
      getClass: () => class {},
      switchToHttp: () => ({
        getRequest: () => ({
          method,
          headers: { origin },
          cookies: cookie ? { access_token: 'token' } : {},
        }),
      }),
    }) as unknown as ExecutionContext;
  const original = process.env.ALLOWED_ORIGINS;
  beforeAll(() => {
    process.env.ALLOWED_ORIGINS = 'https://ortho.example.test';
  });
  afterAll(() => {
    if (original === undefined) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = original;
  });
  it('permits the configured app origin', () =>
    expect(guard.canActivate(context('https://ortho.example.test'))).toBe(
      true,
    ));
  it.each([
    undefined,
    'https://evil.example.test',
    'https://ortho.example.test.evil.test',
  ])('blocks cookie writes from %s', (origin) =>
    expect(() => guard.canActivate(context(origin))).toThrow(),
  );
  it('leaves safe reads and bearer-only clients working', () => {
    expect(guard.canActivate(context(undefined, 'GET'))).toBe(true);
    expect(guard.canActivate(context(undefined, 'POST', false))).toBe(true);
  });
});
