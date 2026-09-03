import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { SessionsService } from './sessions.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let sessions: { findByJti: jest.Mock };

  beforeEach(async () => {
    sessions = { findByJti: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: SessionsService, useValue: sessions },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('secret') },
        },
      ],
    }).compile();
    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  const basePayload = { sub: '7', email: 'a@b.c', jti: 'jti-1' };

  it('returns the user when a non-expired session exists', async () => {
    sessions.findByJti.mockResolvedValue({
      id: 'jti-1',
      userId: 7,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const result = await strategy.validate(basePayload as any);

    expect(result).toEqual({ id: 7, email: 'a@b.c', jti: 'jti-1' });
  });

  it('returns null when no session row exists', async () => {
    sessions.findByJti.mockResolvedValue(null);
    const result = await strategy.validate(basePayload as any);
    expect(result).toBeNull();
  });

  it('returns null when the session is expired', async () => {
    sessions.findByJti.mockResolvedValue({
      id: 'jti-1',
      userId: 7,
      expiresAt: new Date(Date.now() - 60_000),
    });
    const result = await strategy.validate(basePayload as any);
    expect(result).toBeNull();
  });
});
