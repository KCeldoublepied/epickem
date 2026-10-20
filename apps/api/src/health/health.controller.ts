import { Controller, Get } from '@nestjs/common';
import type { HealthStatus } from '@epickem/shared';

@Controller('health')
export class HealthController {
  @Get()
  check(): HealthStatus {
    return { status: 'ok', service: 'api', time: new Date().toISOString() };
  }
}
