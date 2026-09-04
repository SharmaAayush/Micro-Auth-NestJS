import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from './session.entity';

export interface SessionCreateMeta {
  userAgent: string | null;
  ipAddress: string | null;
}

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(Session)
    private readonly sessionsRepository: Repository<Session>,
  ) {}

  async create(
    userId: string,
    jti: string,
    meta: SessionCreateMeta,
    expiresAt: Date,
  ): Promise<Session> {
    const session = this.sessionsRepository.create({
      id: jti,
      userId,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
      expiresAt,
    });
    return this.sessionsRepository.save(session);
  }

  async findByJti(jti: string): Promise<Session | null> {
    return this.sessionsRepository.findOne({ where: { id: jti } });
  }

  async listForUser(userId: string): Promise<Session[]> {
    return this.sessionsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async deleteByJti(jti: string, userId: string): Promise<boolean> {
    const row = await this.sessionsRepository.findOne({ where: { id: jti } });
    if (!row || row.userId !== userId) {
      return false;
    }
    await this.sessionsRepository.delete(jti);
    return true;
  }

  async deleteAllForUser(userId: string, exceptJti?: string): Promise<number> {
    const qb = this.sessionsRepository
      .createQueryBuilder()
      .delete()
      .where('session.user_id = :userId', { userId });
    if (exceptJti !== undefined) {
      qb.andWhere('session.id != :exceptJti', { exceptJti });
    }
    const result = await qb.execute();
    return result.affected ?? 0;
  }
}
