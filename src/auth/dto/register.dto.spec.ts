import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RegisterDto } from './register.dto';

describe('RegisterDto', () => {
  it('accepts a valid payload with name', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'a@b.com',
      password: 'longenough',
      name: 'Alice',
    });
    const errors = await validate(dto);
    expect(errors).toEqual([]);
  });

  it('accepts a valid payload without name', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'a@b.com',
      password: 'longenough',
    });
    const errors = await validate(dto);
    expect(errors).toEqual([]);
  });

  it('rejects a short password', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'a@b.com',
      password: 'short',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('rejects a too-long name', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'a@b.com',
      password: 'longenough',
      name: 'x'.repeat(200),
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });
});
