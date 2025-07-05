// In api/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();

  // 2. ADD THIS LINE
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Automatically remove properties that are not in the DTO
    }),
  );

  await app.listen(3001);
}
bootstrap();
