import { Controller, Get } from '@nestjs/common';
import { ok } from '../shared/api-response.js';

@Controller()
export class HealthController {
  @Get('healthz')
  healthz() {
    return ok({ status: 'ok', service: 'prestafacil', timestamp: new Date().toISOString() });
  }
}
