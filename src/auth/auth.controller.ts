import {
  Controller,
  Post,
  UseGuards,
  Res,
  HttpStatus,
  Body,
  Req,
  Get,
  HttpException,
  HttpCode,
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
import { RequestMeta } from './types';

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
    const refreshExpiresAt = this.tokenService.getExpiryFromToken(refreshToken);
    return { accessToken, refreshToken, jti, refreshExpiresAt };
  }

  private getRequestMeta(req: Request): RequestMeta {
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
  @HttpCode(HttpStatus.OK)
  async register(
    @Body() registerDto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
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

    return { accessToken: pair.accessToken };
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = (req as Request & { cookies: Record<string, string | undefined> }).cookies?.refreshToken;

    if (!refreshToken) {
      throw new HttpException(
        { message: 'Refresh token not provided' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    let payload: TokenPayload;
    try {
      payload = await this.tokenService.verifyRefreshToken(refreshToken);
    } catch {
      throw new HttpException(
        { message: 'Invalid or expired refresh token' },
        HttpStatus.UNAUTHORIZED,
      );
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
      throw new HttpException(
        { message: 'Refresh token reuse detected' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const user = await this.authService.findByEmail(payload.email);
    if (!user) {
      throw new HttpException(
        { message: 'Invalid refresh token' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const loginUser: LoginUser = {
      email: user.email,
      name: user.name || '',
      id: user.id,
    };
    const pair = await this.generateTokenPair(loginUser);
    this.setRefreshTokenCookie(res, pair.refreshToken);

    // Transaction: delete the old session row, create the new one.
    const requestMeta = this.getRequestMeta(req);
    await this.sessionsRepository.manager.transaction(async (manager) => {
      await manager.delete(Session, payload.jti);
      const newSession = manager.create(Session, {
        id: pair.jti,
        userId: user.id,
        userAgent: requestMeta.userAgent,
        ipAddress: requestMeta.ipAddress,
        expiresAt: pair.refreshExpiresAt,
      });
      await manager.save(newSession);
    });

    return { accessToken: pair.accessToken };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('local'))
  async login(
    @Body() _loginDto: LoginDto,
    @Req() req: Request & { user: LoginUser },
    @Res({ passthrough: true }) res: Response,
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

    return { accessToken: pair.accessToken };
  }

  @Get('validate')
  @UseGuards(AuthGuard('jwt'))
  validate() {
    // Guard handles validation - if we reach here, token + session are valid
  }
}
