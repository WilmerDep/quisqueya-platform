import { Controller, Get, UseGuards } from '@nestjs/common';
import { GoogleDriveService } from './google-drive.service.js';
import { ok } from '../../../shared/api-response.js';
import { AuthGuard } from '../../../shared/auth.guard.js';

@Controller('integrations/google-drive')
export class GoogleDriveController {
  constructor(private readonly googleDrive: GoogleDriveService) {}

  @UseGuards(AuthGuard)
  @Get('status')
  status() {
    return ok(this.googleDrive.getStatus());
  }

  @UseGuards(AuthGuard)
  @Get('connect')
  connect() {
    return ok({ authorizationUrl: this.googleDrive.createAuthorizationUrl() });
  }

  @UseGuards(AuthGuard)
  @Get('root')
  async rootFolder() {
    return ok(await this.googleDrive.getRootFolderMetadata());
  }
}
