import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { LoginDto } from './login.dto';

describe('LoginDto', () => {
  it('accepts a valid payload', async () => {
    const dto = plainToInstance(LoginDto, { email: 'a@b.com', password: 'pw' });
    const errors = await validate(dto);
    expect(errors).toEqual([]);
  });

  it('rejects a non-email email', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'not-an-email',
      password: 'pw',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('email');
  });

  it('rejects a missing password', async () => {
    const dto = plainToInstance(LoginDto, { email: 'a@b.com' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('password');
  });
});
