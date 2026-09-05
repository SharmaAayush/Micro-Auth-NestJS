import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { SessionsService } from './sessions.service';
import { Session } from './session.entity';

type RepoMock = jest.Mocked<Repository<Session>>;

const buildRepoMock = (): RepoMock =>
  ({
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  }) as unknown as RepoMock;

/* eslint-disable @typescript-eslint/unbound-method */

describe('SessionsService', () => {
  let service: SessionsService;
  let repo: RepoMock;

  beforeEach(async () => {
    repo = buildRepoMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: getRepositoryToken(Session), useValue: repo },
      ],
    }).compile();
    service = module.get<SessionsService>(SessionsService);
  });

  const futureDate = (): Date => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  describe('create', () => {
    it('persists a session row with the given fields', async () => {
      const expiresAt = futureDate();
      const created: Session = {
        id: 'jti-1',
        userId: '00000000-0000-0000-0000-000000000042',
        userAgent: 'ua',
        ipAddress: '1.2.3.4',
        createdAt: new Date(),
        expiresAt,
      };
      repo.create.mockReturnValue(created);
      repo.save.mockResolvedValue(created);

      const result = await service.create(
        '00000000-0000-0000-0000-000000000042',
        'jti-1',
        { userAgent: 'ua', ipAddress: '1.2.3.4' },
        expiresAt,
      );

      expect(repo.create).toHaveBeenCalledWith({
        id: 'jti-1',
        userId: '00000000-0000-0000-0000-000000000042',
        userAgent: 'ua',
        ipAddress: '1.2.3.4',
        expiresAt,
      });
      expect(repo.save).toHaveBeenCalledWith(created);
      expect(result).toBe(created);
    });
  });

  describe('findByJti', () => {
    it('returns the session when the repository finds one', async () => {
      const found = { id: 'jti-1' } as Session;
      repo.findOne.mockResolvedValue(found);

      const result = await service.findByJti('jti-1');

      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'jti-1' } });
      expect(result).toBe(found);
    });

    it('returns null when the repository finds none', async () => {
      repo.findOne.mockResolvedValue(null);
      const result = await service.findByJti('missing');
      expect(result).toBeNull();
    });
  });

  describe('listForUser', () => {
    it('returns sessions for the user ordered by createdAt desc', async () => {
      const rows = [{ id: 'a' }, { id: 'b' }] as Session[];
      repo.find.mockResolvedValue(rows);

      const result = await service.listForUser(
        '00000000-0000-0000-0000-000000000042',
      );

      expect(repo.find).toHaveBeenCalledWith({
        where: { userId: '00000000-0000-0000-0000-000000000042' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toBe(rows);
    });
  });

  describe('deleteByJti', () => {
    it('returns true and deletes when the row exists and is owned by the user', async () => {
      const row = {
        id: 'jti-1',
        userId: '00000000-0000-0000-0000-000000000042',
      } as Session;
      repo.findOne.mockResolvedValue(row);
      repo.delete.mockResolvedValue({ affected: 1, raw: [] });

      const result = await service.deleteByJti(
        'jti-1',
        '00000000-0000-0000-0000-000000000042',
      );

      expect(repo.delete).toHaveBeenCalledWith('jti-1');
      expect(result).toBe(true);
    });

    it('returns false when the row is not found', async () => {
      repo.findOne.mockResolvedValue(null);
      const result = await service.deleteByJti(
        'missing',
        '00000000-0000-0000-0000-000000000042',
      );
      expect(repo.delete).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('returns false when the row is owned by another user', async () => {
      const row = {
        id: 'jti-1',
        userId: '00000000-0000-0000-0000-000000000099',
      } as Session;
      repo.findOne.mockResolvedValue(row);
      const result = await service.deleteByJti(
        'jti-1',
        '00000000-0000-0000-0000-000000000042',
      );
      expect(repo.delete).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe('deleteAllForUser', () => {
    const buildQueryBuilderMock = () => {
      const qb = {
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn(),
      };
      return qb as unknown as SelectQueryBuilder<Session> & typeof qb;
    };

    it('deletes every row for the user', async () => {
      const qb = buildQueryBuilderMock();
      qb.execute.mockResolvedValue({ affected: 3, raw: [] });
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.deleteAllForUser(
        '00000000-0000-0000-0000-000000000042',
      );

      expect(qb.where).toHaveBeenCalledWith('session.user_id = :userId', {
        userId: '00000000-0000-0000-0000-000000000042',
      });
      expect(qb.execute).toHaveBeenCalled();
      expect(result).toBe(3);
    });

    it('excludes exceptJti from the delete when provided', async () => {
      const qb = buildQueryBuilderMock();
      qb.execute.mockResolvedValue({ affected: 2, raw: [] });
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.deleteAllForUser(
        '00000000-0000-0000-0000-000000000042',
        'keep-this',
      );

      expect(qb.andWhere).toHaveBeenCalledWith('session.id != :exceptJti', {
        exceptJti: 'keep-this',
      });
      expect(result).toBe(2);
    });

    it('does not call andWhere when exceptJti is not provided', async () => {
      const qb = buildQueryBuilderMock();
      qb.execute.mockResolvedValue({ affected: 0, raw: [] });
      repo.createQueryBuilder.mockReturnValue(qb);

      await service.deleteAllForUser('00000000-0000-0000-0000-000000000042');

      expect(qb.andWhere).not.toHaveBeenCalled();
    });
  });
});
