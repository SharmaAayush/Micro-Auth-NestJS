import { Controller, Get, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { SessionsService } from '../auth/sessions/sessions.service';
import { TokenService } from '../auth/token.service';

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
}