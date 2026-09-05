import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { User } from './users.entity';

/* eslint-disable @typescript-eslint/unbound-method */

type UserRepoMock = jest.Mocked<Repository<User>>;

const buildUserRepoMock = (): UserRepoMock =>
  ({
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  }) as unknown as UserRepoMock;

describe('AuthService', () => {
  let service: AuthService;
  let usersRepository: UserRepoMock;

  beforeEach(async () => {
    usersRepository = buildUserRepoMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: usersRepository },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
  });

  describe('findByEmail', () => {
    it('returns the user when one matches the email', async () => {
      const user = { id: 'u1', email: 'a@b.c' } as User;
      usersRepository.findOneBy.mockResolvedValue(user);

      const result = await service.findByEmail('a@b.c');

      expect(usersRepository.findOneBy).toHaveBeenCalledWith({
        email: 'a@b.c',
      });
      expect(result).toBe(user);
    });

    it('returns null when no user matches', async () => {
      usersRepository.findOneBy.mockResolvedValue(null);
      const result = await service.findByEmail('missing@b.c');
      expect(result).toBeNull();
    });
  });

  describe('validateUser', () => {
    it('returns the user without the password when credentials match', async () => {
      const hash = await bcrypt.hash('pw', 4);
      const stored = {
        id: 'u1',
        email: 'a@b.c',
        password: hash,
        name: 'A',
      } as User;
      usersRepository.findOneBy.mockResolvedValue(stored);

      const result = await service.validateUser('a@b.c', 'pw');

      expect(result).toEqual({ id: 'u1', email: 'a@b.c', name: 'A' });
      expect(result).not.toHaveProperty('password');
    });

    it('returns null when the user is not found', async () => {
      usersRepository.findOneBy.mockResolvedValue(null);
      const result = await service.validateUser('missing@b.c', 'pw');
      expect(result).toBeNull();
    });

    it('returns null when the password does not match', async () => {
      const hash = await bcrypt.hash('pw', 4);
      usersRepository.findOneBy.mockResolvedValue({
        id: 'u1',
        email: 'a@b.c',
        password: hash,
      } as User);

      const result = await service.validateUser('a@b.c', 'wrong');
      expect(result).toBeNull();
    });
  });

  describe('createUser', () => {
    it('throws ConflictException when the email is already taken', async () => {
      usersRepository.findOneBy.mockResolvedValue({
        id: 'u1',
        email: 'a@b.c',
      } as User);

      await expect(service.createUser('a@b.c', 'pw', 'A')).rejects.toThrow(
        ConflictException,
      );
      expect(usersRepository.create).not.toHaveBeenCalled();
      expect(usersRepository.save).not.toHaveBeenCalled();
    });

    it('creates and saves a new user when the email is free', async () => {
      usersRepository.findOneBy.mockResolvedValue(null);
      const created: Partial<User> = {
        email: 'a@b.c',
        password: 'pw',
        name: 'A',
      };
      usersRepository.create.mockReturnValue(created as User);
      usersRepository.save.mockResolvedValue(created as User);

      const result = await service.createUser('a@b.c', 'pw', 'A');

      expect(usersRepository.create).toHaveBeenCalledWith({
        email: 'a@b.c',
        password: 'pw',
        name: 'A',
      });
      expect(usersRepository.save).toHaveBeenCalledWith(created);
      expect(result).toBe(created);
    });
  });
});
