import { Controller, Post, UseGuards, Request, Body, Get, Patch, Res, BadRequestException } from '@nestjs/common';
import { ExternalAccess, PasswordSetupAccess } from './external-access.guard';
import { ChangePasswordDto } from './dto/change-password.dto';
import { PrismaService } from '../prisma/prisma.service';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './local-auth.guard';
import { Public } from './public.decorator';
import { LabAccess } from './lab-access.decorator';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';

// Auth cookie options. secure requires HTTPS, so it is only enabled in production.
const authCookieOptions = {
  httpOnly: true as const,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

const BCRYPT_ROUNDS = 12;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req, @Res({ passthrough: true }) res) {
    const { access_token, user } = await this.authService.login(req.user);
    res.cookie('access_token', access_token, {
      ...authCookieOptions,
      maxAge: 12 * 60 * 60 * 1000, // 12 hours (keep in sync with JWT expiresIn)
    });
    return { user };
  }

  // Public self-registration is disabled. Accounts are provisioned via the seed
  // script (see prisma/seed.ts) or an authenticated admin flow.

  @LabAccess()
  @ExternalAccess()
  @PasswordSetupAccess()
  @Get('profile')
  async getProfile(@Request() req) {
    const user = await this.usersService.findOne(req.user.userId);
    if (!user) return req.user;
    const { password, ...result } = user;
    return result;
  }

  @LabAccess()
  @ExternalAccess()
  @PasswordSetupAccess()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password')
  async changePassword(@Request() req, @Body() dto: ChangePasswordDto, @Res({ passthrough: true }) res) {
    const user = await this.usersService.findOne(req.user.userId);
    if (!user || !(await bcrypt.compare(dto.currentPassword, user.password))) {
      throw new BadRequestException('La contraseña actual no es correcta.');
    }
    if (dto.currentPassword === dto.newPassword || Buffer.byteLength(dto.newPassword, 'utf8') > 72) {
      throw new BadRequestException('Usa una contraseña distinta, de hasta 72 bytes.');
    }
    const password = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    const changed = await this.prisma.user.updateMany({
      where: { id: user.id, sessionVersion: user.sessionVersion },
      data: { password, mustChangePassword: false, sessionVersion: { increment: 1 } },
    });
    if (!changed.count) throw new BadRequestException('La cuenta cambió. Inicia sesión nuevamente.');
    res.clearCookie('access_token', authCookieOptions);
    return { success: true };
  }

  @LabAccess()
  @Patch('profile')
  async updateProfile(@Request() req, @Body() body: { name?: string; email?: string; currentPassword?: string; newPassword?: string }) {
    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.newPassword && body.currentPassword) {
      const user = await this.usersService.findOne(req.user.userId);
      if (!user || !(await bcrypt.compare(body.currentPassword, user.password))) {
        return { error: 'Current password is incorrect' };
      }
      if (body.newPassword.length < 12) throw new BadRequestException('Usa al menos 12 caracteres.');
      updateData.password = body.newPassword;
    }
    // update() already returns a safe projection (no password hash).
    return this.usersService.update(req.user.userId, updateData);
  }

  @Public()
  @Post('logout')
  logout(@Res({ passthrough: true }) res) {
    res.clearCookie('access_token', authCookieOptions);
    return { message: 'Logged out' };
  }
}
