import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { Session } from '../src/auth/sessions/session.entity';
import { User } from '../src/auth/users.entity';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let sessionsRepository: Repository<Session>;
  let usersRepository: Repository<User>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    sessionsRepository = moduleFixture.get<Repository<Session>>(
      getRepositoryToken(Session),
    );
    usersRepository = moduleFixture.get<Repository<User>>(
      getRepositoryToken(User),
    );

    // Clear both tables so each test starts from a clean DB state.
    // Session is cleared first because Session.userId FKs into User;
    // clearing User first would violate the FK constraint.
    // We use createQueryBuilder().delete() instead of repository.clear()
    // because clear() issues TRUNCATE, which fails on a parent table when
    // a child table has an FK referencing it even after the child is
    // emptied. createQueryBuilder().delete() issues DELETE, which respects
    // the FK order naturally.
    await sessionsRepository.createQueryBuilder().delete().execute();
    await usersRepository.createQueryBuilder().delete().execute();
  });

  const registerAndGetAccessToken = async (): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'user@example.com', password: 'password123', name: 'U' });
    expect(res.status).toBe(200);
    return res.body.data.accessToken;
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
          email: 'x@y.c',
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
      const agent = request.agent(app.getHttpServer());
      const reg = await agent
        .post('/auth/register')
        .send({ email: 'rot@example.com', password: 'pw1234567', name: 'R' });
      expect(reg.status).toBe(200);
      const firstAccessToken = reg.body.data.accessToken;
      const beforeCount = await sessionsRepository.count();

      const refreshRes = await agent.post('/auth/refresh-token').expect(200);
      const newAccessToken = refreshRes.body.data.accessToken;
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
      expect(afterCount).toBe(beforeCount);
    });
  });

  describe('Session listing envelope', () => {
    it('GET /auth/sessions returns the array inside data', async () => {
      const agent = request.agent(app.getHttpServer());
      const reg = await agent
        .post('/auth/register')
        .send({ email: 'env@example.com', password: 'pw1234567', name: 'E' });
      const accessToken = reg.body.data.accessToken;
      const list = await agent
        .get('/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(Array.isArray(list.body.data)).toBe(true);
      expect(list.body.data.length).toBe(1);
    });
  });

  afterEach(async () => {
    await app.close();
  });
});
