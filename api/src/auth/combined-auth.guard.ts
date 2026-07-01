import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC_KEY } from './public.decorator';
import { ApiKeysService, API_KEY_PREFIX } from '../api-keys/api-keys.service';

/**
 * Global auth guard. Honors @Public(), then:
 *   - `Authorization: Bearer ork_...` → verified as an API key (agents/CLI).
 *   - everything else → the existing JWT path (httpOnly cookie or Bearer JWT).
 *
 * On success both paths populate req.user as { userId, email, role }, so
 * downstream per-user scoping is identical regardless of credential type.
 */
@Injectable()
export class CombinedAuthGuard extends JwtAuthGuard {
  constructor(
    reflector: Reflector,
    private readonly apiKeys: ApiKeysService,
  ) {
    super(reflector);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const auth: string | undefined = request.headers?.authorization;
    const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;

    if (bearer?.startsWith(API_KEY_PREFIX)) {
      const user = await this.apiKeys.verify(bearer);
      if (!user) {
        throw new UnauthorizedException('Invalid API key');
      }
      request.user = user;
      return true;
    }

    // Fall back to the JWT strategy (cookie or Bearer JWT), including @Public().
    return super.canActivate(context) as Promise<boolean>;
  }
}
