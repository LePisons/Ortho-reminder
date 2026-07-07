import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Request,
} from '@nestjs/common';
import { LabService } from './lab.service';
import { UpdateProductionDto } from './dto/update-production.dto';
import { LabAccess } from '../auth/lab-access.decorator';

/**
 * Lab production board. @LabAccess() whitelists these routes for LAB_TECH
 * users (see LabTechGuard); ADMIN/STAFF reach them through the normal global
 * auth. Data is practice-wide by design — lab orders aren't user-scoped.
 */
@Controller('lab')
@LabAccess()
export class LabController {
  constructor(private readonly labService: LabService) {}

  @Get('orders')
  listOrders() {
    return this.labService.listOrders();
  }

  @Patch('orders/:id/production')
  updateProduction(
    @Param('id') id: string,
    @Body() dto: UpdateProductionDto,
    @Request() req,
  ) {
    return this.labService.updateProduction(id, dto, req.user.userId);
  }

  @Get('orders/:id/download-url')
  getDownloadUrl(@Param('id') id: string) {
    return this.labService.getDownloadUrl(id);
  }
}
