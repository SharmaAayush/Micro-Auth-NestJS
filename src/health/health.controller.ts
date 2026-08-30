import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from './health.service';
import { Cron, CronExpression } from '@nestjs/schedule';

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
  getLiveness() {
    return { status: 'alive' };
  }

  // 3. READINESS PROBE: Sub-millisecond evaluation utilizing local memory variables
  @Get('readyz')
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
