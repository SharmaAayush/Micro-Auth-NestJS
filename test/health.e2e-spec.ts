import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('HealthController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('GET /health/livez returns the raw body (no envelope)', async () => {
    const res = await request(app.getHttpServer()).get('/health/livez').expect(200);
    expect(res.body).toEqual({ status: 'alive' });
    expect(res.body.data).toBeUndefined();
  });

  afterEach(async () => {
    await app.close();
  });
});
