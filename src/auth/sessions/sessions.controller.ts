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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { SessionsService } from './sessions.service';
import { SessionDto } from '../dto/session.dto';
import { RequestUser } from '../types';

@ApiTags('sessions')
@ApiBearerAuth('bearer')
@Controller('auth/sessions')
@UseGuards(AuthGuard('jwt'))
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  @ApiOperation({
    summary: 'List the current user’s active sessions',
    description:
      'Returns one row per active session, including the User-Agent and IP captured at session creation. The body is `{ data: SessionDto[] }`.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Active sessions for the current user.',
    type: SessionDto,
    isArray: true,
  })
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
  @ApiOperation({
    summary: 'Terminate a specific session by id',
    description:
      'Deletes a single session row. Returns 404 if no session with that id belongs to the current user. Body on success is the empty envelope `{ data: null }`.',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Session terminated. Body: `{ data: null }`.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No session with that id is owned by the current user.',
  })
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
  @ApiOperation({
    summary: 'Terminate all other sessions for the current user',
    description:
      'Deletes every session for the current user except the one matching the Bearer token’s `jti`. Useful as a "log out everywhere else" action. Body on success is the empty envelope `{ data: null }`.',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Other sessions terminated. Body: `{ data: null }`.',
  })
  async deleteAll(@Req() req: Request & { user: RequestUser }): Promise<void> {
    await this.sessionsService.deleteAllForUser(req.user.id, req.user.jti);
  }
}
