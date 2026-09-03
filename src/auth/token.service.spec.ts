import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TokenService } from './token.service';

describe('TokenService', () => {
  let service: TokenService;
  let jwt: { signAsync: jest.Mock; verifyAsync: jest.Mock };

  beforeEach(async () => {
    jwt = { signAsync: jest.fn(), verifyAsync: jest.fn() };
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

  const user = { id: 7, email: 'a@b.c', name: 'A' };

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
});
