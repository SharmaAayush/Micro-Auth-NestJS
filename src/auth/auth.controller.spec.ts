import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionsService } from './sessions/sessions.service';
import { TokenService } from './token.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Session } from './sessions/session.entity';
import { User } from './users.entity';

describe('AuthController.generateTokenPair', () => {
  let controller: AuthController;
  let tokenService: { generateAccessToken: jest.Mock; generateRefreshToken: jest.Mock; getExpiryFromToken: jest.Mock };
  let sessionsService: { create: jest.Mock };

  beforeEach(async () => {
    tokenService = {
      generateAccessToken: jest.fn().mockResolvedValue('access.jwt'),
      generateRefreshToken: jest.fn().mockResolvedValue('refresh.jwt'),
      getExpiryFromToken: jest.fn().mockReturnValue(new Date('2030-01-01T00:00:00Z')),
    };
    sessionsService = { create: jest.fn().mockResolvedValue(undefined) };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: {} },
        { provide: SessionsService, useValue: sessionsService },
        { provide: TokenService, useValue: tokenService },
        { provide: getRepositoryToken(Session), useValue: {} },
        { provide: getRepositoryToken(User), useValue: {} },
      ],
    }).compile();
    controller = module.get<AuthController>(AuthController);
  });

  it('uses getExpiryFromToken(refreshToken) for refreshExpiresAt', async () => {
    const user: User = {
      id: '7',
      email: 'a@b.c',
      password: 'h',
      name: 'A',
    } as User;
    const res = await controller['generateTokenPair']({
      id: '7',
      email: 'a@b.c',
      name: 'A',
    });
    expect(tokenService.getExpiryFromToken).toHaveBeenCalledWith('refresh.jwt');
    expect(res.refreshExpiresAt.toISOString()).toBe('2030-01-01T00:00:00.000Z');
  });
});
