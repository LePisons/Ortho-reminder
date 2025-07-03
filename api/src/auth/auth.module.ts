import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaService } from '../prisma/prisma.service';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    JwtModule.register({
      global: true, // Makes the JWT service available across the entire app
      secret: process.env.JWT_SECRET, // Use the secret from our .env file
      signOptions: { expiresIn: '1d' }, // Tokens will expire after 1 day
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PrismaService], // Provide all necessary services
})
export class AuthModule {}
