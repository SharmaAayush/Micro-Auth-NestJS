import {
  Controller,
  Post,
  UseGuards,
  Request,
  Res,
  HttpStatus,
  Body,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request as ExpressRequest, Response } from 'express';
import { TokenService } from './token.service';
import { LoginUser } from './login-user.interface';
import { AuthService } from './auth.service';
import { User } from './users.entity';

interface AuthRequest extends ExpressRequest {
  user: LoginUser;
}

interface RegisterDto {
  email: string;
  password: string;
  name?: string;
}

interface RefreshTokenCookie {
  refreshToken?: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly tokenService: TokenService,
    private readonly authService: AuthService,
  ) {}

  private createLoginUser(
    user: Pick<User, 'email' | 'name' | 'id'>,
  ): LoginUser {
    return {
      email: user.email,
      name: user.name || '',
      id: user.id,
    };
  }

  private async generateTokenPair(
    loginUser: LoginUser,
  ): Promise<[string, string]> {
    const [accessToken, refreshToken] = await Promise.all([
      this.tokenService.generateAccessToken(loginUser),
      this.tokenService.generateRefreshToken(loginUser),
    ]);
    return [accessToken, refreshToken];
  }

  private setRefreshTokenCookie(res: Response, token: string): void {
    const isProduction = process.env.NODE_ENV === 'production';
    const sameSiteValue: boolean | 'none' | 'lax' | 'strict' = isProduction
      ? 'none'
      : 'lax';

    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: sameSiteValue,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      ...(isProduction && { domain: process.env.DOMAIN }),
    };

    res.cookie('refreshToken', token, cookieOptions);
  }

  @Post('register')
  async register(@Body() registerDto: RegisterDto, @Res() res: Response) {
    const { email, password, name } = registerDto;

    // Create user (password will be hashed by AuthService)
    const user = await this.authService.createUser(email, password, name ?? '');

    // Create login user object
    const loginUser: LoginUser = this.createLoginUser(user);

    // Generate tokens
    const [accessToken, refreshToken] = await this.generateTokenPair(loginUser);

    // Set HTTP-only cookie for refresh token
    this.setRefreshTokenCookie(res, refreshToken);

    // Return only access token in response body (matching login route)
    return res.status(HttpStatus.OK).json({ accessToken });
  }

  @Post('refresh-token')
  async refreshToken(@Req() req: ExpressRequest, @Res() res: Response) {
    const refreshToken = (req.cookies as RefreshTokenCookie)?.refreshToken;

    if (!refreshToken) {
      return res
        .status(HttpStatus.UNAUTHORIZED)
        .json({ message: 'Refresh token not provided' });
    }

    try {
      // Verify the refresh token
      const payload = await this.tokenService.verifyRefreshToken(refreshToken);

      // Explicitly validate expiration and issued at claims
      const currentTime = Math.floor(Date.now() / 1000);
      if (payload.exp !== undefined && payload.exp <= currentTime) {
        throw new Error('Refresh token has expired');
      }
      if (payload.iat !== undefined && payload.iat > currentTime) {
        throw new Error('Refresh token issued in the future');
      }

      // Find user by id from token payload
      const user = await this.authService.findByEmail(payload.email);
      if (!user) {
        return res
          .status(HttpStatus.UNAUTHORIZED)
          .json({ message: 'Invalid refresh token' });
      }

      // Create login user object
      const loginUser: LoginUser = this.createLoginUser(user);

      // Generate new token pair
      const [accessToken, newRefreshToken] =
        await this.generateTokenPair(loginUser);

      // Set HTTP-only cookie for new refresh token
      this.setRefreshTokenCookie(res, newRefreshToken);

      // Return new access token in response body
      return res
        .status(HttpStatus.OK)
        .json({ accessToken, refreshToken: newRefreshToken });
    } catch {
      return res
        .status(HttpStatus.UNAUTHORIZED)
        .json({ message: 'Invalid or expired refresh token' });
    }
  }

  @Post('login')
  @UseGuards(AuthGuard('local'))
  async login(
    @Request()
    req: AuthRequest,
    @Res()
    res: Response,
  ) {
    const user = req.user;

    // Create login user object
    const loginUser: LoginUser = this.createLoginUser(user);

    // Generate tokens
    const [accessToken, refreshToken] = await this.generateTokenPair(loginUser);

    // Set HTTP-only cookie for refresh token
    this.setRefreshTokenCookie(res, refreshToken);

    // Return only access token in response body
    return res.status(HttpStatus.OK).json({ accessToken });
  }
}
