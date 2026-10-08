import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';

/** Cookie-authenticated writes must originate from an explicitly trusted UI. */
@Injectable()
export class CookieOriginGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    if (
      ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ||
      !req.cookies?.access_token
    )
      return true;
    // Provider webhooks do not use our session cookie.
    if (
      this.reflector.getAllAndOverride(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const allowed = (process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    if (process.env.NODE_ENV !== 'production')
      allowed.push('http://localhost:3000');
    if (
      typeof req.headers.origin !== 'string' ||
      !allowed.includes(req.headers.origin)
    ) {
      throw new ForbiddenException('Origen de la solicitud no autorizado.');
    }
    return true;
  }
}
