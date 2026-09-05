import * as bcrypt from 'bcrypt';
import { User } from './users.entity';

describe('User entity hashPassword hook', () => {
  it('hashes the password when one is set', async () => {
    const user = new User();
    user.email = 'a@b.c';
    user.password = 'plain';

    await user.hashPassword();

    expect(user.password).not.toBe('plain');
    await expect(bcrypt.compare('plain', user.password)).resolves.toBe(true);
  });

  it('is a no-op when password is empty', async () => {
    const user = new User();
    user.email = 'a@b.c';
    user.password = '';

    await user.hashPassword();

    expect(user.password).toBe('');
  });
});
