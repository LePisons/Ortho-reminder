import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../common/types/request.types';

@Controller('patients')
@UseGuards(AuthGuard)
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  create(
    @Body() createPatientDto: CreatePatientDto,
    @Request() req: AuthenticatedRequest, // <-- 2. APPLY THE TYPE
  ) {
    // 3. Use 'req.user.sub' for the user ID
    return this.patientsService.create(createPatientDto, req.user.sub);
  }

  @Get('stats')
  getStats(@Request() req: AuthenticatedRequest) {
    return this.patientsService.getStats(req.user.sub);
  }

  @Get('upcoming')
  findUpcomingChanges(
    @Request() req: AuthenticatedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit: number,
  ) {
    return this.patientsService.findUpcomingChanges(req.user.sub, page, limit);
  }

  // IMPORTANT: The generic '/:id' route must come AFTER specific routes like 'stats' and 'upcoming'
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.patientsService.findOne(id, req.user.sub);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updatePatientDto: UpdatePatientDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.patientsService.update(id, updatePatientDto, req.user.sub);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.patientsService.remove(id, req.user.sub);
  }

  // IMPORTANT: The main `findAll` route should be LAST to avoid matching '/stats' or '/upcoming'
  @Get()
  findAll(
    @Request() req: AuthenticatedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.patientsService.findAll(req.user.sub, page, limit);
  }
}
