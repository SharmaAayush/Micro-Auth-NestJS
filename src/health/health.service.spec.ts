import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;
  let healthCheck: { check: jest.Mock };
  let db: { pingCheck: jest.Mock };

  beforeEach(() => {
    healthCheck = {
      check: jest
        .fn()
        .mockImplementation(async (thunks: Array<() => Promise<unknown>>) => {
          for (const t of thunks) await t();
          return {
            status: 'ok',
            info: { database: { status: 'up' } },
            error: {},
            details: { database: { status: 'up' } },
          };
        }),
    };
    db = {
      pingCheck: jest.fn().mockResolvedValue({ database: { status: 'up' } }),
    };
    service = new HealthService(healthCheck as never, db as never);
  });

  it('returns the success report when the database is reachable', async () => {
    const result = await service.checkDatabaseHealth();

    expect(db.pingCheck).toHaveBeenCalledWith('database', { timeout: 2000 });
    expect(result).toEqual({
      status: 'ok',
      info: { database: { status: 'up' } },
      error: {},
      details: { database: { status: 'up' } },
    });
  });

  it('returns the failure report when pingCheck throws a Terminus error with .response', async () => {
    const failed = {
      status: 'error',
      info: { database: { status: 'down' } },
      error: { database: { status: 'down', message: 'connection refused' } },
      details: { database: { status: 'down' } },
    };
    healthCheck.check.mockRejectedValue({ response: failed });

    const result = await service.checkDatabaseHealth();

    expect(result).toBe(failed);
  });

  it('falls back to the thrown value when it has no .response field', async () => {
    const raw = { status: 'error', info: {}, error: {}, details: {} };
    healthCheck.check.mockRejectedValue(raw);

    const result = await service.checkDatabaseHealth();

    expect(result).toBe(raw);
  });
});
