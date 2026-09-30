import { BadRequestException, Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
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

  @Header('Cache-Control', 'no-store')
  @Get('callback')
  async callback(
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
    @Query('error_description') errorDescription?: string,
  ) {
    if (error) {
      throw new BadRequestException(errorDescription || error);
    }

    const result = await this.googleDrive.exchangeAuthorizationCode(code ?? '', state ?? '');
    return ok({
      ...result,
      nextStep: 'Store refreshToken securely as GOOGLE_DRIVE_REFRESH_TOKEN and restart the app.',
    });
  }

  @UseGuards(AuthGuard)
  @Get('root')
  async rootFolder() {
    return ok(await this.googleDrive.getRootFolderMetadata());
  }
}
