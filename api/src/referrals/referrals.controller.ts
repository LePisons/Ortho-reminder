import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Request,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { Readable } from 'stream';
import { Response } from 'express';
import { Role } from '@prisma/client';
import { ExternalAccess } from '../auth/external-access.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ReferralsService } from './referrals.service';
import { ReferralUploadGuard } from './referral-upload.guard';
import {
  AcceptReferralDto,
  ColleagueAccessDto,
  CommentDto,
  CreateColleagueDto,
  ReferralInputDto,
  SetupDto,
  SharePatientDto,
  UploadReferralFileDto,
  PhotoViewDto,
} from './referrals.dto';

@Controller('referrals')
@ExternalAccess()
@UseGuards(RolesGuard)
@Roles(Role.ADMIN, Role.REFERRER)
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get('shareable-patients')
  @Roles(Role.ADMIN)
  shareablePatients(@Request() req) {
    return this.referrals.shareablePatients(req.user);
  }

  @Get('patient/:patientId')
  @Roles(Role.ADMIN)
  forPatient(@Param('patientId') patientId: string, @Request() req) {
    return this.referrals.forPatient(patientId, req.user);
  }

  @Get('colleagues')
  @Roles(Role.ADMIN)
  colleagues(@Request() req) {
    return this.referrals.listColleagues(req.user);
  }

  @Post('colleagues')
  @Roles(Role.ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  createColleague(
    @Body() dto: CreateColleagueDto,
    @Request() req,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.referrals.createColleague(dto, req.user);
  }

  @Patch('colleagues/:id/access')
  @Roles(Role.ADMIN)
  colleagueAccess(
    @Param('id') id: string,
    @Body() dto: ColleagueAccessDto,
    @Request() req,
  ) {
    return this.referrals.colleagueAccess(id, dto.enabled, req.user);
  }

  @Post('colleagues/:id/reset-password')
  @Roles(Role.ADMIN)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  resetPassword(
    @Param('id') id: string,
    @Request() req,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.referrals.resetPassword(id, req.user);
  }

  @Post('share')
  @Roles(Role.ADMIN)
  share(@Body() dto: SharePatientDto, @Request() req) {
    return this.referrals.share(dto, req.user);
  }

  @Get()
  list(@Request() req, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    return this.referrals.list(req.user);
  }

  @Post()
  @Roles(Role.REFERRER)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  create(@Body() dto: ReferralInputDto, @Request() req) {
    return this.referrals.create(dto, req.user);
  }

  @Get(':id')
  detail(
    @Param('id') id: string,
    @Request() req,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.referrals.detail(id, req.user);
  }

  @Patch(':id')
  edit(@Param('id') id: string, @Body() dto: ReferralInputDto, @Request() req) {
    return this.referrals.edit(id, dto, req.user);
  }

  @Post(':id/submit')
  @Roles(Role.REFERRER)
  submit(@Param('id') id: string, @Request() req) {
    return this.referrals.submit(id, req.user);
  }

  @Post(':id/comments')
  comment(@Param('id') id: string, @Body() dto: CommentDto, @Request() req) {
    return this.referrals.comment(id, dto.content, req.user);
  }

  @Post(':id/request-info')
  @Roles(Role.ADMIN)
  requestInfo(
    @Param('id') id: string,
    @Body() dto: CommentDto,
    @Request() req,
  ) {
    return this.referrals.comment(id, dto.content, req.user, true);
  }

  @Post(':id/setups')
  @Roles(Role.ADMIN)
  setup(@Param('id') id: string, @Body() dto: SetupDto, @Request() req) {
    return this.referrals.setup(id, dto, req.user);
  }

  @Get(':id/duplicates')
  @Roles(Role.ADMIN)
  duplicates(@Param('id') id: string, @Request() req) {
    return this.referrals.duplicates(id, req.user);
  }

  @Post(':id/accept')
  @Roles(Role.ADMIN)
  accept(
    @Param('id') id: string,
    @Body() dto: AcceptReferralDto,
    @Request() req,
  ) {
    return this.referrals.accept(id, dto, req.user);
  }

  @Post(':id/revoke')
  @Roles(Role.ADMIN)
  revoke(@Param('id') id: string, @Request() req) {
    return this.referrals.revoke(id, req.user);
  }

  @Post(':id/files')
  @UseGuards(ReferralUploadGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 60 * 1024 * 1024, files: 1, fields: 2 },
    }),
  )
  upload(
    @Param('id') id: string,
    @Body() dto: UploadReferralFileDto,
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    return this.referrals.upload(id, dto.kind, file, req.user, dto.photoView);
  }

  @Patch(':id/files/:fileId/view')
  classifyPhoto(
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @Body() dto: PhotoViewDto,
    @Request() req,
  ) {
    return this.referrals.classifyPhoto(id, fileId, dto.photoView, req.user);
  }

  @Get(':id/files/:fileId')
  async file(
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @Request() req,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { file, object } = await this.referrals.download(
      id,
      fileId,
      req.user,
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(object.Body as Readable, {
      type: file.contentType,
      disposition: `attachment; filename="registro.${file.contentType === 'model/stl' ? 'stl' : file.contentType.split('/')[1]}"`,
      length: object.ContentLength,
    });
  }
}
