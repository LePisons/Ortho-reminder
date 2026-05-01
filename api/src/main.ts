// In api/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as cookieParser from 'cookie-parser';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.use(cookieParser());
  app.enableCors({
    origin: function (origin, callback) {
      if (!origin || origin === 'http://localhost:3000' || (origin && origin.endsWith('.ngrok-free.app'))) {
        callback(null, true);
      } else if (process.env.ALLOWED_ORIGIN && origin === process.env.ALLOWED_ORIGIN) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });

  // Ensure uploads directory exists
  const uploadsDir = join(process.cwd(), 'uploads', 'patient-images');
  const avatarsDir = join(process.cwd(), 'uploads', 'avatars');
  
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
  }
  if (!existsSync(avatarsDir)) {
    mkdirSync(avatarsDir, { recursive: true });
  }

  // Serve uploaded files as static assets
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  await app.listen(3001);
}
bootstrap();
