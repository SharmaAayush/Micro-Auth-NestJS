import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionsService } from './sessions/sessions.service';
import { TokenPayload } from './token.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly sessionsService: SessionsService,
  ) {
    const secret = configService.get<string>('app.jwt.secret');
    if (!secret) {
      throw new Error('JWT secret is not configured');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: TokenPayload) {
    const session = await this.sessionsService.findByJti(payload.jti);
    if (!session) {
      return null; // This will cause the strategy to fail with 401
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      return null; // Session exists but is expired
    }
    return {
      id: session.userId,
      email: payload.email,
      jti: payload.jti,
    };
  }
}
