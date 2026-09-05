import { Injectable } from '@nestjs/common';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { LoginUser } from './login-user.interface';

export interface TokenPayload {
  email: string;
  sub: string;
  jti: string;
  exp?: number;
  iat?: number;
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

  getExpiryFromToken(jwt: string): Date {
    const payload = this.jwtService.decode(jwt) as TokenPayload | null;
    if (!payload?.exp) {
      throw new Error('Refresh token is missing the exp claim');
    }
    return new Date(payload.exp * 1000);
  }

  private async verify(
    token: string,
    kind: 'access' | 'refresh',
  ): Promise<TokenPayload> {
    try {
      return await this.jwtService.verifyAsync<TokenPayload>(token, {
        secret: this.configService.get<string>('app.jwt.secret'),
      });
    } catch {
      throw new Error(`Invalid or expired ${kind} token`);
    }
  }

  verifyAccessToken(token: string): Promise<TokenPayload> {
    return this.verify(token, 'access');
  }

  verifyRefreshToken(token: string): Promise<TokenPayload> {
    return this.verify(token, 'refresh');
  }
}
