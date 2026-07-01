import { Module } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { ApiKeysController } from './api-keys.controller';

// PrismaService and AuditService come from their @Global() modules.
// ApiKeysService is exported so the global CombinedAuthGuard (AppModule) can
// verify keys.
@Module({
  controllers: [ApiKeysController],
  providers: [ApiKeysService],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}
