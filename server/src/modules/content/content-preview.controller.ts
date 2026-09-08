import { Controller, Get, Headers, NotFoundException, Param, UnauthorizedException } from '@nestjs/common';
import { ok } from '../../shared/api-response.js';
import { ContentPreviewService } from './content-preview.service.js';

@Controller('preview')
export class ContentPreviewController {
  constructor(private readonly preview: ContentPreviewService) {}

  @Get('experiences/:slug')
  async experience(
    @Param('slug') slug: string,
    @Headers('x-preview-token') token?: string,
  ) {
    const expected = process.env.QUISQUEYA_PREVIEW_TOKEN?.trim();
    if (!expected || !token || token !== expected) {
      throw new UnauthorizedException('Invalid preview token');
    }

    const item = await this.preview.getExperience(slug);
    if (!item) throw new NotFoundException('Experience not found');
    return ok(item);
  }
}
