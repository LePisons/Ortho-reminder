// In api/src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { validateEnv } from './config/env.validation';

async function bootstrap() {
  validateEnv();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableShutdownHooks();
  const isProd = process.env.NODE_ENV === 'production';

  app.use(helmet());
  app.use(cookieParser());

  // Strip properties not declared on the DTO (prevents mass-assignment) and run
  // the class-validator decorators. We strip rather than 400 on extra fields to
  // stay tolerant of the existing frontend payloads.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Env-driven CORS allowlist. ALLOWED_ORIGINS is a comma-separated list.
  // localhost is only permitted outside production for local dev.
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        // Same-origin / server-to-server / curl — no Origin header.
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      if (!isProd && origin === 'http://localhost:3000') {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  });

  // Patient images and avatars are stored privately in R2 and served via
  // short-lived signed URLs — no public static file serving.

  await app.listen(3001);
}
bootstrap();
