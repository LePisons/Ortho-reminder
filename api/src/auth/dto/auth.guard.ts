import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthenticatedRequest } from '../../common/types/request.types'; // <-- IMPORT THE TYPE

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>(); // <-- Use the type here
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException();
    }

    try {
      const payload: { sub: string; email: string } =
        await this.jwtService.verifyAsync(token, {
          secret: process.env.JWT_SECRET,
        });

      // Now this assignment is type-safe because 'request' is typed correctly
      request.user = payload;
    } catch {
      throw new UnauthorizedException();
    }

    return true;
  }

  // No changes needed here, but it's good practice
  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
