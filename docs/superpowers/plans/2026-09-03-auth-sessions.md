# Auth Sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `Session` table bound to JWT `jti`, make `GET /auth/validate` 200/401 based on session existence, and add session-management routes (`GET /auth/sessions`, `DELETE /auth/sessions/:id`, `DELETE /auth/sessions`).

**Architecture:** New `sessions` module under `src/auth/` owns the `Session` entity and a small service with a single hot-path read (`findByJti`). Both access and refresh tokens of a pair carry the same `jti`; the row's `id` equals that `jti`. The `JwtStrategy` consults the service on every authenticated request. Refresh-token rotation runs inside a TypeORM transaction that deletes the old row and inserts the new one, with reuse detection that revokes all sessions for a user if a rotated refresh token is replayed.

**Tech Stack:** NestJS 11, TypeORM (PostgreSQL), PassportJS, Jest, supertest.

**Spec:** [docs/superpowers/specs/2026-09-03-auth-sessions-design.md](../../specs/2026-09-03-auth-sessions-design.md)

## Global Constraints

- NestJS 11, Express adapter. Nest CLI for module/service/controller generation per `AGENTS.md`.
- Constructor injection only. No `new SomeService()` anywhere.
- Every infrastructure integration gets its own module + service.
- TypeORM migrations per the runbook at [agents/docs/MIGRATIONS.md](../../../agents/docs/MIGRATIONS.md) — use `migration:create` for new table (offline), never `migration:generate` (requires live DB).
- Jest config in `package.json`: `rootDir: "src"`, `testRegex: ".*\\.spec\\.ts$"`, `testEnvironment: "node"`. Spec files live next to source files.
- Refresh-token TTL is `7d` (`app.jwt.refreshTokenExpiresIn`); access-token TTL is `15m`. `Session.expires_at` matches the refresh-token TTL.
- Use `randomUUID()` from `node:crypto` for jti generation; do not add a UUID library.
- Cookie name: `refreshToken`. Cookie options built in `setRefreshTokenCookie` (unchanged).
- All commits end with `Co-Authored-By: Claude Code <noreply@anthropic.com>` (added automatically by the git config in this environment).

---

## Task 1: Session entity

**Files:**
- Create: `src/auth/sessions/session.entity.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `Session` entity class — `id: string (uuid)`, `userId: number`, `userAgent: string | null`, `ipAddress: string | null`, `createdAt: Date`, `expiresAt: Date`, plus a `user` relation to `User`.

- [ ] **Step 1: Create the entity file**

Create `src/auth/sessions/session.entity.ts`:

```ts
import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../users.entity';

@Entity()
@Index('idx_session_user_id', ['userId'])
@Index('idx_session_expires_at', ['expiresAt'])
export class Session {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'integer' })
  userId!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ name: 'user_agent', type: 'varchar', nullable: true })
  userAgent!: string | null;

  @Column({ name: 'ip_address', type: 'varchar', nullable: true })
  ipAddress!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run build`
Expected: builds with no errors related to the new file.

- [ ] **Step 3: Commit**

```bash
git add src/auth/sessions/session.entity.ts
git commit -m "feat(auth): add Session entity"
```

---

## Task 2: Migration to create the `session` table

**Files:**
- Create: `src/db/migrations/<timestamp>-CreateSessions.ts` (timestamp must be > `1787932818277`)

**Interfaces:**
- Consumes: the table shape defined in Task 1.
- Produces: a migration class with `up()` and `down()`.

- [ ] **Step 1: Generate the migration file with `migration:create` (offline)**

Run:

```bash
npm run migration:create -- src/db/migrations/CreateSessions
```

Expected: a new file at `src/db/migrations/<timestamp>-CreateSessions.ts` is created with empty `up()` and `down()` methods. Note the timestamp from the filename — use it in the next step.

- [ ] **Step 2: Write the `up()` and `down()` methods**

Replace the contents of the generated file with:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSessions<Timestamp> implements MigrationInterface {
  name = 'CreateSessions<Timestamp>';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "session" (
      "id" uuid NOT NULL,
      "user_id" integer NOT NULL,
      "user_agent" character varying,
      "ip_address" character varying,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
      CONSTRAINT "PK_session_id" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(
      `CREATE INDEX "idx_session_user_id" ON "session" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_session_expires_at" ON "session" ("expires_at")`,
    );
    await queryRunner.query(
      `ALTER TABLE "session" ADD CONSTRAINT "FK_session_user_id" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "session" DROP CONSTRAINT "FK_session_user_id"`,
    );
    await queryRunner.query(`DROP INDEX "idx_session_expires_at"`);
    await queryRunner.query(`DROP INDEX "idx_session_user_id"`);
    await queryRunner.query(`DROP TABLE "session"`);
  }
}
```

Replace `<Timestamp>` with the actual timestamp from the generated filename in both the class name and the `name` string.

- [ ] **Step 3: Verify the file compiles**

Run: `npm run build`
Expected: builds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/db/migrations/<timestamp>-CreateSessions.ts
git commit -m "feat(db): migration to create session table"
```

---

## Task 3: SessionsService — failing tests

**Files:**
- Create: `src/auth/sessions/sessions.service.spec.ts`
- Create: `src/auth/sessions/sessions.service.ts` (skeleton with no-op methods so the test imports resolve)

**Interfaces:**
- Consumes: `Repository<Session>` (injected via `@InjectRepository(Session)` from `@nestjs/typeorm`).
- Produces: `SessionsService` with methods:
  - `create(userId: number, jti: string, meta: { userAgent: string | null; ipAddress: string | null }, expiresAt: Date): Promise<Session>`
  - `findByJti(jti: string): Promise<Session | null>`
  - `listForUser(userId: number): Promise<Session[]>`
  - `deleteByJti(jti: string, userId: number): Promise<boolean>`
  - `deleteAllForUser(userId: number, exceptJti?: string): Promise<number>`

- [ ] **Step 1: Write the failing test**

Create `src/auth/sessions/sessions.service.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  } as unknown as RepoMock);

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

  const futureDate = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  describe('create', () => {
    it('persists a session row with the given fields', async () => {
      const expiresAt = futureDate();
      const created: Session = {
        id: 'jti-1',
        userId: 42,
        userAgent: 'ua',
        ipAddress: '1.2.3.4',
        createdAt: new Date(),
        expiresAt,
      } as Session;
      repo.create.mockReturnValue(created);
      repo.save.mockResolvedValue(created);

      const result = await service.create(
        42,
        'jti-1',
        { userAgent: 'ua', ipAddress: '1.2.3.4' },
        expiresAt,
      );

      expect(repo.create).toHaveBeenCalledWith({
        id: 'jti-1',
        userId: 42,
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
      const found: Session = { id: 'jti-1' } as Session;
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
      const rows: Session[] = [{ id: 'a' }, { id: 'b' }] as Session[];
      repo.find.mockResolvedValue(rows);

      const result = await service.listForUser(42);

      expect(repo.find).toHaveBeenCalledWith({
        where: { userId: 42 },
        order: { createdAt: 'DESC' },
      });
      expect(result).toBe(rows);
    });
  });

  describe('deleteByJti', () => {
    it('returns true and deletes when the row exists and is owned by the user', async () => {
      const row: Session = { id: 'jti-1', userId: 42 } as Session;
      repo.findOne.mockResolvedValue(row);
      repo.delete.mockResolvedValue({ affected: 1, raw: [] });

      const result = await service.deleteByJti('jti-1', 42);

      expect(repo.delete).toHaveBeenCalledWith('jti-1');
      expect(result).toBe(true);
    });

    it('returns false when the row is not found', async () => {
      repo.findOne.mockResolvedValue(null);
      const result = await service.deleteByJti('missing', 42);
      expect(repo.delete).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('returns false when the row is owned by another user', async () => {
      const row: Session = { id: 'jti-1', userId: 99 } as Session;
      repo.findOne.mockResolvedValue(row);
      const result = await service.deleteByJti('jti-1', 42);
      expect(repo.delete).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe('deleteAllForUser', () => {
    it('deletes every row for the user', async () => {
      const qb = {
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 3, raw: [] }),
      };
      repo.createQueryBuilder.mockReturnValue(qb as any);

      const result = await service.deleteAllForUser(42);

      expect(qb.where).toHaveBeenCalledWith('session.user_id = :userId', {
        userId: 42,
      });
      expect(qb.execute).toHaveBeenCalled();
      expect(result).toBe(3);
    });

    it('excludes exceptJti from the delete when provided', async () => {
      const qb = {
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 2, raw: [] }),
      };
      repo.createQueryBuilder.mockReturnValue(qb as any);

      const result = await service.deleteAllForUser(42, 'keep-this');

      expect(qb.andWhere).toHaveBeenCalledWith('session.id != :exceptJti', {
        exceptJti: 'keep-this',
      });
      expect(result).toBe(2);
    });

    it('does not call andWhere when exceptJti is not provided', async () => {
      const qb = {
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0, raw: [] }),
      };
      repo.createQueryBuilder.mockReturnValue(qb as any);

      await service.deleteAllForUser(42);

      expect(qb.andWhere).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Create a skeleton service so the import resolves**

Create `src/auth/sessions/sessions.service.ts`:

```ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class SessionsService {}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx jest src/auth/sessions/sessions.service.spec.ts`
Expected: every test fails because the methods don't exist on `SessionsService`.

- [ ] **Step 4: Commit**

```bash
git add src/auth/sessions/sessions.service.spec.ts src/auth/sessions/sessions.service.ts
git commit -m "test(auth): failing tests for SessionsService"
```

---

## Task 4: SessionsService — implementation

**Files:**
- Modify: `src/auth/sessions/sessions.service.ts`

**Interfaces:** (same as Task 3, now real)

- [ ] **Step 1: Implement the service**

Replace the contents of `src/auth/sessions/sessions.service.ts` with:

```ts
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
    userId: number,
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

  async listForUser(userId: number): Promise<Session[]> {
    return this.sessionsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async deleteByJti(jti: string, userId: number): Promise<boolean> {
    const row = await this.sessionsRepository.findOne({ where: { id: jti } });
    if (!row || row.userId !== userId) {
      return false;
    }
    await this.sessionsRepository.delete(jti);
    return true;
  }

  async deleteAllForUser(
    userId: number,
    exceptJti?: string,
  ): Promise<number> {
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
```

- [ ] **Step 2: Run the tests**

Run: `npx jest src/auth/sessions/sessions.service.spec.ts`
Expected: all tests pass.

- [ ] **Step 3: Lint and typecheck**

Run: `npm run lint && npm run build`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/auth/sessions/sessions.service.ts
git commit -m "feat(auth): implement SessionsService"
```

---

## Task 5: SessionsModule

**Files:**
- Create: `src/auth/sessions/sessions.module.ts`

**Interfaces:**
- Consumes: `Session` entity.
- Produces: a Nest module exporting `SessionsService` and registering `Session` with `TypeOrmModule.forFeature`.

- [ ] **Step 1: Create the module**

Create `src/auth/sessions/sessions.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from './session.entity';
import { SessionsService } from './sessions.service';

@Module({
  imports: [TypeOrmModule.forFeature([Session])],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
```

The controller is added in a later task; for now the service is the only provider.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: builds clean.

- [ ] **Step 3: Commit**

```bash
git add src/auth/sessions/sessions.module.ts
git commit -m "feat(auth): add SessionsModule"
```

---

## Task 6: Client-IP helper

**Files:**
- Create: `src/auth/sessions/client-ip.util.ts`

**Interfaces:**
- Consumes: an Express `Request`.
- Produces: a `getClientIp(req): string | null` function.

- [ ] **Step 1: Create the helper**

Create `src/auth/sessions/client-ip.util.ts`:

```ts
import type { Request } from 'express';

export function getClientIp(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.ip ?? req.socket?.remoteAddress ?? null;
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: builds clean.

- [ ] **Step 3: Commit**

```bash
git add src/auth/sessions/client-ip.util.ts
git commit -m "feat(auth): add getClientIp helper"
```

---

## Task 7: Add `jti` to TokenService — failing test

**Files:**
- Create or modify: a test file for `TokenService`. (There isn't one yet, so create `src/auth/token.service.spec.ts`.)

**Interfaces:**
- Consumes: `JwtService` and `ConfigService` (existing).
- Produces: `TokenService` with new signatures:
  - `generateAccessToken(user: LoginUser, jti: string): Promise<string>`
  - `generateRefreshToken(user: LoginUser, jti: string): Promise<string>`
  - `TokenPayload` gains `jti: string`.

- [ ] **Step 1: Write the failing test**

Create `src/auth/token.service.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TokenService } from './token.service';

describe('TokenService', () => {
  let service: TokenService;
  let jwt: { signAsync: jest.Mock; verifyAsync: jest.Mock };

  beforeEach(async () => {
    jwt = { signAsync: jest.fn(), verifyAsync: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: JwtService, useValue: jwt },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('secret') },
        },
      ],
    }).compile();
    service = module.get<TokenService>(TokenService);
  });

  const user = { id: 7, email: 'a@b.c', name: 'A' };

  it('generateAccessToken signs with sub, email, and the given jti', async () => {
    jwt.signAsync.mockResolvedValue('access.jwt');
    const result = await service.generateAccessToken(user, 'jti-abc');
    expect(jwt.signAsync).toHaveBeenCalledWith(
      { sub: '7', email: 'a@b.c', jti: 'jti-abc' },
      { expiresIn: '15m' },
    );
    expect(result).toBe('access.jwt');
  });

  it('generateRefreshToken signs with sub, email, and the given jti', async () => {
    jwt.signAsync.mockResolvedValue('refresh.jwt');
    const result = await service.generateRefreshToken(user, 'jti-abc');
    expect(jwt.signAsync).toHaveBeenCalledWith(
      { sub: '7', email: 'a@b.c', jti: 'jti-abc' },
      { expiresIn: '7d' },
    );
    expect(result).toBe('refresh.jwt');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/auth/token.service.spec.ts`
Expected: FAIL — current `generateAccessToken(user)` only takes one argument and does not include `jti` in the payload.

- [ ] **Step 3: Commit**

```bash
git add src/auth/token.service.spec.ts
git commit -m "test(auth): failing test for jti in TokenService"
```

---

## Task 8: Add `jti` to TokenService — implementation

**Files:**
- Modify: `src/auth/token.service.ts`

**Interfaces:** (same as Task 7)

- [ ] **Step 1: Update `TokenService`**

Replace the contents of `src/auth/token.service.ts` with:

```ts
import { Injectable } from '@nestjs/common';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { LoginUser } from './login-user.interface';

export interface TokenPayload {
  email: string;
  sub: string; // user id
  jti: string; // session id
  exp?: number; // expiration time
  iat?: number; // issued at
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: NestJwtService,
    private readonly configService: ConfigService,
  ) {}

  async generateAccessToken(user: LoginUser, jti: string): Promise<string> {
    const expiresIn = this.configService.get<string>(
      'app.jwt.accessTokenExpiresIn',
      '15m',
    ) as string | number;
    return await this.jwtService.signAsync<TokenPayload>(
      { email: user.email, sub: `${user.id}`, jti },
      {
        /* @ts-expect-error Necessary due to overly strict types in @nestjs/jwt */
        expiresIn,
      },
    );
  }

  async generateRefreshToken(user: LoginUser, jti: string): Promise<string> {
    const expiresIn = this.configService.get<string>(
      'app.jwt.refreshTokenExpiresIn',
      '7d',
    ) as string | number;
    return await this.jwtService.signAsync<TokenPayload>(
      { email: user.email, sub: `${user.id}`, jti },
      {
        /* @ts-expect-error Necessary due to overly strict types in @nestjs/jwt */
        expiresIn,
      },
    );
  }

  async verifyAccessToken(token: string): Promise<TokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<TokenPayload>(token, {
        secret: this.configService.get<string>('app.jwt.secret'),
      });
      return payload;
    } catch {
      throw new Error('Invalid or expired access token');
    }
  }

  async verifyRefreshToken(token: string): Promise<TokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<TokenPayload>(token, {
        secret: this.configService.get<string>('app.jwt.secret'),
      });
      return payload;
    } catch {
      throw new Error('Invalid or expired refresh token');
    }
  }
}
```

- [ ] **Step 2: Run the tests**

Run: `npx jest src/auth/token.service.spec.ts`
Expected: all tests pass.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: builds clean. The existing `auth.controller.ts` will now have type errors because it calls `generateAccessToken(loginUser)` without a jti — this is fixed in Task 12; do not fix it here.

- [ ] **Step 4: Commit**

```bash
git add src/auth/token.service.ts
git commit -m "feat(auth): include jti in token payload"
```

---

## Task 9: JwtStrategy — failing tests

**Files:**
- Create: `src/auth/jwt.strategy.spec.ts`

**Interfaces:**
- Consumes: `SessionsService` and `ConfigService`.
- Produces: `JwtStrategy.validate(payload): Promise<{ id, email, jti } | null>` — returns the user object when a non-expired session exists, otherwise `null`.

- [ ] **Step 1: Write the failing test**

Create `src/auth/jwt.strategy.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { SessionsService } from './sessions.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let sessions: { findByJti: jest.Mock };

  beforeEach(async () => {
    sessions = { findByJti: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: SessionsService, useValue: sessions },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('secret') },
        },
      ],
    }).compile();
    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  const basePayload = { sub: '7', email: 'a@b.c', jti: 'jti-1' };

  it('returns the user when a non-expired session exists', async () => {
    sessions.findByJti.mockResolvedValue({
      id: 'jti-1',
      userId: 7,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const result = await strategy.validate(basePayload as any);

    expect(result).toEqual({ id: 7, email: 'a@b.c', jti: 'jti-1' });
  });

  it('returns null when no session row exists', async () => {
    sessions.findByJti.mockResolvedValue(null);
    const result = await strategy.validate(basePayload as any);
    expect(result).toBeNull();
  });

  it('returns null when the session is expired', async () => {
    sessions.findByJti.mockResolvedValue({
      id: 'jti-1',
      userId: 7,
      expiresAt: new Date(Date.now() - 60_000),
    });
    const result = await strategy.validate(basePayload as any);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/auth/jwt.strategy.spec.ts`
Expected: FAIL — current `JwtStrategy.validate` does not call `SessionsService`.

- [ ] **Step 3: Commit**

```bash
git add src/auth/jwt.strategy.spec.ts
git commit -m "test(auth): failing tests for JwtStrategy session check"
```

---

## Task 10: JwtStrategy — implementation

**Files:**
- Modify: `src/auth/jwt.strategy.ts`

**Interfaces:** (same as Task 9)

- [ ] **Step 1: Update `JwtStrategy`**

Replace the contents of `src/auth/jwt.strategy.ts` with:

```ts
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionsService } from './sessions/sessions.service';
import { TokenPayload } from './token.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly sessionsService: SessionsService,
  ) {
    const secret = configService.get<string>('app.jwt.secret');
    if (!secret) {
      throw new Error('JWT secret is not configured');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: TokenPayload) {
    const session = await this.sessionsService.findByJti(payload.jti);
    if (!session) {
      return null; // This will cause the strategy to fail with 401
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      return null; // Session exists but is expired
    }
    return {
      id: session.userId,
      email: payload.email,
      jti: payload.jti,
    };
  }
}
```

- [ ] **Step 2: Run the strategy tests**

Run: `npx jest src/auth/jwt.strategy.spec.ts`
Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/auth/jwt.strategy.ts
git commit -m "feat(auth): JwtStrategy consults Session table"
```

---

## Task 11: Import SessionsModule into AuthModule

**Files:**
- Modify: `src/auth/auth.module.ts`

**Interfaces:** makes `SessionsService` injectable into `AuthController` and any other consumers in `AuthModule`.

- [ ] **Step 1: Update `AuthModule`**

Replace the contents of `src/auth/auth.module.ts` with:

```ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LocalStrategy } from './local.strategy';
import { JwtStrategy } from './jwt.strategy';
import { TokenService } from './token.service';
import { PassportModule } from '@nestjs/passport';
import { User } from './users.entity';
import { SessionsModule } from './sessions/sessions.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('app.jwt.secret'),
        signOptions: {},
      }),
    }),
    TypeOrmModule.forFeature([User]),
    SessionsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, JwtStrategy, TokenService],
})
export class AuthModule {}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: still type errors remain in `auth.controller.ts` because it calls `generateAccessToken(loginUser)` with the old single-arg signature. This is fixed in Task 12.

- [ ] **Step 3: Commit**

```bash
git add src/auth/auth.module.ts
git commit -m "feat(auth): import SessionsModule into AuthModule"
```

---

## Task 12: AuthController — wire sessions into login/register/refresh

**Files:**
- Modify: `src/auth/auth.controller.ts`

**Interfaces:**
- New helper: `generateTokenPair(loginUser): Promise<{ accessToken, refreshToken, jti, refreshExpiresAt }>` — generates a random jti, signs both tokens with it, and returns the jti and the refresh-token expiry for the caller to pass to the session service.
- New helper: `getRequestMeta(req): { userAgent, ipAddress }` — wraps `getClientIp` and reads the user-agent header.
- `register` and `login`: after generating the token pair, call `sessionsService.create(...)`.
- `refreshToken`: implement reuse detection; in a TypeORM transaction, delete the old session row by jti and create the new one. The transaction is opened via `sessionsRepository.manager.transaction(...)` — see implementation below.

- [ ] **Step 1: Update `AuthController`**

Replace the contents of `src/auth/auth.controller.ts` with:

```ts
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
import type { Request as ExpressRequest, Response } from 'express';
import { TokenService } from './token.service';
import { LoginUser } from './login-user.interface';
import { AuthService } from './auth.service';
import { User } from './users.entity';
import { SessionsService } from './sessions/sessions.service';
import { getClientIp } from './sessions/client-ip.util';
import { Session } from './sessions/session.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

interface AuthRequest extends ExpressRequest {
  user: LoginUser & { jti: string };
}

interface RegisterDto {
  email: string;
  password: string;
  name?: string;
}

interface RefreshTokenCookie {
  refreshToken?: string;
}

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

  private getRequestMeta(req: ExpressRequest): {
    userAgent: string | null;
    ipAddress: string | null;
  } {
    return {
      userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
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
  async register(@Body() registerDto: RegisterDto, @Req() req: ExpressRequest, @Res() res: Response) {
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
  async refreshToken(@Req() req: ExpressRequest, @Res() res: Response) {
    const refreshToken = (req.cookies as RefreshTokenCookie)?.refreshToken;

    if (!refreshToken) {
      return res
        .status(HttpStatus.UNAUTHORIZED)
        .json({ message: 'Refresh token not provided' });
    }

    let payload;
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
    @Req() req: AuthRequest,
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
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: builds clean.

- [ ] **Step 3: Run the existing service tests (regression check)**

Run: `npx jest src/auth/sessions/sessions.service.spec.ts src/auth/token.service.spec.ts src/auth/jwt.strategy.spec.ts`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/auth/auth.controller.ts
git commit -m "feat(auth): wire session lifecycle into login/register/refresh"
```

---

## Task 13: SessionsController

**Files:**
- Create: `src/auth/sessions/sessions.controller.ts`
- Modify: `src/auth/sessions/sessions.module.ts` — add the controller to `controllers`.

**Interfaces:**
- Routes:
  - `GET /auth/sessions` — list current user's sessions (no body, just the JWT).
  - `DELETE /auth/sessions/:id` — delete one by jti. 204 on success, 404 if not found.
  - `DELETE /auth/sessions` — delete all except current. 204.

- [ ] **Step 1: Create the controller**

Create `src/auth/sessions/sessions.controller.ts`:

```ts
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

interface SessionsAuthRequest extends Request {
  user: { id: number; email: string; jti: string };
}

@Controller('auth/sessions')
@UseGuards(AuthGuard('jwt'))
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  async list(@Req() req: SessionsAuthRequest) {
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
    @Req() req: SessionsAuthRequest,
    @Param('id') id: string,
  ): Promise<void> {
    const ok = await this.sessionsService.deleteByJti(id, req.user.id);
    if (!ok) {
      throw new NotFoundException('Session not found');
    }
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAll(@Req() req: SessionsAuthRequest): Promise<void> {
    await this.sessionsService.deleteAllForUser(req.user.id, req.user.jti);
  }
}
```

- [ ] **Step 2: Add the controller to `SessionsModule`**

Replace the contents of `src/auth/sessions/sessions.module.ts` with:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from './session.entity';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Session])],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: builds clean.

- [ ] **Step 4: Commit**

```bash
git add src/auth/sessions/sessions.controller.ts src/auth/sessions/sessions.module.ts
git commit -m "feat(auth): add session management endpoints"
```

---

## Task 14: E2E test for session-aware validate and rotation

**Files:**
- Modify: `src/auth/auth.controller.spec.ts`

**Interfaces:** exercises the full HTTP stack: register → validate (200) → manually delete session row → validate (401) → refresh → new access token validates 200, old access token 401, replay of old refresh token 401.

- [ ] **Step 1: Replace the existing spec with the extended version**

Replace the contents of `src/auth/auth.controller.spec.ts` with:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthModule } from './auth.module';
import { Session } from './sessions/session.entity';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let sessionsRepository: Repository<Session>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AuthModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    sessionsRepository = moduleFixture.get<Repository<Session>>(
      getRepositoryToken(Session),
    );
  });

  const registerAndGetAccessToken = async (): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'user@example.com', password: 'password123', name: 'U' });
    expect(res.status).toBe(200);
    return res.body.accessToken;
  };

  describe('Validate endpoint', () => {
    it('returns 401 when no token is provided', () => {
      return request(app.getHttpServer()).get('/auth/validate').expect(401);
    });

    it('returns 401 when the token is invalid', () => {
      return request(app.getHttpServer())
        .get('/auth/validate')
        .set('Authorization', 'Bearer not-a-real-token')
        .expect(401);
    });

    it('returns 200 when the access token has a corresponding session', async () => {
      const accessToken = await registerAndGetAccessToken();
      await request(app.getHttpServer())
        .get('/auth/validate')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('returns 401 when the session row has been deleted', async () => {
      const accessToken = await registerAndGetAccessToken();
      await sessionsRepository.clear();
      await request(app.getHttpServer())
        .get('/auth/validate')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
    });
  });

  describe('Refresh token rotation', () => {
    it('returns a new access token and rotates the session', async () => {
      const firstAccessToken = await registerAndGetAccessToken();
      const beforeCount = await sessionsRepository.count();

      // Cookies: the supertest agent handles them across requests.
      const agent = request.agent(app.getHttpServer());
      await agent
        .post('/auth/register')
        .send({ email: 'rot@example.com', password: 'pw1234567', name: 'R' });

      const refreshRes = await agent.post('/auth/refresh-token').expect(200);
      const newAccessToken = refreshRes.body.accessToken;
      expect(newAccessToken).toBeDefined();
      expect(newAccessToken).not.toBe(firstAccessToken);

      // Old token now 401, new token 200.
      await request(app.getHttpServer())
        .get('/auth/validate')
        .set('Authorization', `Bearer ${firstAccessToken}`)
        .expect(401);
      await agent
        .get('/auth/validate')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .expect(200);

      // Session count for the user is still 1.
      const afterCount = await sessionsRepository.count();
      expect(afterCount).toBe(beforeCount + 1);
    });
  });

  afterEach(async () => {
    await app.close();
  });
});
```

Notes:
- The existing e2e uses a real DB via TypeORM. The `clear()` calls in tests are sufficient to isolate them as long as tests run sequentially (Jest default).
- The refresh-token rotation test uses `request.agent` to preserve cookies across requests, which is the realistic flow.
- The "old token 401" check uses a fresh `request(...)` because the cookie is irrelevant — the access token in the header is what matters.

- [ ] **Step 2: Run the e2e tests**

Run: `npx jest src/auth/auth.controller.spec.ts`
Expected: all tests pass.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/auth/auth.controller.spec.ts
git commit -m "test(auth): e2e for session-aware validate and refresh rotation"
```

---

## Task 15: Document the new module in `AGENTS.md`

**Files:**
- Modify: `src/auth/AGENTS.md`

- [ ] **Step 1: Add a new "Sessions" section**

Append the following to `src/auth/AGENTS.md` (after the existing "Notes" section):

```markdown

## Sessions

The `sessions` subdirectory at `src/auth/sessions/` owns the `Session` entity, the `SessionsService`, and the `SessionsController`. A `Session` row is created on `register` and `login`, deleted-and-recreated on `refresh-token`, and may be deleted manually by the user.

### Token binding

Both the access and refresh tokens issued for a session carry the same `jti` claim. The `Session.id` is that `jti` (a uuid). The `TokenService` API takes `jti` as an argument; the controller generates the jti once per pair and passes it to both token-generation calls.

### `/auth/validate`

The JWT strategy consults `SessionsService.findByJti(payload.jti)`. If no row exists, or the row is expired, the strategy returns `null` and the request is rejected with 401. Other services that share the database can call `SessionsService.findByJti` directly; other services without DB access call `GET /auth/validate` over HTTP. The two modes return the same answer.

### Session management endpoints

- `GET /auth/sessions` — list the current user's active sessions.
- `DELETE /auth/sessions/:id` — terminate one session. 404 if not found or not owned.
- `DELETE /auth/sessions` — terminate all sessions except the current one. Log out everywhere-else.

### Refresh-token reuse detection

`/auth/refresh-token` checks `SessionsService.findByJti` for the inbound token's jti. If no row exists but the JWT is otherwise valid, the request is treated as a replay of a previously rotated or revoked refresh token; all sessions for the user are revoked and 401 is returned.

### Session lifetime

`Session.expires_at` matches the refresh-token's `exp` claim (7 days from session creation). When `expires_at` passes, `/auth/validate` returns 401 even if the JWT signature is still valid. The migration adds an index on `expires_at` for a future purge job; this spec does not implement that job.
```

- [ ] **Step 2: Verify the file is well-formed markdown**

Run: any markdown linter available, or simply `cat src/auth/AGENTS.md` to spot-check.
Expected: well-formed.

- [ ] **Step 3: Commit**

```bash
git add src/auth/AGENTS.md
git commit -m "docs(auth): document sessions module in AGENTS.md"
```

---

## Task 16: Final verification

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no new warnings in changed files.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 4: Migration smoke test (requires a running dev DB)**

Run:

```bash
npm run migration:run
```

Expected: the new `session` migration runs successfully. Verify in the database that the `session` table, both indexes, and the FK with `ON DELETE CASCADE` are present.

Then run:

```bash
npm run migration:revert
```

Expected: the migration reverts cleanly.

Then run `npm run migration:run` again to leave the DB in the up state.

- [ ] **Step 5: No commit**

This task is verification only.
