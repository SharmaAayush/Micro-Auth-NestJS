import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TokenService } from './token.service';

describe('TokenService', () => {
  let service: TokenService;
  let jwt: { signAsync: jest.Mock; verifyAsync: jest.Mock; decode: jest.Mock };

  beforeEach(async () => {
    jwt = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
      decode: jest.fn().mockImplementation((token: string) => {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        try {
          return JSON.parse(
            Buffer.from(parts[1], 'base64url').toString('utf8'),
          ) as unknown;
        } catch {
          return null;
        }
      }),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: JwtService, useValue: jwt },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'app.jwt.accessTokenExpiresIn') return '15m';
              if (key === 'app.jwt.refreshTokenExpiresIn') return '7d';
              return 'secret';
            }),
          },
        },
      ],
    }).compile();
    service = module.get<TokenService>(TokenService);
  });

  const user = { id: '7', email: 'a@b.c', name: 'A' };

  it('generateAccessToken signs with sub, email, and the given jti', async () => {
    jwt.signAsync.mockResolvedValue('access.jwt');
    const result = await service.generateAccessToken(user, 'jti-abc');
    expect(jwt.signAsync).toHaveBeenCalledWith(
      { sub: '7', email: 'a@b.c', jti: 'jti-abc' },
      { expiresIn: '15m' },
    );
    expect(result).toBe('access.jwt');
  });

  it('generateRefreshToken signs with sub, email, and the given jti', async () => {
    jwt.signAsync.mockResolvedValue('refresh.jwt');
    const result = await service.generateRefreshToken(user, 'jti-abc');
    expect(jwt.signAsync).toHaveBeenCalledWith(
      { sub: '7', email: 'a@b.c', jti: 'jti-abc' },
      { expiresIn: '7d' },
    );
    expect(result).toBe('refresh.jwt');
  });

  describe('getExpiryFromToken', () => {
    it('returns the Date corresponding to the exp claim', () => {
      // exp is in seconds. 1700000000 seconds = 2023-11-14T22:13:20Z.
      const jwt = `header.${Buffer.from(
        JSON.stringify({ exp: 1700000000, sub: '7', email: 'a@b.c', jti: 'j' }),
      ).toString('base64url')}.sig`;
      const result = service.getExpiryFromToken(jwt);
      expect(result.toISOString()).toBe('2023-11-14T22:13:20.000Z');
    });

    it('throws when the token is unparseable', () => {
      expect(() => service.getExpiryFromToken('not-a-jwt')).toThrow(
        /missing the exp claim/,
      );
    });
  });
});
