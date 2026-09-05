import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('App smoke (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('GET /health/livez returns the raw body without an envelope', () => {
    return request(app.getHttpServer())
      .get('/health/livez')
      .expect(200)
      .expect({ status: 'alive' });
  });

  afterEach(async () => {
    await app.close();
  });
});
