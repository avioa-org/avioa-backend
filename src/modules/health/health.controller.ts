import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
} from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly healthService: HealthService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024), // 300MB
    ]);
  }

  @Get('ready')
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.healthService.isDatabaseHealthy('database'),
      () => this.healthService.isRedisHealthy('redis'),
      () => this.healthService.isQueueHealthy('pago_total_queue'),
    ]);
  }
}
