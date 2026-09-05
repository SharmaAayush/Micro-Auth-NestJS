import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionsService } from './sessions/sessions.service';
import { TokenService, TokenPayload } from './token.service';
import { Session } from './sessions/session.entity';
import { User } from './users.entity';
import { LoginUser } from './login-user.interface';
import type { Request, Response } from 'express';

/* eslint-disable @typescript-eslint/unbound-method */

type SessionsRepoMock = {
  manager: {
    transaction: jest.Mock;
  };
};

const buildReq = (overrides: Partial<Request> = {}): Request =>
  ({
    cookies: {},
    headers: {},
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  }) as unknown as Request;

const buildRes = (): Response => {
  const res: { cookie: jest.Mock } = { cookie: jest.fn() };
  return res as unknown as Response;
};

describe('AuthController', () => {
  let controller: AuthController;
  let tokenService: {
    generateAccessToken: jest.Mock;
    generateRefreshToken: jest.Mock;
    getExpiryFromToken: jest.Mock;
    verifyRefreshToken: jest.Mock;
  };
  let authService: {
    createUser: jest.Mock;
    findByEmail: jest.Mock;
  };
  let sessionsService: {
    create: jest.Mock;
    findByJti: jest.Mock;
    deleteAllForUser: jest.Mock;
  };
  let sessionsRepo: SessionsRepoMock;

  beforeEach(async () => {
    tokenService = {
      generateAccessToken: jest.fn().mockResolvedValue('access.jwt'),
      generateRefreshToken: jest.fn().mockResolvedValue('refresh.jwt'),
      getExpiryFromToken: jest
        .fn()
        .mockReturnValue(new Date('2030-01-01T00:00:00Z')),
      verifyRefreshToken: jest.fn(),
    };
    authService = {
      createUser: jest.fn(),
      findByEmail: jest.fn(),
    };
    sessionsService = {
      create: jest.fn().mockResolvedValue(undefined),
      findByJti: jest.fn(),
      deleteAllForUser: jest.fn().mockResolvedValue(0),
    };
    sessionsRepo = {
      manager: {
        transaction: jest.fn().mockImplementation(async (cb) => {
          await (
            cb as (m: {
              delete: jest.Mock;
              create: jest.Mock;
              save: jest.Mock;
            }) => Promise<void>
          )({
            delete: jest.fn().mockResolvedValue(undefined),
            create: jest.fn().mockReturnValue({}),
            save: jest.fn().mockResolvedValue({}),
          });
        }),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: SessionsService, useValue: sessionsService },
        { provide: TokenService, useValue: tokenService },
        { provide: getRepositoryToken(Session), useValue: sessionsRepo },
        { provide: getRepositoryToken(User), useValue: {} },
      ],
    }).compile();
    controller = module.get<AuthController>(AuthController);
  });

  describe('register', () => {
    it('creates a user, issues tokens, sets the cookie, and stores a session', async () => {
      const created = {
        id: 'u1',
        email: 'a@b.c',
        name: 'A',
      };
      authService.createUser.mockResolvedValue(created);

      const req = buildReq({
        headers: { 'user-agent': 'ua' },
        ip: '1.2.3.4',
      });
      const res = buildRes();
      const result = await controller.register(
        { email: 'a@b.c', password: 'pw', name: 'A' },
        req,
        res,
      );

      expect(authService.createUser).toHaveBeenCalledWith('a@b.c', 'pw', 'A');
      expect(tokenService.generateAccessToken).toHaveBeenCalled();
      expect(tokenService.generateRefreshToken).toHaveBeenCalled();
      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'refresh.jwt',
        expect.objectContaining({ httpOnly: true }),
      );
      expect(sessionsService.create).toHaveBeenCalledWith(
        'u1',
        expect.any(String),
        { userAgent: 'ua', ipAddress: '1.2.3.4' },
        new Date('2030-01-01T00:00:00Z'),
      );
      expect(result).toEqual({ accessToken: 'access.jwt' });
    });

    it('defaults missing name to ""', async () => {
      const created = { id: 'u1', email: 'a@b.c', name: undefined };
      authService.createUser.mockResolvedValue(created);

      const result = await controller.register(
        { email: 'a@b.c', password: 'pw' },
        buildReq(),
        buildRes(),
      );

      expect(result).toEqual({ accessToken: 'access.jwt' });
    });
  });

  describe('refreshToken', () => {
    const basePayload: TokenPayload = {
      sub: 'u1',
      email: 'a@b.c',
      jti: 'old-jti',
    };
    const user: User = {
      id: '00000000-0000-0000-0000-000000000042',
      email: 'a@b.c',
      password: 'h',
      name: 'A',
    } as User;

    it('throws 401 when the refresh cookie is missing', async () => {
      const req = buildReq();
      await expect(
        controller.refreshToken(req, buildRes()),
      ).rejects.toMatchObject({
        status: HttpStatus.UNAUTHORIZED,
      });
      expect(tokenService.verifyRefreshToken).not.toHaveBeenCalled();
    });

    it('throws 401 when the refresh token is invalid', async () => {
      tokenService.verifyRefreshToken.mockRejectedValue(
        new Error('Invalid or expired refresh token'),
      );
      const req = buildReq({ cookies: { refreshToken: 'bad' } });
      await expect(
        controller.refreshToken(req, buildRes()),
      ).rejects.toMatchObject({
        status: HttpStatus.UNAUTHORIZED,
      });
    });

    it('revokes all sessions and throws 401 on reuse detection', async () => {
      tokenService.verifyRefreshToken.mockResolvedValue(basePayload);
      sessionsService.findByJti.mockResolvedValue(null);
      authService.findByEmail.mockResolvedValue(user);

      const req = buildReq({ cookies: { refreshToken: 'reused' } });
      await expect(
        controller.refreshToken(req, buildRes()),
      ).rejects.toMatchObject({
        status: HttpStatus.UNAUTHORIZED,
      });
      expect(sessionsService.deleteAllForUser).toHaveBeenCalledWith(user.id);
    });

    it('still throws 401 on reuse detection when the user no longer exists', async () => {
      tokenService.verifyRefreshToken.mockResolvedValue(basePayload);
      sessionsService.findByJti.mockResolvedValue(null);
      authService.findByEmail.mockResolvedValue(null);

      const req = buildReq({ cookies: { refreshToken: 'reused' } });
      await expect(
        controller.refreshToken(req, buildRes()),
      ).rejects.toMatchObject({
        status: HttpStatus.UNAUTHORIZED,
      });
      expect(sessionsService.deleteAllForUser).not.toHaveBeenCalled();
    });

    it('throws 401 when the user can no longer be found by email', async () => {
      tokenService.verifyRefreshToken.mockResolvedValue(basePayload);
      sessionsService.findByJti.mockResolvedValue({
        id: 'old-jti',
        userId: 'u1',
      });
      authService.findByEmail.mockResolvedValue(null);

      const req = buildReq({ cookies: { refreshToken: 'good' } });
      await expect(
        controller.refreshToken(req, buildRes()),
      ).rejects.toMatchObject({
        status: HttpStatus.UNAUTHORIZED,
      });
    });

    it('rotates the refresh token and persists the new session in a transaction', async () => {
      tokenService.verifyRefreshToken.mockResolvedValue(basePayload);
      sessionsService.findByJti.mockResolvedValue({
        id: 'old-jti',
        userId: user.id,
      });
      authService.findByEmail.mockResolvedValue(user);

      const req = buildReq({
        cookies: { refreshToken: 'good' },
        headers: { 'user-agent': 'ua' },
        ip: '5.6.7.8',
      });
      const res = buildRes();
      const result = await controller.refreshToken(req, res);

      expect(sessionsRepo.manager.transaction).toHaveBeenCalled();
      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'refresh.jwt',
        expect.objectContaining({ httpOnly: true }),
      );
      expect(result).toEqual({ accessToken: 'access.jwt' });
    });
  });

  describe('login', () => {
    it('issues tokens, sets the cookie, and stores a session for the authenticated user', async () => {
      const loginUser: LoginUser = { id: 'u1', email: 'a@b.c', name: 'A' };
      const req = buildReq({
        headers: { 'user-agent': 'ua' },
        ip: '9.9.9.9',
        user: loginUser,
      }) as Request & { user: LoginUser };
      const res = buildRes();

      const result = await controller.login(
        { email: 'a@b.c', password: 'pw' },
        req,
        res,
      );

      expect(tokenService.generateAccessToken).toHaveBeenCalled();
      expect(tokenService.generateRefreshToken).toHaveBeenCalled();
      expect(res.cookie).toHaveBeenCalled();
      expect(sessionsService.create).toHaveBeenCalledWith(
        'u1',
        expect.any(String),
        { userAgent: 'ua', ipAddress: '9.9.9.9' },
        new Date('2030-01-01T00:00:00Z'),
      );
      expect(result).toEqual({ accessToken: 'access.jwt' });
    });
  });

  describe('validate', () => {
    it('resolves to undefined (the guard handles validation)', () => {
      expect(controller.validate()).toBeUndefined();
    });
  });

  describe('generateTokenPair', () => {
    it('uses getExpiryFromToken(refreshToken) for refreshExpiresAt', async () => {
      const result = await (
        controller as unknown as {
          generateTokenPair: (u: LoginUser) => Promise<{
            refreshExpiresAt: Date;
          }>;
        }
      ).generateTokenPair({ id: '7', email: 'a@b.c', name: 'A' });

      expect(tokenService.getExpiryFromToken).toHaveBeenCalledWith(
        'refresh.jwt',
      );
      expect(result.refreshExpiresAt.toISOString()).toBe(
        '2030-01-01T00:00:00.000Z',
      );
    });
  });
});
