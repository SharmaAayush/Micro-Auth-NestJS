import {
  Controller,
  Post,
  UseGuards,
  Res,
  HttpStatus,
  Body,
  Req,
  Get,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { TokenService, TokenPayload } from './token.service';
import { LoginUser } from './login-user.interface';
import { AuthService } from './auth.service';
import { SessionsService } from './sessions/sessions.service';
import { getClientIp } from './sessions/client-ip.util';
import { Session } from './sessions/session.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RequestUser, RequestMeta } from './types';

interface TokenPairResult {
  accessToken: string;
  refreshToken: string;
  jti: string;
  refreshExpiresAt: Date;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly tokenService: TokenService,
    private readonly authService: AuthService,
    private readonly sessionsService: SessionsService,
    @InjectRepository(Session)
    private readonly sessionsRepository: Repository<Session>,
  ) {}

  private async generateTokenPair(
    loginUser: LoginUser,
  ): Promise<TokenPairResult> {
    const jti = randomUUID();
    const [accessToken, refreshToken] = await Promise.all([
      this.tokenService.generateAccessToken(loginUser, jti),
      this.tokenService.generateRefreshToken(loginUser, jti),
    ]);
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return { accessToken, refreshToken, jti, refreshExpiresAt };
  }

  private getRequestMeta(req: Request): {
    userAgent: string | null;
    ipAddress: string | null;
  } {
    return {
      userAgent: req.headers['user-agent'] ?? null,
      ipAddress: getClientIp(req),
    };
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
  async register(
    @Body() registerDto: RegisterDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { email, password, name } = registerDto;

    const user = await this.authService.createUser(email, password, name ?? '');
    const loginUser: LoginUser = {
      email: user.email,
      name: user.name || '',
      id: user.id,
    };

    const pair = await this.generateTokenPair(loginUser);
    this.setRefreshTokenCookie(res, pair.refreshToken);
    await this.sessionsService.create(
      user.id,
      pair.jti,
      this.getRequestMeta(req),
      pair.refreshExpiresAt,
    );

    return res.status(HttpStatus.OK).json({ accessToken: pair.accessToken });
  }

  @Post('refresh-token')
  async refreshToken(@Req() req: Request, @Res() res: Response) {
    const refreshToken = (req as Request & { cookies: Record<string, string | undefined> }).cookies?.refreshToken;

    if (!refreshToken) {
      return res
        .status(HttpStatus.UNAUTHORIZED)
        .json({ message: 'Refresh token not provided' });
    }

    let payload: TokenPayload;
    try {
      payload = await this.tokenService.verifyRefreshToken(refreshToken);
    } catch {
      return res
        .status(HttpStatus.UNAUTHORIZED)
        .json({ message: 'Invalid or expired refresh token' });
    }

    // Reuse-detection: if no session row exists for this jti, the refresh
    // token was already rotated or revoked. Treat as a replay and revoke
    // all sessions for the user.
    const existing = await this.sessionsService.findByJti(payload.jti);
    if (!existing) {
      const userForRevoke = await this.authService.findByEmail(payload.email);
      if (userForRevoke) {
        await this.sessionsService.deleteAllForUser(userForRevoke.id);
      }
      return res
        .status(HttpStatus.UNAUTHORIZED)
        .json({ message: 'Refresh token reuse detected' });
    }

    const user = await this.authService.findByEmail(payload.email);
    if (!user) {
      return res
        .status(HttpStatus.UNAUTHORIZED)
        .json({ message: 'Invalid refresh token' });
    }

    const loginUser: LoginUser = {
      email: user.email,
      name: user.name || '',
      id: user.id,
    };
    const pair = await this.generateTokenPair(loginUser);
    this.setRefreshTokenCookie(res, pair.refreshToken);

    // Transaction: delete the old session row, create the new one.
    await this.sessionsRepository.manager.transaction(async (manager) => {
      await manager.delete(Session, payload.jti);
      const newSession = manager.create(Session, {
        id: pair.jti,
        userId: user.id,
        userAgent: this.getRequestMeta(req).userAgent,
        ipAddress: this.getRequestMeta(req).ipAddress,
        expiresAt: pair.refreshExpiresAt,
      });
      await manager.save(newSession);
    });

    return res.status(HttpStatus.OK).json({ accessToken: pair.accessToken });
  }

  @Post('login')
  @UseGuards(AuthGuard('local'))
  async login(
    @Body() _loginDto: LoginDto,
    @Req() req: Request & { user: LoginUser },
    @Res() res: Response,
  ) {
    const user = req.user;
    const loginUser: LoginUser = {
      email: user.email,
      name: user.name || '',
      id: user.id,
    };

    const pair = await this.generateTokenPair(loginUser);
    this.setRefreshTokenCookie(res, pair.refreshToken);
    await this.sessionsService.create(
      user.id,
      pair.jti,
      this.getRequestMeta(req),
      pair.refreshExpiresAt,
    );

    return res.status(HttpStatus.OK).json({ accessToken: pair.accessToken });
  }

  @Get('validate')
  @UseGuards(AuthGuard('jwt'))
  validate() {
    // Guard handles validation - if we reach here, token + session are valid
  }
}
