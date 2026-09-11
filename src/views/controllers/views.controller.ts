import { Controller, Get, Post, Req, Res, Body, HttpStatus, HttpException, Param, Delete } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from '../../auth/auth.service';
import { SessionsService } from '../../auth/sessions/sessions.service';
import { TokenService } from '../../auth/token.service';
import { LoginDto } from '../../auth/dto/login.dto';
import { RegisterDto } from '../../auth/dto/register.dto';
import { LoginUser } from '../../auth/login-user.interface';
import { randomUUID } from 'node:crypto';
import { RequestMeta } from '../../auth/types';
import { getClientIp } from '../../auth/sessions/client-ip.util';

@Controller()
export class ViewsController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionsService: SessionsService,
    private readonly tokenService: TokenService,
  ) {}

  @Get('login')
  async showLoginPage(@Req() req: Request, @Res() res: Response) {
    // Check if user already has a valid session
    const cookies = req.cookies as Record<string, string>;
    const refreshToken = cookies?.refreshToken;

    if (refreshToken) {
      try {
        // Validate the refresh token
        const payload = await this.tokenService.verifyRefreshToken(refreshToken);
        // If valid, check if session exists
        const session = await this.sessionsService.findByJti(payload.jti);
        if (session) {
          // User is already logged in, redirect to sessions page
          return res.redirect('/sessions');
        }
      } catch (error) {
        // Token invalid or expired, continue to show login page
      }
    }

    // No valid session, render login page
    res.render('login');
  }

  @Post('login')
  async loginAPI(@Body() loginDto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { email, password } = loginDto;

    // Validate user credentials
    const user = await this.authService.validateUser(email, password);
    if (!user) {
      throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
    }

    const loginUser: LoginUser = {
      email: user.email,
      name: user.name || '',
      id: user.id,
    };

    // Generate token pair
    const pair = await this.generateTokenPair(loginUser);

    // Set refresh token cookie
    this.setRefreshTokenCookie(res, pair.refreshToken);

    // Create session record
    await this.sessionsService.create(
      user.id,
      pair.jti,
      this.getRequestMeta(req),
      pair.refreshExpiresAt,
    );

    // Redirect to sessions page (or return JSON if preferred)
    return res.redirect('/sessions');
  }

  // Helper method to generate token pair (copied from AuthController for now)
  private async generateTokenPair(loginUser: LoginUser): Promise<{ accessToken: string; refreshToken: string; jti: string; refreshExpiresAt: Date }> {
    const jti = randomUUID();
    const [accessToken, refreshToken] = await Promise.all([
      this.tokenService.generateAccessToken(loginUser, jti),
      this.tokenService.generateRefreshToken(loginUser, jti),
    ]);
    const refreshExpiresAt = this.tokenService.getExpiryFromToken(refreshToken);
    return { accessToken, refreshToken, jti, refreshExpiresAt };
  }

  // Helper method to set refresh token cookie (copied from AuthController)
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

  // Helper method to get request meta (copied from AuthController)
  private getRequestMeta(req: Request): RequestMeta {
    return {
      userAgent: req.headers['user-agent'] ?? null,
      ipAddress: getClientIp(req),
    };
  }

  
  @Get('register')
  async showRegisterPage(@Req() req: Request, @Res() res: Response) {
    // Check if user already has a valid session
    const cookies = req.cookies as Record<string, string>;
    const refreshToken = cookies?.refreshToken;

    if (refreshToken) {
      try {
        // Validate the refresh token
        const payload = await this.tokenService.verifyRefreshToken(refreshToken);
        // If valid, check if session exists
        const session = await this.sessionsService.findByJti(payload.jti);
        if (session) {
          // User is already logged in, redirect to sessions page
          return res.redirect('/sessions');
        }
      } catch (error) {
        // Token invalid or expired, continue to show register page
      }
    }

    // No valid session, render register page
    res.render('register');
  }

  @Post('register')
  async registerAPI(@Body() registerDto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { email, password, name } = registerDto;

    // Create user
    const user = await this.authService.createUser(email, password, name ?? '');
    if (!user) {
      throw new HttpException('Failed to create user', HttpStatus.BAD_REQUEST);
    }

    const loginUser: LoginUser = {
      email: user.email,
      name: user.name || '',
      id: user.id,
    };

    // Generate token pair
    const pair = await this.generateTokenPair(loginUser);

    // Set refresh token cookie
    this.setRefreshTokenCookie(res, pair.refreshToken);

    // Create session record
    await this.sessionsService.create(
      user.id,
      pair.jti,
      this.getRequestMeta(req),
      pair.refreshExpiresAt,
    );

    // Redirect to sessions page (or return JSON if preferred)
    return res.redirect('/sessions');
  }

  @Get('sessions')
  async showSessionsPage(@Req() req: Request, @Res() res: Response) {
    // Validate session and get access token for internal service calls
    const { accessToken, userId } = await this.validateAndGetAccessToken(req);

    // Get sessions for the user
    const sessions = await this.sessionsService.listForUser(userId);

    // Render sessions page with session data
    res.render('sessions', {
      sessions: sessions.map(session => ({
        id: session.id,
        userAgent: session.userAgent || 'Unknown',
        ipAddress: session.ipAddress || 'Unknown',
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
      }))
    });
  }

  // Helper method to validate session and get access token
  private async validateAndGetAccessToken(req: Request): Promise<{ accessToken: string; userId: string }> {
    const cookies = req.cookies as Record<string, string>;
    const refreshToken = cookies?.refreshToken;

    if (!refreshToken) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    try {
      // Validate the refresh token
      const payload = await this.tokenService.verifyRefreshToken(refreshToken);

      // Check if session exists
      const session = await this.sessionsService.findByJti(payload.jti);
      if (!session) {
        throw new HttpException('Invalid session', HttpStatus.UNAUTHORIZED);
      }

      // Generate access token for internal service calls
      const accessToken = await this.tokenService.generateAccessToken(
        { email: payload.email, name: '', id: payload.sub },
        payload.jti
      );

      return { accessToken, userId: payload.sub };
    } catch (error) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }
  }

  // API endpoint to get sessions as JSON
  @Get('views/sessions')
  async sessionsAPI(@Req() req: Request): Promise<{ sessions: Array<{ id: string; userAgent: string; ipAddress: string; createdAt: Date; expiresAt: Date }> }> {
    // Validate session and get access token for internal service calls
    const { accessToken, userId } = await this.validateAndGetAccessToken(req);

    // Get sessions for the user
    const sessions = await this.sessionsService.listForUser(userId);

    return {
      sessions: sessions.map(session => ({
        id: session.id,
        userAgent: session.userAgent || 'Unknown',
        ipAddress: session.ipAddress || 'Unknown',
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
      }))
    };
  }

  // API endpoint to revoke a specific session
  @Delete('views/sessions/:id')
  async revokeSession(@Param('id') id: string, @Req() req: Request): Promise<{ success: boolean }> {
    // Validate session
    const { userId } = await this.validateAndGetAccessToken(req);

    // Check if session belongs to user
    const session = await this.sessionsService.findByJti(id);
    if (!session || session.userId !== userId) {
      throw new HttpException('Session not found or unauthorized', HttpStatus.NOT_FOUND);
    }

    // Delete the session
    const result = await this.sessionsService.deleteByJti(id, userId);

    return { success: result };
  }

  // API endpoint to revoke all sessions except current
  @Delete('views/sessions')
  async revokeAllExceptCurrent(@Req() req: Request): Promise<{ success: boolean; count: number }> {
    // Validate session to get current session ID
    const cookies = req.cookies as Record<string, string>;
    const refreshToken = cookies?.refreshToken;

    if (!refreshToken) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const payload = await this.tokenService.verifyRefreshToken(refreshToken);
    const currentJti = payload.jti;

    // Get user ID from token
    const userId = payload.sub;

    // Delete all sessions except current
    const count = await this.sessionsService.deleteAllForUser(userId, currentJti);

    return { success: true, count };
  }

  // Handle 404 - catch-all for undefined routes
  @Get('*')
  async handleNotFound(@Res() res: Response) {
    res.status(404).render('404');
  }
}