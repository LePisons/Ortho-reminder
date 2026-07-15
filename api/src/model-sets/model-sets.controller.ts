import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Request,
  Res,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { Response } from 'express';
import { Readable } from 'stream';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ModelSetsService, Jaw, STL_CONTENT_TYPE } from './model-sets.service';
import { CreateModelSetDto } from './dto/create-model-set.dto';
import { UpdateModelSetDto } from './dto/update-model-set.dto';
import { R2Service } from '../storage/r2.service';
import { isValidStl } from '../storage/stl-validation';

// Binary STLs from intraoral scanners typically run 5-30 MB per jaw.
const MAX_STL_BYTES = 60 * 1024 * 1024;

const stlMulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_STL_BYTES },
};

@Controller('model-sets')
export class ModelSetsController {
  constructor(
    private readonly modelSets: ModelSetsService,
    private readonly r2: R2Service,
  ) {}

  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'upper', maxCount: 1 },
        { name: 'lower', maxCount: 1 },
      ],
      stlMulterOptions,
    ),
  )
  async create(
    @UploadedFiles()
    files: {
      upper?: Express.Multer.File[];
      lower?: Express.Multer.File[];
    },
    @Body() dto: CreateModelSetDto,
    @Request() req,
  ) {
    const jaws: { jaw: Jaw; file: Express.Multer.File }[] = [];
    if (files?.upper?.[0]) jaws.push({ jaw: 'upper', file: files.upper[0] });
    if (files?.lower?.[0]) jaws.push({ jaw: 'lower', file: files.lower[0] });
    if (jaws.length === 0) {
      throw new BadRequestException(
        'At least one STL file (upper or lower) is required',
      );
    }
    for (const { jaw, file } of jaws) {
      if (!isValidStl(file.buffer)) {
        throw new BadRequestException(`${jaw} file is not a valid STL`);
      }
    }

    // Upload to R2 first, then create the row; on failure remove the objects
    // so we never leave orphans (same pattern as patient-images upload).
    const uploaded: { jaw: Jaw; key: string; size: number }[] = [];
    try {
      for (const { jaw, file } of jaws) {
        const key = this.modelSets.buildKey(dto.patientId, jaw);
        await this.r2.putObject(key, file.buffer, STL_CONTENT_TYPE);
        uploaded.push({ jaw, key, size: file.size });
      }
      return await this.modelSets.create(dto, req.user.userId, uploaded);
    } catch (e) {
      await Promise.all(
        uploaded.map((u) => this.r2.deleteObject(u.key).catch(() => undefined)),
      );
      throw e;
    }
  }

  @Post(':id/file')
  @UseInterceptors(FileInterceptor('file', stlMulterOptions))
  async uploadJaw(
    @Param('id') id: string,
    @Query('jaw') jaw: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    if (jaw !== 'upper' && jaw !== 'lower') {
      throw new BadRequestException('jaw must be "upper" or "lower"');
    }
    if (!file) throw new BadRequestException('File is required');
    if (!isValidStl(file.buffer)) {
      throw new BadRequestException('File is not a valid STL');
    }

    // Ownership check + patientId for the R2 key, before touching storage.
    const set = await this.modelSets.findOne(id, req.user.userId);
    const key = this.modelSets.buildKey(set.patientId, jaw);
    await this.r2.putObject(key, file.buffer, STL_CONTENT_TYPE);
    try {
      return await this.modelSets.setJawFile(id, jaw, req.user.userId, {
        key,
        size: file.size,
      });
    } catch (e) {
      await this.r2.deleteObject(key).catch(() => undefined);
      throw e;
    }
  }

  @Get()
  findAll(@Query('patientId') patientId: string, @Request() req) {
    return this.modelSets.findAll(patientId, req.user.userId);
  }

  @Get(':id/urls')
  signedUrls(@Param('id') id: string, @Request() req) {
    return this.modelSets.signedUrls(id, req.user.userId);
  }

  // Streams the STL through the API so the viewer's fetch() stays inside the
  // app's CORS allowlist (signed R2 URLs would need CORS on the bucket).
  @Get(':id/file')
  async streamFile(
    @Param('id') id: string,
    @Query('jaw') jaw: string,
    @Request() req,
    @Res() res: Response,
  ) {
    if (jaw !== 'upper' && jaw !== 'lower') {
      throw new BadRequestException('jaw must be "upper" or "lower"');
    }
    const set = await this.modelSets.findOne(id, req.user.userId);
    const key = jaw === 'upper' ? set.upperKey : set.lowerKey;
    if (!key) throw new NotFoundException(`No ${jaw} model in this set`);

    const object = await this.r2.getObject(key);
    res.setHeader('Content-Type', STL_CONTENT_TYPE);
    if (object.ContentLength) {
      res.setHeader('Content-Length', String(object.ContentLength));
    }
    // Keys are immutable (replaced files get a new UUID key), so short
    // private caching is safe and spares re-downloads while browsing sets.
    res.setHeader('Cache-Control', 'private, max-age=3600');
    (object.Body as Readable).pipe(res);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateModelSetDto,
    @Request() req,
  ) {
    return this.modelSets.update(id, dto, req.user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.modelSets.remove(id, req.user.userId);
  }
}
