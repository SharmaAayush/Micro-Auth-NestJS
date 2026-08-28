import { Injectable } from '@nestjs/common';
import { users } from 'src/config/users';

@Injectable()
export class AuthService {
  private users = [...users];

  findByEmail(email: string) {
    return this.users.find((user) => user.email === email);
  }

  validateUser(email: string, password: string) {
    const user = this.findByEmail(email);
    if (user && user.password === password) {
      // Remove password from returned user object for security
      const result = {
        email: user.email,
        name: user.name,
        id: user.id,
      };
      return result;
    }
    return null;
  }
}
