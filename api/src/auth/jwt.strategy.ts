import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: any) => {
          return request?.cookies?.access_token;
        },
        // Also accept `Authorization: Bearer <jwt>` for headless clients (CLI,
        // scripts). API keys use a separate guard; see api-key.guard.ts.
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET as string,
    });
  }

  async validate(payload: any) {
    if (typeof payload.sub !== 'string') throw new UnauthorizedException();
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.disabledAt || user.sessionVersion !== (payload.sessionVersion ?? 0)) {
      throw new UnauthorizedException();
    }
    return { userId: user.id, email: user.email, role: user.role, mustChangePassword: user.mustChangePassword };
  }
}
