import {
  Controller,
  Post,
  UseGuards,
  Request,
  Res,
  HttpStatus,
  Body,
  Get,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request as ExpressRequest, Response } from 'express';
import { TokenService } from './token.service';
import { LoginUser } from './login-user.interface';
import { AuthService } from './auth.service';

interface AuthRequest extends ExpressRequest {
  user: LoginUser;
}

interface RegisterDto {
  email: string;
  password: string;
  name?: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly tokenService: TokenService,
    private readonly authService: AuthService,
  ) {}

  @Post('register')
  async register(
    @Body() registerDto: RegisterDto,
    @Res() res: Response,
  ) {
    const { email, password, name } = registerDto;
    
    // Create user (password will be hashed by AuthService)
    const user = await this.authService.createUser(email, password, name ?? '');
    
    // Generate tokens for the newly registered user
    const loginUser: LoginUser = {
      email: user.email,
      name: user.name,
      id: user.id,
    };
    
    const accessTokenPromise = this.tokenService.generateAccessToken(loginUser);
    const refreshTokenPromise = this.tokenService.generateRefreshToken(loginUser);
    
    const [accessToken, refreshToken] = await Promise.all([
      accessTokenPromise,
      refreshTokenPromise,
    ]);

    // Set HTTP-only cookie for refresh token with cross-subdomain support
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
      domain: isProduction ? process.env.DOMAIN : undefined,
    };

    // Remove domain property if not in production (to avoid setting domain in development)
    if (!isProduction) {
      delete cookieOptions.domain;
    }

    res.cookie('refreshToken', refreshToken, cookieOptions);

    // Return access token in response body
    return res.status(HttpStatus.OK).json({ accessToken, refreshToken });
  }

  @Post('refresh-token')
  async refreshToken(
    @Req() req: ExpressRequest,
    @Res() res: Response,
  ) {
    const refreshToken = req.cookies?.refreshToken;
    
    if (!refreshToken) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ message: 'Refresh token not provided' });
    }

    try {
      // Verify the refresh token
      const payload = await this.tokenService.verifyRefreshToken(refreshToken);
      
      // Find user by id from token payload
      const user = await this.authService.findByEmail(payload.email);
      if (!user) {
        return res.status(HttpStatus.UNAUTHORIZED).json({ message: 'Invalid refresh token' });
      }

      // Generate new token pair
      const loginUser: LoginUser = {
        email: user.email,
        name: user.name,
        id: user.id,
      };
      
      const accessTokenPromise = this.tokenService.generateAccessToken(loginUser);
      const newRefreshTokenPromise = this.tokenService.generateRefreshToken(loginUser);
      
      const [accessToken, newRefreshToken] = await Promise.all([
        accessTokenPromise,
        newRefreshTokenPromise,
      ]);

      // Set HTTP-only cookie for new refresh token
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
      domain: isProduction ? process.env.DOMAIN : undefined,
    };

    // Remove domain property if not in production (to avoid setting domain in development)
    if (!isProduction) {
      delete cookieOptions.domain;
    }

    res.cookie('refreshToken', newRefreshToken, cookieOptions);

    // Return new access token in response body
    return res.status(HttpStatus.OK).json({ accessToken, refreshToken: newRefreshToken });
    } catch (error) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ message: 'Invalid or expired refresh token' });
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
      domain: isProduction ? process.env.DOMAIN : undefined,
    };

    // Remove domain property if not in production (to avoid setting domain in development)
    if (!isProduction) {
      delete cookieOptions.domain;
    }

    res.cookie('refreshToken', refreshToken, cookieOptions);

    // Return access token in response body
    return res.status(HttpStatus.OK).json({ accessToken });
  }
}
