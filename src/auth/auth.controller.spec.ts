import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AuthModule } from './auth.module';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AuthModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  describe('Validate endpoint', () => {
    it('/auth/validate (GET) should return 401 when no token is provided', () => {
      return request(app.getHttpServer())
        .get('/auth/validate')
        .expect(401);
    });

    it('/auth/validate (GET) should return 401 when invalid token is provided', () => {
      return request(app.getHttpServer())
        .get('/auth/validate')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  afterEach(async () => {
    await app.close();
  });
});