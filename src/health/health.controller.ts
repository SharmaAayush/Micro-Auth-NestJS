import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SkipEnvelope } from '../common/transform/response/skip-envelope.decorator';

@ApiTags('health')
@SkipEnvelope()
@Controller('health')
export class HealthController {
  // Local memory cache for health state
  private isSystemReady = true;
  private latestHealthReport: any = {
    status: 'ok',
    info: {},
  };

  constructor(private readonly healthService: HealthService) {
    // Run initial check on startup
    void this.checkClusterDependencies();
  }

  // 1. BACKGROUND CRON: Runs every 10 seconds to avoid hitting DB on every K8s probe
  @Cron(CronExpression.EVERY_10_SECONDS)
  async checkClusterDependencies() {
    try {
      const report = await this.healthService.checkDatabaseHealth();

      this.latestHealthReport = report;
      // System is only unready if critical infrastructure (database) status is explicitly down
      this.isSystemReady = report.info?.database?.status === 'up';
    } catch (failedReport) {
      // Handles cases where health.check throws because a primary constraint failed
      this.latestHealthReport = ((failedReport as { response?: any })
        .response || failedReport) as unknown;
      this.isSystemReady = false;
    }
  }

  // 2. LIVENESS PROBE: Instantaneous, zero dependencies.
  // Tells K8s if the Node.js event loop is alive.
  @Get('livez')
  @ApiOperation({
    summary: 'Liveness probe',
    description:
      'Instantaneous, zero-dependency check that returns 200 as long as the Node.js event loop is alive. No envelope wrapper.',
  })
  @ApiResponse({
    status: 200,
    description: 'Process is alive.',
    schema: { example: { status: 'alive' } },
  })
  getLiveness() {
    return { status: 'alive' };
  }

  // 3. READINESS PROBE: Sub-millisecond evaluation utilizing local memory variables
  @Get('readyz')
  @ApiOperation({
    summary: 'Readiness probe',
    description:
      'Sub-millisecond check backed by a 10-second background cron that pings the database. Returns 200 when the database is reachable, 503 otherwise. No envelope wrapper.',
  })
  @ApiResponse({
    status: 200,
    description: 'System is ready to serve traffic.',
  })
  @ApiResponse({
    status: 503,
    description: 'A critical dependency (database) is not reachable.',
  })
  getReadiness() {
    if (!this.isSystemReady) {
      throw new ServiceUnavailableException({
        status: 'error',
        ...this.latestHealthReport,
      });
    }
    return { status: 'ready', ...this.latestHealthReport } as unknown;
  }
}
