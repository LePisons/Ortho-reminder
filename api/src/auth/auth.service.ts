import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async signUp(email: string, password: string, name?: string) {
    // 1. Hash the user's password for security
    const hashedPassword = await bcrypt.hash(password, 10);

    // 2. Create the new user in the database
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    });

    // 3. Remove password from the returned object
    const { password: _, ...result } = user;
    return result;
  }

  async signIn(email: string, pass: string) {
    // 1. Find the user by email
    const user = await this.prisma.user.findUnique({ where: { email } });

    // 2. If user doesn't exist or password doesn't match, throw an error
    if (!user || !(await bcrypt.compare(pass, user.password))) {
      throw new UnauthorizedException();
    }

    // 3. If credentials are valid, generate a JWT
    const payload = { sub: user.id, email: user.email };
    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }
}
