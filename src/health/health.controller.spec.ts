import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: { checkDatabaseHealth: jest.Mock };

  beforeEach(() => {
    healthService = { checkDatabaseHealth: jest.fn() };
    // The constructor calls checkClusterDependencies() once. We don't await it,
    // so just silence the unhandled-promise noise by giving it a successful
    // default result.
    healthService.checkDatabaseHealth.mockResolvedValue({
      status: 'ok',
      info: { database: { status: 'up' } },
      error: {},
      details: { database: { status: 'up' } },
    });
    controller = new HealthController(
      healthService as unknown as HealthService,
    );
  });

  describe('getLiveness', () => {
    it('returns { status: "alive" }', () => {
      expect(controller.getLiveness()).toEqual({ status: 'alive' });
    });
  });

  describe('getReadiness', () => {
    it('returns { status: "ready", ...latestHealthReport } when the system is ready', async () => {
      const report = {
        status: 'ok',
        info: { database: { status: 'up' } },
        error: {},
        details: { database: { status: 'up' } },
      };
      healthService.checkDatabaseHealth.mockResolvedValue(report);
      await controller.checkClusterDependencies();

      const result = controller.getReadiness();
      expect(result).toEqual({ status: 'ready', ...report });
    });

    it('throws ServiceUnavailableException with the latest report when not ready', async () => {
      const failedReport = {
        status: 'error',
        info: { database: { status: 'down' } },
        error: { database: { status: 'down', message: 'connection refused' } },
        details: { database: { status: 'down' } },
      };
      healthService.checkDatabaseHealth.mockResolvedValue(failedReport);
      await controller.checkClusterDependencies();

      expect(() => controller.getReadiness()).toThrow(
        ServiceUnavailableException,
      );
    });

    it('marks the system unready when checkDatabaseHealth throws', async () => {
      const terminusError = {
        response: {
          status: 'error',
          info: { database: { status: 'down' } },
          error: { database: { status: 'down' } },
          details: { database: { status: 'down' } },
        },
      };
      healthService.checkDatabaseHealth.mockRejectedValue(terminusError);
      await controller.checkClusterDependencies();

      expect(() => controller.getReadiness()).toThrow(
        ServiceUnavailableException,
      );
    });

    it('falls back to the thrown value when it has no .response field', async () => {
      const raw = { status: 'error', info: {}, error: {}, details: {} };
      healthService.checkDatabaseHealth.mockRejectedValue(raw);
      await controller.checkClusterDependencies();

      expect(() => controller.getReadiness()).toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('checkClusterDependencies', () => {
    it('stores the report and marks ready when database is up', async () => {
      const report = {
        status: 'ok',
        info: { database: { status: 'up' } },
        error: {},
        details: { database: { status: 'up' } },
      };
      healthService.checkDatabaseHealth.mockResolvedValue(report);

      await controller.checkClusterDependencies();

      expect(controller.getReadiness()).toEqual({ status: 'ready', ...report });
    });

    it('stores the report and marks unready when database is down', async () => {
      const report = {
        status: 'error',
        info: { database: { status: 'down' } },
        error: { database: { status: 'down' } },
        details: { database: { status: 'down' } },
      };
      healthService.checkDatabaseHealth.mockResolvedValue(report);

      await controller.checkClusterDependencies();

      expect(() => controller.getReadiness()).toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
