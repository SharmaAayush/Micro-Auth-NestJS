import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('HealthController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('GET /health/livez returns the raw body (no envelope)', async () => {
    const res = await request(app.getHttpServer())
      .get('/health/livez')
      .expect(200);
    const body = res.body as { status: string; data?: unknown };
    expect(body).toEqual({ status: 'alive' });
    expect(body.data).toBeUndefined();
  });

  afterEach(async () => {
    await app.close();
  });
});
