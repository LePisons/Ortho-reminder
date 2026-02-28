import { Controller, Get, Body, Put } from '@nestjs/common';
import { SettingsService, UpdateSettingDto } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async findAll() {
    return this.settingsService.findAll();
  }

  @Put()
  async updateBatch(@Body() settings: UpdateSettingDto[]) {
    return this.settingsService.updateBatch(settings);
  }
}
