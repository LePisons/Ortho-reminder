import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

/**
 * Admin-only management of API keys. The global CombinedAuthGuard authenticates;
 * RolesGuard + @Roles(ADMIN) restricts these routes to admins.
 */
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  @Post()
  create(@Body() dto: CreateApiKeyDto, @Request() req) {
    const userId = dto.userId ?? req.user.userId;
    return this.apiKeys.create(userId, dto.name, req.user.userId);
  }

  @Get()
  list() {
    return this.apiKeys.list();
  }

  @Delete(':id')
  revoke(@Param('id') id: string, @Request() req) {
    return this.apiKeys.revoke(id, req.user.userId);
  }
}
