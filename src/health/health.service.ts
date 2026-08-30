import { Injectable } from '@nestjs/common';
import {
  HealthCheckService,
  TypeOrmHealthIndicator,
  HealthCheckResult,
} from '@nestjs/terminus';

@Injectable()
export class HealthService {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
  ) {}

  async checkDatabaseHealth(): Promise<HealthCheckResult> {
    try {
      const healthResponse = await this.health.check([
        () => this.db.pingCheck('database', { timeout: 2000 }),
      ]);
      return healthResponse;
    } catch (error) {
      // Return the failed report from Terminus
      return ((error as { response?: any }).response ||
        error) as HealthCheckResult;
    }
  }
}
