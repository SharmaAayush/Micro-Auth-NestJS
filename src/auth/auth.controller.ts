import {
  Controller,
  Post,
  UseGuards,
  Request,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request as ExpressRequest, Response } from 'express';
import { TokenService } from './token.service';
import { LoginUser } from './login-user.interface';

interface AuthRequest extends ExpressRequest {
  user: LoginUser;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly tokenService: TokenService) {}

  @Post('login')
  @UseGuards(AuthGuard('local'))
  async login(
    @Request()
    req: AuthRequest,
    @Res()
    res: Response,
  ) {
    const user = req.user;

    // Generate tokens
    const accessTokenPromise = this.tokenService.generateAccessToken(user);
    const refreshTokenPromise = this.tokenService.generateRefreshToken(user);

    const [accessToken, refreshToken] = await Promise.all([
      accessTokenPromise,
      refreshTokenPromise,
    ]);

    // Set HTTP-only cookie for refresh token with cross-subdomain support
    // TODO: Refresh token endpoint is not implemented yet, so this cookie will not be used for now
    const isProduction = process.env.NODE_ENV === 'production';

    // Base cookie options with all possible properties
    const sameSiteValue: boolean | 'none' | 'lax' | 'strict' = isProduction
      ? 'none'
      : 'lax';
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction, // MUST be true for sameSite='none' in production
      sameSite: sameSiteValue,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    };

    // Only set domain in production for subdomain sharing
    if (isProduction) {
      // @ts-expect-error: Domain assignment to cookieOptions
      cookieOptions.domain = '.domain.com';
    }

    res.cookie('refreshToken', refreshToken, cookieOptions);

    // Return access token in response body
    return res.status(HttpStatus.OK).json({ accessToken });
  }
}
