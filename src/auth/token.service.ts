import { Injectable } from '@nestjs/common';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { LoginUser } from './login-user.interface';

export interface TokenPayload {
  email: string;
  sub: string; // user id
  jti: string; // session id
  exp?: number; // expiration time
  iat?: number; // issued at
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: NestJwtService,
    private readonly configService: ConfigService,
  ) {}

  async generateAccessToken(user: LoginUser, jti: string): Promise<string> {
    const expiresIn = this.configService.get<string>(
      'app.jwt.accessTokenExpiresIn',
      '15m',
    ) as string | number;
    return await this.jwtService.signAsync<TokenPayload>(
      { email: user.email, sub: `${user.id}`, jti },
      {
        /* @ts-expect-error Necessary due to overly strict types in @nestjs/jwt */
        expiresIn,
      },
    );
  }

  async generateRefreshToken(user: LoginUser, jti: string): Promise<string> {
    const expiresIn = this.configService.get<string>(
      'app.jwt.refreshTokenExpiresIn',
      '7d',
    ) as string | number;
    return await this.jwtService.signAsync<TokenPayload>(
      { email: user.email, sub: `${user.id}`, jti },
      {
        /* @ts-expect-error Necessary due to overly strict types in @nestjs/jwt */
        expiresIn,
      },
    );
  }

  async verifyAccessToken(token: string): Promise<TokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<TokenPayload>(token, {
        secret: this.configService.get<string>('app.jwt.secret'),
      });
      return payload;
    } catch {
      throw new Error('Invalid or expired access token');
    }
  }

  async verifyRefreshToken(token: string): Promise<TokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<TokenPayload>(token, {
        secret: this.configService.get<string>('app.jwt.secret'),
      });
      return payload;
    } catch {
      throw new Error('Invalid or expired refresh token');
    }
  }
}
