import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ok } from '../../shared/api-response.js';
import { AuthGuard } from '../../shared/auth.guard.js';
import { Roles } from '../../shared/roles.decorator.js';
import { RolesGuard } from '../../shared/roles.guard.js';
import { LinkExperienceMediaDto, RegisterStorageObjectDto } from './media.dto.js';
import { MediaService } from './media.service.js';

@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get(':id/content')
  async content(
    @Param('id') id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const content = await this.media.getAssetContent(id);
    response.setHeader('Content-Type', content.mimeType);
    response.setHeader('Content-Length', String(content.sizeBytes));
    response.setHeader('Cache-Control', 'public, max-age=3600');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (content.fileName) {
      response.setHeader(
        'Content-Disposition',
        `inline; filename*=UTF-8''${encodeURIComponent(content.fileName)}`,
      );
    }
    return new StreamableFile(content.data);
  }
}

@UseGuards(AuthGuard, RolesGuard)
@Roles('Super Admin', 'Administrador', 'Supervisor')
@Controller('media')
export class MediaAdminController {
  constructor(private readonly media: MediaService) {}

  @Get('storage/objects')
  async storageObjects(@Query('parentKey') parentKey?: string) {
    return ok(await this.media.listStorageObjects(parentKey));
  }

  @Post('storage/validate')
  async validateStorage() {
    return ok(await this.media.validateStorage());
  }

  @Post('register')
  async register(@Body() body: RegisterStorageObjectDto) {
    return ok(await this.media.registerStorageObject(body));
  }

  @Patch('experiences/:experienceId')
  async linkExperience(
    @Param('experienceId') experienceId: string,
    @Body() body: LinkExperienceMediaDto,
  ) {
    return ok(await this.media.linkExperienceMedia(experienceId, body));
  }
}
