import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { Session } from '../src/auth/sessions/session.entity';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let sessionsRepository: Repository<Session>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();

    sessionsRepository = moduleFixture.get<Repository<Session>>(
      getRepositoryToken(Session),
    );
  });

  const registerAndGetAccessToken = async (): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'user@example.com', password: 'password123', name: 'U' });
    expect(res.status).toBe(200);
    return res.body.accessToken;
  };

  describe('Input validation', () => {
    it('rejects a register request with a short password (400)', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'a@b.c', password: 'short', name: 'X' })
        .expect(400);
    });

    it('rejects a register request with a non-email email (400)', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'not-an-email', password: 'longenough', name: 'X' })
        .expect(400);
    });

    it('rejects a register request with unknown fields (400)', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'a@b.c',
          password: 'longenough',
          name: 'X',
          extra: 1,
        })
        .expect(400);
    });
  });

  describe('Validate endpoint', () => {
    it('returns 401 when no token is provided', () => {
      return request(app.getHttpServer()).get('/auth/validate').expect(401);
    });

    it('returns 401 when the token is invalid', () => {
      return request(app.getHttpServer())
        .get('/auth/validate')
        .set('Authorization', 'Bearer not-a-real-token')
        .expect(401);
    });

    it('returns 200 when the access token has a corresponding session', async () => {
      const accessToken = await registerAndGetAccessToken();
      await request(app.getHttpServer())
        .get('/auth/validate')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('returns 401 when the session row has been deleted', async () => {
      const accessToken = await registerAndGetAccessToken();
      await sessionsRepository.clear();
      await request(app.getHttpServer())
        .get('/auth/validate')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
    });
  });

  describe('Refresh token rotation', () => {
    it('returns a new access token and rotates the session', async () => {
      const firstAccessToken = await registerAndGetAccessToken();
      const beforeCount = await sessionsRepository.count();

      // Cookies: the supertest agent handles them across requests.
      const agent = request.agent(app.getHttpServer());
      await agent
        .post('/auth/register')
        .send({ email: 'rot@example.com', password: 'pw1234567', name: 'R' });

      const refreshRes = await agent.post('/auth/refresh-token').expect(200);
      const newAccessToken = refreshRes.body.accessToken;
      expect(newAccessToken).toBeDefined();
      expect(newAccessToken).not.toBe(firstAccessToken);

      // Old token now 401, new token 200.
      await request(app.getHttpServer())
        .get('/auth/validate')
        .set('Authorization', `Bearer ${firstAccessToken}`)
        .expect(401);
      await agent
        .get('/auth/validate')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .expect(200);

      // Session count for the user is still 1.
      const afterCount = await sessionsRepository.count();
      expect(afterCount).toBe(beforeCount + 1);
    });
  });

  afterEach(async () => {
    await app.close();
  });
});
