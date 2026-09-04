import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { SessionsService } from './sessions.service';
import { RequestUser } from '../types';

@Controller('auth/sessions')
@UseGuards(AuthGuard('jwt'))
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  async list(@Req() req: Request & { user: RequestUser }) {
    const sessions = await this.sessionsService.listForUser(req.user.id);
    return sessions.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
    }));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteOne(
    @Req() req: Request & { user: RequestUser },
    @Param('id') id: string,
  ): Promise<void> {
    const ok = await this.sessionsService.deleteByJti(id, req.user.id);
    if (!ok) {
      throw new NotFoundException('Session not found');
    }
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAll(@Req() req: Request & { user: RequestUser }): Promise<void> {
    await this.sessionsService.deleteAllForUser(req.user.id, req.user.jti);
  }
}
