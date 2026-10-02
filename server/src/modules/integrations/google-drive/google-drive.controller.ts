import { BadRequestException, Body, Controller, Get, Header, Post, Query, UseGuards } from '@nestjs/common';
import { GoogleDriveService } from './google-drive.service.js';
import { ok } from '../../../shared/api-response.js';
import { AuthGuard } from '../../../shared/auth.guard.js';
import { Roles } from '../../../shared/roles.decorator.js';
import { RolesGuard } from '../../../shared/roles.guard.js';
import { ConfirmGoogleDriveRootDto } from './google-drive.dto.js';

@Controller('integrations/google-drive')
export class GoogleDriveOAuthController {
  constructor(private readonly googleDrive: GoogleDriveService) {}

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
}

@UseGuards(AuthGuard, RolesGuard)
@Roles('Super Admin', 'Administrador')
@Controller('integrations/google-drive')
export class GoogleDriveAdminController {
  constructor(private readonly googleDrive: GoogleDriveService) {}

  @Get('status')
  status() {
    return ok(this.googleDrive.getStatus());
  }

  @Get('connect')
  connect() {
    return ok({ authorizationUrl: this.googleDrive.createAuthorizationUrl() });
  }

  @Header('Cache-Control', 'no-store')
  @Get('picker-config')
  async pickerConfig() {
    return ok(await this.googleDrive.getPickerConfig());
  }

  @Post('picker-root')
  async confirmRoot(@Body() body: ConfirmGoogleDriveRootDto) {
    return ok(await this.googleDrive.confirmRootFolder(body.folderId));
  }

  @Get('root')
  async rootFolder() {
    return ok(await this.googleDrive.getRootFolderMetadata());
  }
}
