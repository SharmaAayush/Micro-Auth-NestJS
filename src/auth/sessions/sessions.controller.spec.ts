import { NotFoundException } from '@nestjs/common';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { Session } from './session.entity';
import { RequestUser } from '../types';

const buildReq = (user: RequestUser) =>
  ({ user }) as unknown as Parameters<SessionsController['list']>[0];

describe('SessionsController', () => {
  let controller: SessionsController;
  let sessionsService: {
    listForUser: jest.Mock;
    deleteByJti: jest.Mock;
    deleteAllForUser: jest.Mock;
  };

  beforeEach(() => {
    sessionsService = {
      listForUser: jest.fn(),
      deleteByJti: jest.fn(),
      deleteAllForUser: jest.fn(),
    };
    controller = new SessionsController(
      sessionsService as unknown as SessionsService,
    );
  });

  const user: RequestUser = {
    id: '00000000-0000-0000-0000-000000000042',
    email: 'a@b.c',
    jti: 'jti-current',
  };

  describe('list', () => {
    it('returns DTO-shaped rows for each session owned by the user', async () => {
      const createdAt = new Date('2026-09-01T10:00:00.000Z');
      const expiresAt = new Date('2026-09-08T10:00:00.000Z');
      const rows: Session[] = [
        {
          id: 'jti-1',
          userId: user.id,
          userAgent: 'ua-1',
          ipAddress: '1.1.1.1',
          createdAt,
          expiresAt,
        },
        {
          id: 'jti-2',
          userId: user.id,
          userAgent: null,
          ipAddress: null,
          createdAt,
          expiresAt,
        },
      ];
      sessionsService.listForUser.mockResolvedValue(rows);

      const result = await controller.list(buildReq(user));

      expect(sessionsService.listForUser).toHaveBeenCalledWith(user.id);
      expect(result).toEqual([
        {
          id: 'jti-1',
          userAgent: 'ua-1',
          ipAddress: '1.1.1.1',
          createdAt,
          expiresAt,
        },
        {
          id: 'jti-2',
          userAgent: null,
          ipAddress: null,
          createdAt,
          expiresAt,
        },
      ]);
    });

    it('returns an empty array when the user has no sessions', async () => {
      sessionsService.listForUser.mockResolvedValue([]);
      const result = await controller.list(buildReq(user));
      expect(result).toEqual([]);
    });
  });

  describe('deleteOne', () => {
    it('deletes the session and resolves when deleteByJti returns true', async () => {
      sessionsService.deleteByJti.mockResolvedValue(true);
      await expect(
        controller.deleteOne(buildReq(user), 'jti-1'),
      ).resolves.toBeUndefined();
      expect(sessionsService.deleteByJti).toHaveBeenCalledWith(
        'jti-1',
        user.id,
      );
    });

    it('throws NotFoundException when deleteByJti returns false', async () => {
      sessionsService.deleteByJti.mockResolvedValue(false);
      await expect(
        controller.deleteOne(buildReq(user), 'missing'),
      ).rejects.toThrow(NotFoundException);
      expect(sessionsService.deleteByJti).toHaveBeenCalledWith(
        'missing',
        user.id,
      );
    });
  });

  describe('deleteAll', () => {
    it('calls deleteAllForUser with the current user id and jti', async () => {
      sessionsService.deleteAllForUser.mockResolvedValue(2);
      await expect(
        controller.deleteAll(buildReq(user)),
      ).resolves.toBeUndefined();
      expect(sessionsService.deleteAllForUser).toHaveBeenCalledWith(
        user.id,
        user.jti,
      );
    });
  });
});
