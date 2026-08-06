import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ok } from '../../shared/api-response.js';
import { AuthGuard } from '../../shared/auth.guard.js';
import { Roles } from '../../shared/roles.decorator.js';
import { RolesGuard } from '../../shared/roles.guard.js';
import {
  ExperienceEditorialService,
  type ExperienceEditorialWriteInput,
} from './experience-editorial.service.js';

@UseGuards(AuthGuard, RolesGuard)
@Roles('Super Admin', 'Administrador', 'Supervisor')
@Controller('experiences')
export class ExperienceEditorialController {
  constructor(private readonly editorial: ExperienceEditorialService) {}

  @Get(':experienceId/editorial')
  async get(@Param('experienceId') experienceId: string) {
    return ok(await this.editorial.get(experienceId));
  }

  @Patch(':experienceId/editorial')
  async update(
    @Param('experienceId') experienceId: string,
    @Body() body: ExperienceEditorialWriteInput,
  ) {
    return ok(await this.editorial.update(experienceId, body));
  }
}
