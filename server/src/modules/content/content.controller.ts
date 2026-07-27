import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ContentService } from './content.service.js';
import { ok } from '../../shared/api-response.js';

@Controller('public')
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get('content')
  async snapshot() {
    return ok(await this.content.getSnapshot());
  }

  @Get('experiences')
  async experiences() {
    return ok(await this.content.getExperiences());
  }

  @Get('experiences/:slug')
  async experience(@Param('slug') slug: string) {
    const item = await this.content.getExperience(slug);
    if (!item) throw new NotFoundException('Experience not found');
    return ok(item);
  }

  @Get('destinations')
  async destinations() {
    return ok(await this.content.getDestinations());
  }

  @Get('destinations/:slug')
  async destination(@Param('slug') slug: string) {
    const item = await this.content.getDestination(slug);
    if (!item) throw new NotFoundException('Destination not found');
    return ok(item);
  }

  @Get('pages')
  async pages() {
    return ok(await this.content.getPages());
  }

  @Get('pages/:slug')
  async page(@Param('slug') slug: string) {
    const item = await this.content.getPage(slug);
    if (!item) throw new NotFoundException('Page not found');
    return ok(item);
  }

  @Get('media')
  async media() {
    return ok(await this.content.getMedia());
  }
}
