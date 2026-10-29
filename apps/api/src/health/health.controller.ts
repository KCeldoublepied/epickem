import { Controller, Get } from '@nestjs/common';
import type { HealthStatus } from '@epickem/shared';
import { Public } from '../auth/auth.decorators';

@Public()
@Controller('health')
export class HealthController {
  @Get()
  check(): HealthStatus {
    return { status: 'ok', service: 'api', time: new Date().toISOString() };
  }
}
