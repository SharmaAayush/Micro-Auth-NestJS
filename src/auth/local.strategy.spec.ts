import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalStrategy } from './local.strategy';

describe('LocalStrategy', () => {
  let strategy: LocalStrategy;
  let authService: { validateUser: jest.Mock };

  beforeEach(() => {
    authService = { validateUser: jest.fn() };
    strategy = new LocalStrategy(authService as unknown as AuthService);
  });

  it('returns the user when validateUser resolves with one', async () => {
    const user = { id: 'u1', email: 'a@b.c', name: 'A' };
    authService.validateUser.mockResolvedValue(user);

    const result = await strategy.validate('a@b.c', 'pw');

    expect(authService.validateUser).toHaveBeenCalledWith('a@b.c', 'pw');
    expect(result).toBe(user);
  });

  it('throws UnauthorizedException when validateUser returns null', async () => {
    authService.validateUser.mockResolvedValue(null);

    await expect(strategy.validate('a@b.c', 'wrong')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
