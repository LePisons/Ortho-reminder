import { Controller, Post, UseGuards, Request, Body, Get, Patch, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './local-auth.guard';
import { Public } from './public.decorator';
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

  @Get('profile')
  async getProfile(@Request() req) {
    const user = await this.usersService.findOne(req.user.userId);
    if (!user) return req.user;
    const { password, ...result } = user;
    return result;
  }

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
      updateData.password = await bcrypt.hash(body.newPassword, BCRYPT_ROUNDS);
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
