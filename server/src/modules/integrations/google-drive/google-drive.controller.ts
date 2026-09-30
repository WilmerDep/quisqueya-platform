import { Controller, Get, Redirect } from '@nestjs/common';
import { GoogleDriveService } from './google-drive.service.js';
import { ok } from '../../../shared/api-response.js';

@Controller('integrations/google-drive')
export class GoogleDriveController {
  constructor(private readonly googleDrive: GoogleDriveService) {}

  @Get('status')
  status() {
    return ok(this.googleDrive.getStatus());
  }

  @Get('connect')
  @Redirect()
  connect() {
    return { url: this.googleDrive.createAuthorizationUrl(), statusCode: 302 };
  }

  @Get('root')
  async rootFolder() {
    return ok(await this.googleDrive.getRootFolderMetadata());
  }
}
