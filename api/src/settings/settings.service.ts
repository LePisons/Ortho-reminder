import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface UpdateSettingDto {
  key: string;
  value: string;
}

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.setting.findMany();
  }

  async updateBatch(settings: UpdateSettingDto[]) {
    return this.prisma.$transaction(
      settings.map((setting) =>
        this.prisma.setting.upsert({
          where: { key: setting.key },
          update: { value: setting.value },
          create: { key: setting.key, value: setting.value },
        }),
      ),
    );
  }
}
