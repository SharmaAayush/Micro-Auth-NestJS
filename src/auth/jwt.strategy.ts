import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { TokenPayload } from './token.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private authService: AuthService,
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
    // Validate user exists and return user object (without password)
    const user = await this.authService.findByEmail(payload.email);
    if (!user) {
      return null; // This will cause the strategy to fail
    }
    // Return user object without password
    const { password: _password, ...result } = user;
    // _password is intentionally not used
    return result;
  }

}