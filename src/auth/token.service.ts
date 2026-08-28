import { Injectable } from '@nestjs/common';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { LoginUser } from './login-user.interface';

export interface TokenPayload {
  email: string;
  sub: string; // user id
}

@Injectable()
export class TokenService {
  constructor(private readonly jwtService: NestJwtService) {}

  async generateAccessToken(user: LoginUser) {
    return await this.jwtService.signAsync<TokenPayload>(
      { email: user.email, sub: `${user.id}` },
      { expiresIn: '15m' }, // Short-lived access token
    );
  }

  async generateRefreshToken(user: LoginUser) {
    return await this.jwtService.signAsync<TokenPayload>(
      { email: user.email, sub: `${user.id}` },
      { expiresIn: '7d' }, // Long-lived refresh token
    );
  }
}
