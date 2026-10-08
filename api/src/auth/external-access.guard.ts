import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';

export const ExternalAccess = () => SetMetadata('externalAccess', true);
export const PasswordSetupAccess = () =>
  SetMetadata('passwordSetupAccess', true);

/** Deny external accounts every existing/future route unless explicitly opted in. */
@Injectable()
export class ExternalAccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride(IS_PUBLIC_KEY, targets)) return true;
    const { user } = context.switchToHttp().getRequest();
    if (
      user?.mustChangePassword &&
      !this.reflector.getAllAndOverride('passwordSetupAccess', targets)
    ) {
      throw new ForbiddenException('Debes cambiar tu contraseña inicial.');
    }
    if (
      user?.role === 'REFERRER' &&
      !this.reflector.getAllAndOverride('externalAccess', targets)
    ) {
      throw new ForbiddenException(
        'Esta cuenta solo puede acceder a sus derivaciones.',
      );
    }
    return true;
  }
}
