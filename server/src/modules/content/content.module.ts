import { Module } from '@nestjs/common';
import { ContentController } from './content.controller.js';
import { ContentService } from './content.service.js';
import { DmcContentService } from './dmc-content.service.js';

@Module({
  controllers: [ContentController],
  providers: [ContentService, DmcContentService],
  exports: [ContentService, DmcContentService],
})
export class ContentModule {}
