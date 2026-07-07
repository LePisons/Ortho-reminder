import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { IS_PUBLIC_KEY } from './public.decorator';
import { LAB_ACCESS_KEY } from './lab-access.decorator';

/**
 * Global whitelist for LAB_TECH users. Registered after CombinedAuthGuard, so
 * req.user is already populated. LAB_TECH may only reach @Public() routes and
 * routes marked @LabAccess(); everything else is a 403. ADMIN/STAFF (and
 * unauthenticated public requests) pass through untouched.
 */
@Injectable()
export class LabTechGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    if (!user || user.role !== Role.LAB_TECH) {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const hasLabAccess = this.reflector.getAllAndOverride<boolean>(
      LAB_ACCESS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic || hasLabAccess) {
      return true;
    }

    throw new ForbiddenException(
      'Lab technician accounts can only access lab endpoints',
    );
  }
}
