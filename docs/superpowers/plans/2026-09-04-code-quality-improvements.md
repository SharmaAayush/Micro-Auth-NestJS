# Code Quality Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply a bundle of small, code-quality cleanups to the auth module (DTOs/validation, response envelope, uuid PK, DRY token verification, type reuse, refresh-expiry source-of-truth) without adding product functionality.

**Architecture:** Each task is a self-contained, independently testable change. The plan orders tasks so the codebase compiles and tests pass after every commit. Tasks 1-8 are pure refactors / new files that don't touch the DB schema. Task 9 is the only schema-touching step (the user PK migration) and is last so existing tests have a green starting point. Within the non-schema tasks: Task 1 installs dependencies, Tasks 2-3 add DTOs and the global ValidationPipe, Task 4 extracts shared request types, Task 5 collapses the duplicate token-verification methods and adds `getExpiryFromToken`, Task 6 uses the real JWT expiry and dedupes `getRequestMeta`, Task 7 adds the response-envelope interceptor, Task 8 updates the e2e tests for the envelope.

**Tech Stack:** NestJS 11 (Express adapter), TypeORM 1.1, PostgreSQL, class-validator, class-transformer, Jest, supertest, @nestjs/jwt.

**Spec:** [docs/superpowers/specs/2026-09-04-code-quality-improvements-design.md](../specs/2026-09-04-code-quality-improvements-design.md)

## Global Constraints

- All TypeScript code in the repo, no JS files.
- Constructor injection only — never `new Service()`.
- `class-validator` decorators are added to DTO classes only; TypeORM entities are NOT decorated for validation.
- `class-validator`, `class-transformer`, and `reflect-metadata` are peer-deps of `@nestjs/common` and may already be available transitively; install explicitly.
- All env config continues to be read via `ConfigService` (no new abstraction layer).
- Each task ends with `npm test` passing and a commit.
- Plan file ends with the implementation plan; no spec drift.
- Default test command: `npm test` (Jest unit + integration; e2e via `npm run test:e2e` when a task's deliverable is an e2e test).

---

## Task 1: Add class-validator + class-transformer dependencies

**Files:**
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing
- Produces: `node_modules/class-validator` and `node_modules/class-transformer` available; `import 'class-validator'` and `import 'class-transformer'` resolve.

- [ ] **Step 1: Verify class-validator is already a transitive dep**

Run: `npm ls class-validator class-transformer 2>&1 | head -20`
Expected: Either shows installed versions, or "empty" if not installed. If installed transitively at a version >= 0.14, no install needed. If `class-validator` is missing entirely, install.

- [ ] **Step 2: Install if missing**

If `npm ls class-validator` shows "empty", run:
```bash
npm install --save class-validator class-transformer
```

Pin to the version `@nestjs/common@11` ships against. The current peer is `^0.14.0` for class-validator and `^0.5.1` for class-transformer. If a version mismatch shows up after install, downgrade to match what `@nestjs/common`'s peerDependencies field lists — do not bump `@nestjs/common`.

- [ ] **Step 3: Verify import resolves**

Create a temporary scratch file `src/auth/dto/.scratch.ts`:
```ts
import { IsEmail } from 'class-validator';
console.log(IsEmail);
```
Then run: `npx tsc --noEmit`
Expected: exit code 0, no errors. Delete the scratch file:
```bash
rm src/auth/dto/.scratch.ts
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add class-validator and class-transformer"
```

---

## Task 2: Add LoginDto and RegisterDto

**Files:**
- Create: `src/auth/dto/login.dto.ts`
- Create: `src/auth/dto/register.dto.ts`
- Test: `src/auth/dto/login.dto.spec.ts`
- Test: `src/auth/dto/register.dto.spec.ts`

**Interfaces:**
- Consumes: `class-validator` decorators.
- Produces: `LoginDto` and `RegisterDto` classes that `ValidationPipe({ transform: true })` can validate against.

- [ ] **Step 1: Write failing test for LoginDto**

`src/auth/dto/login.dto.spec.ts`:
```ts
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { LoginDto } from './login.dto';

describe('LoginDto', () => {
  it('accepts a valid payload', async () => {
    const dto = plainToInstance(LoginDto, { email: 'a@b.c', password: 'pw' });
    const errors = await validate(dto);
    expect(errors).toEqual([]);
  });

  it('rejects a non-email email', async () => {
    const dto = plainToInstance(LoginDto, { email: 'not-an-email', password: 'pw' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('email');
  });

  it('rejects a missing password', async () => {
    const dto = plainToInstance(LoginDto, { email: 'a@b.c' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('password');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/auth/dto/login.dto.spec.ts`
Expected: FAIL — `LoginDto` not defined.

- [ ] **Step 3: Write LoginDto**

`src/auth/dto/login.dto.ts`:
```ts
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/auth/dto/login.dto.spec.ts`
Expected: 3 passing.

- [ ] **Step 5: Write failing test for RegisterDto**

`src/auth/dto/register.dto.spec.ts`:
```ts
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RegisterDto } from './register.dto';

describe('RegisterDto', () => {
  it('accepts a valid payload with name', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'a@b.c',
      password: 'longenough',
      name: 'Alice',
    });
    const errors = await validate(dto);
    expect(errors).toEqual([]);
  });

  it('accepts a valid payload without name', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'a@b.c',
      password: 'longenough',
    });
    const errors = await validate(dto);
    expect(errors).toEqual([]);
  });

  it('rejects a short password', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'a@b.c',
      password: 'short',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('rejects a too-long name', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'a@b.c',
      password: 'longenough',
      name: 'x'.repeat(200),
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx jest src/auth/dto/register.dto.spec.ts`
Expected: FAIL — `RegisterDto` not defined.

- [ ] **Step 7: Write RegisterDto**

`src/auth/dto/register.dto.ts`:
```ts
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx jest src/auth/dto/register.dto.spec.ts`
Expected: 4 passing.

- [ ] **Step 9: Run full unit suite**

Run: `npm test`
Expected: all previously passing tests still pass; the two new specs pass.

- [ ] **Step 10: Commit**

```bash
git add src/auth/dto
git commit -m "feat(auth): add LoginDto and RegisterDto with class-validator"
```

---

## Task 3: Wire ValidationPipe and apply DTOs to controllers

**Files:**
- Modify: `src/main.ts`
- Modify: `src/auth/auth.controller.ts` (lines 94-119 register; 185-205 login)
- Modify: `test/auth.e2e-spec.ts`

**Interfaces:**
- Consumes: `LoginDto`, `RegisterDto` from Task 2.
- Produces: a `ValidationPipe` globally applied; `auth/register` and `auth/login` annotate `@Body()` with DTO types. The e2e tests assert validation works.

- [ ] **Step 1: Write a failing e2e test for validation rejection**

Add to `test/auth.e2e-spec.ts`, inside the top-level `describe`, a new `describe` block above the existing ones:
```ts
describe('Input validation', () => {
  it('rejects a register request with a short password (400)', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'a@b.c', password: 'short', name: 'X' })
      .expect(400);
  });

  it('rejects a register request with a non-email email (400)', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'not-an-email', password: 'longenough', name: 'X' })
      .expect(400);
  });

  it('rejects a register request with unknown fields (400)', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'a@b.c', password: 'longenough', name: 'X', extra: 1 })
      .expect(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:e2e -- --testPathPattern=auth.e2e-spec -t "Input validation"`
Expected: FAIL — currently the body is accepted and a 200 (register) is returned. The `400` assertion fails.

- [ ] **Step 3: Enable ValidationPipe in main.ts**

Modify `src/main.ts`:
```ts
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 3000);
  await app.listen(port);
}
bootstrap().catch((err) => {
  console.error(err);
});
```

- [ ] **Step 4: Annotate register and login in auth.controller.ts**

In `src/auth/auth.controller.ts`:
- Add at the top: `import { RegisterDto } from './dto/register.dto';` and `import { LoginDto } from './dto/login.dto';`
- The `register` method already has `@Body() registerDto: RegisterDto` typed inline. Update the inline `RegisterDto` to a named import reference by removing the inline `RegisterDto` interface declaration from `auth.controller.ts` (it is currently defined at the top of the file) and importing the class instead.
- Update the `login` method's parameters to:
```ts
async login(
  @Body() _loginDto: LoginDto,
  @Req() req: AuthRequest,
  @Res() res: Response,
) { ... }
```

- [ ] **Step 5: Run e2e tests to verify the new validation tests pass**

Run: `npm run test:e2e -- --testPathPattern=auth.e2e-spec -t "Input validation"`
Expected: 3 passing.

- [ ] **Step 6: Run the full e2e suite**

Run: `npm run test:e2e`
Expected: all previously passing tests still pass; the 3 new validation tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/main.ts src/auth/auth.controller.ts test/auth.e2e-spec.ts
git commit -m "feat(auth): wire global ValidationPipe and apply DTOs to auth routes"
```

---

## Task 4: Extract shared request types and remove per-controller duplicates

**Files:**
- Create: `src/auth/types.ts`
- Modify: `src/auth/auth.controller.ts`
- Modify: `src/auth/sessions/sessions.controller.ts`
- Modify: `src/auth/login-user.interface.ts` (no change to behavior; comment only)

**Interfaces:**
- Consumes: nothing new.
- Produces: `RequestUser` and `RequestMeta` interfaces exported from `src/auth/types.ts`. The local `AuthRequest`, `SessionsAuthRequest`, `RefreshTokenCookie`, and inline `RegisterDto` interfaces are removed.

- [ ] **Step 1: Write a failing TypeScript test that asserts the types compile**

`src/auth/types.spec.ts`:
```ts
import type { RequestUser, RequestMeta } from './types';

describe('auth types', () => {
  it('RequestUser can be constructed with id, email, jti', () => {
    const u: RequestUser = { id: 7, email: 'a@b.c', jti: 'jti-1' };
    expect(u.id).toBeDefined();
  });

  it('RequestMeta can be constructed', () => {
    const m: RequestMeta = { userAgent: 'ua', ipAddress: '1.2.3.4' };
    expect(m.userAgent).toBe('ua');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/auth/types.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the types file**

`src/auth/types.ts`:
```ts
export interface RequestUser {
  id: number;
  email: string;
  jti: string;
}

export interface RequestMeta {
  userAgent: string | null;
  ipAddress: string | null;
}
```

`RequestUser.id` is `number` here because the user PK is still `SERIAL` at this point in the plan. Task 9 widens both the entity and this interface to `string`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/auth/types.spec.ts`
Expected: 2 passing.

- [ ] **Step 5: Update auth.controller.ts to use RequestUser**

In `src/auth/auth.controller.ts`:
- Add `import { RequestUser, RequestMeta } from './types';` (the `Request as ExpressRequest` import already exists).
- Remove the `AuthRequest` interface block.
- Remove the `RefreshTokenCookie` interface block.
- Replace the `AuthRequest` reference in `login` with `Request & { user: LoginUser }`. The local strategy returns a `LoginUser` (id, email, name) without `jti`; the controller generates `jti` after this point. Do NOT type `req.user` with `jti` here — that field doesn't exist yet at this point in the flow.
```ts
async login(
  @Body() _loginDto: LoginDto,
  @Req() req: Request & { user: LoginUser },
  @Res() res: Response,
) { ... }
```
- Replace the cookie access in `refreshToken` with:
```ts
const refreshToken = (req as Request & { cookies: Record<string, string | undefined> }).cookies?.refreshToken;
```

- [ ] **Step 6: Update sessions.controller.ts to use RequestUser**

In `src/auth/sessions/sessions.controller.ts`:
- Add `import { RequestUser } from '../types';`
- Remove the `SessionsAuthRequest` interface.
- Replace `req: SessionsAuthRequest` with `req: Request & { user: RequestUser }` everywhere.

- [ ] **Step 7: Run full unit suite**

Run: `npm test`
Expected: all tests pass. `RequestUser.id: number` matches the entity at this point. Run `npx tsc --noEmit` to confirm no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/auth/types.ts src/auth/types.spec.ts src/auth/auth.controller.ts src/auth/sessions/sessions.controller.ts
git commit -m "refactor(auth): extract shared RequestUser and RequestMeta types"
```

---

## Task 5: DRY token verification and add getExpiryFromToken

**Files:**
- Modify: `src/auth/token.service.ts`
- Modify: `test/auth/token.service.spec.ts` (add tests for `getExpiryFromToken`)

**Interfaces:**
- Consumes: nothing new.
- Produces: `TokenService.verify(token, kind)`, `verifyAccessToken(token)`, `verifyRefreshToken(token)` (unchanged public API), and a new public `getExpiryFromToken(jwt: string): Date`.

- [ ] **Step 1: Write failing test for getExpiryFromToken**

Add to `test/auth/token.service.spec.ts` at the bottom:
```ts
describe('getExpiryFromToken', () => {
  it('returns the Date corresponding to the exp claim', () => {
    // exp is in seconds. 1700000000 seconds = 2023-11-14T22:13:20Z.
    const jwt = `header.${Buffer.from(
      JSON.stringify({ exp: 1700000000, sub: '7', email: 'a@b.c', jti: 'j' }),
    ).toString('base64url')}.sig`;
    const result = service.getExpiryFromToken(jwt);
    expect(result.toISOString()).toBe('2023-11-14T22:13:20.000Z');
  });

  it('throws when the token is unparseable', () => {
    expect(() => service.getExpiryFromToken('not-a-jwt')).toThrow(
      /missing the exp claim/,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/auth/token.service.spec.ts -t "getExpiryFromToken"`
Expected: FAIL — `getExpiryFromToken` is not a function.

- [ ] **Step 3: Refactor token.service.ts**

Replace the entire body of `src/auth/token.service.ts` (after the `TokenPayload` interface) with:
```ts
import { Injectable } from '@nestjs/common';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { LoginUser } from './login-user.interface';

export interface TokenPayload {
  email: string;
  sub: string;
  jti: string;
  exp?: number;
  iat?: number;
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

  getExpiryFromToken(jwt: string): Date {
    const payload = this.jwtService.decode(jwt) as TokenPayload | null;
    if (!payload?.exp) {
      throw new Error('Refresh token is missing the exp claim');
    }
    return new Date(payload.exp * 1000);
  }

  private async verify(token: string, kind: 'access' | 'refresh'): Promise<TokenPayload> {
    try {
      return await this.jwtService.verifyAsync<TokenPayload>(token, {
        secret: this.configService.get<string>('app.jwt.secret'),
      });
    } catch {
      throw new Error(`Invalid or expired ${kind} token`);
    }
  }

  verifyAccessToken(token: string): Promise<TokenPayload> {
    return this.verify(token, 'access');
  }

  verifyRefreshToken(token: string): Promise<TokenPayload> {
    return this.verify(token, 'refresh');
  }
}
```

- [ ] **Step 4: Run token.service.spec.ts to verify all tests pass**

Run: `npx jest test/auth/token.service.spec.ts`
Expected: 4 tests passing (2 original + 2 new).

- [ ] **Step 5: Run the full unit suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/auth/token.service.ts test/auth/token.service.spec.ts
git commit -m "refactor(auth): DRY token verification and add getExpiryFromToken"
```

---

## Task 6: Use real JWT expiry for Session.expires_at and fix getRequestMeta double-call

**Files:**
- Modify: `src/auth/auth.controller.ts`

**Interfaces:**
- Consumes: `TokenService.getExpiryFromToken` from Task 5.
- Produces: `generateTokenPair` derives `refreshExpiresAt` from the actual refresh JWT; `refreshToken` calls `getRequestMeta` once.

- [ ] **Step 1: Write a controller unit test that asserts generateTokenPair uses the real expiry**

There is no existing `auth.controller.spec.ts`. Create `src/auth/auth.controller.spec.ts`:
```ts
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionsService } from './sessions/sessions.service';
import { TokenService } from './token.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Session } from './sessions/session.entity';
import { User } from './users.entity';

describe('AuthController.generateTokenPair', () => {
  let controller: AuthController;
  let tokenService: { generateAccessToken: jest.Mock; generateRefreshToken: jest.Mock; getExpiryFromToken: jest.Mock };
  let sessionsService: { create: jest.Mock };

  beforeEach(async () => {
    tokenService = {
      generateAccessToken: jest.fn().mockResolvedValue('access.jwt'),
      generateRefreshToken: jest.fn().mockResolvedValue('refresh.jwt'),
      getExpiryFromToken: jest.fn().mockReturnValue(new Date('2030-01-01T00:00:00Z')),
    };
    sessionsService = { create: jest.fn().mockResolvedValue(undefined) };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: {} },
        { provide: SessionsService, useValue: sessionsService },
        { provide: TokenService, useValue: tokenService },
        { provide: getRepositoryToken(Session), useValue: {} },
        { provide: getRepositoryToken(User), useValue: {} },
      ],
    }).compile();
    controller = module.get<AuthController>(AuthController);
  });

  it('uses getExpiryFromToken(refreshToken) for refreshExpiresAt', async () => {
    const user: User = { id: 7, email: 'a@b.c', password: 'h', name: 'A' } as User;
    const res = await controller['generateTokenPair']({
      id: 7,
      email: 'a@b.c',
      name: 'A',
    });
    expect(tokenService.getExpiryFromToken).toHaveBeenCalledWith('refresh.jwt');
    expect(res.refreshExpiresAt.toISOString()).toBe('2030-01-01T00:00:00.000Z');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/auth/auth.controller.spec.ts`
Expected: FAIL — `generateTokenPair` does not exist as a callable method on the controller (it is private; bracket-access works, but the implementation hard-codes the expiry, so the `getExpiryFromToken` mock is not invoked). The assertion `expect(tokenService.getExpiryFromToken).toHaveBeenCalledWith('refresh.jwt')` fails.

- [ ] **Step 3: Update generateTokenPair in auth.controller.ts**

Replace the `generateTokenPair` method in `src/auth/auth.controller.ts` with:
```ts
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
```

- [ ] **Step 4: Run controller test to verify it passes**

Run: `npx jest src/auth/auth.controller.spec.ts`
Expected: 1 passing.

- [ ] **Step 5: Fix the getRequestMeta double-call in refreshToken**

In `src/auth/auth.controller.ts`, in the `refreshToken` method, the current code calls `this.getRequestMeta(req)` twice inside the transaction. Replace:
```ts
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
```
with:
```ts
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
```

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/auth/auth.controller.ts src/auth/auth.controller.spec.ts
git commit -m "refactor(auth): source Session.expires_at from JWT and dedupe getRequestMeta"
```

---

## Task 7: Add response envelope interceptor and SkipEnvelope decorator

**Files:**
- Create: `src/common/transform/response/skip-envelope.decorator.ts`
- Create: `src/common/transform/response/set-meta.decorator.ts`
- Create: `src/common/transform/response/envelope.interceptor.ts`
- Create: `src/common/transform/response/envelope.module.ts`
- Modify: `src/app.module.ts`
- Modify: `src/health/health.controller.ts`
- Test: `src/common/transform/response/envelope.interceptor.spec.ts`

**Interfaces:**
- Consumes: NestJS `Reflector`, `APP_INTERCEPTOR`, `SetMetadata`.
- Produces: `@SkipEnvelope()`, `@SetMeta(meta)`, `EnvelopeInterceptor`, `EnvelopeModule` (registered globally).

- [ ] **Step 1: Write failing test for the interceptor**

`src/common/transform/response/envelope.interceptor.spec.ts`:
```ts
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, throwError, lastValueFrom } from 'rxjs';
import { EnvelopeInterceptor } from './envelope.interceptor';
import { SKIP_ENVELOPE_KEY } from './skip-envelope.decorator';
import { SET_META_KEY } from './set-meta.decorator';

const buildInterceptor = (handlerMeta: Record<string, unknown> = {}, classMeta: Record<string, unknown> = {}): {
  interceptor: EnvelopeInterceptor;
  context: ExecutionContext;
} => {
  const reflector = new Reflector();
  jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
    if (key === SKIP_ENVELOPE_KEY) return handlerMeta.skip ?? classMeta.skip;
    if (key === SET_META_KEY) return handlerMeta.meta ?? classMeta.meta;
    return undefined;
  });
  const context = {
    getHandler: () => handlerMeta,
    getClass: () => classMeta,
    switchToHttp: () => ({}),
    switchToRpc: () => ({}),
    switchToWs: () => ({}),
    getArgs: () => [],
    getArgByIndex: () => undefined,
    getRequest: () => undefined,
    getResponse: () => undefined,
    getNext: () => undefined,
  } as unknown as ExecutionContext;
  return { interceptor: new EnvelopeInterceptor(reflector), context };
};

describe('EnvelopeInterceptor', () => {
  it('wraps a value in { data }', async () => {
    const { interceptor, context } = buildInterceptor();
    const result = await lastValueFrom(
      interceptor.intercept(context, { handle: () => of({ accessToken: 'x' }) } as CallHandler).pipe(),
    );
    expect(result).toEqual({ data: { accessToken: 'x' } });
  });

  it('merges meta when @SetMeta is applied', async () => {
    const { interceptor, context } = buildInterceptor({ meta: { requestId: 'r1' } });
    const result = await lastValueFrom(
      interceptor.intercept(context, { handle: () => of('hello') } as CallHandler).pipe(),
    );
    expect(result).toEqual({ data: 'hello', meta: { requestId: 'r1' } });
  });

  it('returns the original value when @SkipEnvelope is set', async () => {
    const { interceptor, context } = buildInterceptor({ skip: true });
    const result = await lastValueFrom(
      interceptor.intercept(context, { handle: () => of({ status: 'alive' }) } as CallHandler).pipe(),
    );
    expect(result).toEqual({ status: 'alive' });
  });

  it('propagates errors from the handler unchanged', async () => {
    const { interceptor, context } = buildInterceptor();
    const observable = interceptor.intercept(context, {
      handle: () => throwError(() => new Error('boom')),
    } as CallHandler);
    await expect(lastValueFrom(observable)).rejects.toThrow('boom');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/common/transform/response/envelope.interceptor.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the SkipEnvelope decorator**

`src/common/transform/response/skip-envelope.decorator.ts`:
```ts
import { SetMetadata } from '@nestjs/common';

export const SKIP_ENVELOPE_KEY = 'skipEnvelope';
export const SkipEnvelope = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SKIP_ENVELOPE_KEY, true);
```

- [ ] **Step 4: Create the SetMeta decorator**

`src/common/transform/response/set-meta.decorator.ts`:
```ts
import { SetMetadata } from '@nestjs/common';

export const SET_META_KEY = 'setMeta';
export const SetMeta = (meta: Record<string, unknown>): MethodDecorator =>
  SetMetadata(SET_META_KEY, meta);
```

- [ ] **Step 5: Create the interceptor**

`src/common/transform/response/envelope.interceptor.ts`:
```ts
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SKIP_ENVELOPE_KEY } from './skip-envelope.decorator';
import { SET_META_KEY } from './set-meta.decorator';

@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_ENVELOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) {
      return next.handle();
    }
    return next.handle().pipe(
      map((value) => {
        const meta = this.reflector.getAllAndOverride<Record<string, unknown> | undefined>(
          SET_META_KEY,
          [context.getHandler(), context.getClass()],
        );
        return meta ? { data: value, meta } : { data: value };
      }),
    );
  }
}
```

- [ ] **Step 6: Create the module**

`src/common/transform/response/envelope.module.ts`:
```ts
import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { EnvelopeInterceptor } from './envelope.interceptor';

@Global()
@Module({
  providers: [
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
  ],
})
export class EnvelopeModule {}
```

- [ ] **Step 7: Run interceptor test to verify it passes**

Run: `npx jest src/common/transform/response/envelope.interceptor.spec.ts`
Expected: 4 passing.

- [ ] **Step 8: Wire EnvelopeModule into AppModule and decorate HealthController**

In `src/app.module.ts`, add the import and to the `imports` array:
```ts
import { EnvelopeModule } from './common/transform/response/envelope.module';
// ...
imports: [
  // ... existing imports ...
  EnvelopeModule,
],
```

In `src/health/health.controller.ts`:
- Add `import { SkipEnvelope } from '../common/transform/response/skip-envelope.decorator';`
- Add `@SkipEnvelope()` directly above `@Controller('health')`.

- [ ] **Step 9: Run the full unit suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 10: Commit**

```bash
git add src/common src/app.module.ts src/health/health.controller.ts
git commit -m "feat(common): add response envelope interceptor with @SkipEnvelope opt-out"
```

---

## Task 8: Update e2e tests for the envelope and add health-controller e2e coverage

**Files:**
- Modify: `test/auth.e2e-spec.ts`
- Modify: `test/app.e2e-spec.ts`
- Create: `test/health.e2e-spec.ts` (or add to `app.e2e-spec.ts`)

**Interfaces:**
- Consumes: `EnvelopeInterceptor` from Task 7.
- Produces: e2e tests that assert `{ data: ... }` envelope on auth/sessions routes, and a raw-body assertion on `/health/livez`.

- [ ] **Step 1: Update auth.e2e-spec.ts to read from `body.data`**

In `test/auth.e2e-spec.ts`, change every `res.body.accessToken` to `res.body.data.accessToken`. The two lines that change are:
- `return res.body.accessToken;` → `return res.body.data.accessToken;`
- `const newAccessToken = refreshRes.body.accessToken;` → `const newAccessToken = refreshRes.body.data.accessToken;`

- [ ] **Step 2: Add a session-list envelope test to auth.e2e-spec.ts**

Add a new `describe` block at the bottom of the file (above the `afterEach`):
```ts
describe('Session listing envelope', () => {
  it('GET /auth/sessions returns the array inside data', async () => {
    const agent = request.agent(app.getHttpServer());
    const reg = await agent
      .post('/auth/register')
      .send({ email: 'env@example.com', password: 'pw1234567', name: 'E' });
    const accessToken = reg.body.data.accessToken;
    const list = await agent
      .get('/auth/sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(Array.isArray(list.body.data)).toBe(true);
    expect(list.body.data.length).toBe(1);
  });
});
```

- [ ] **Step 3: Add a health-controller e2e test**

Create `test/health.e2e-spec.ts`:
```ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('HealthController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('GET /health/livez returns the raw body (no envelope)', async () => {
    const res = await request(app.getHttpServer()).get('/health/livez').expect(200);
    expect(res.body).toEqual({ status: 'alive' });
    expect(res.body.data).toBeUndefined();
  });

  afterEach(async () => {
    await app.close();
  });
});
```

- [ ] **Step 4: Run the full e2e suite**

Run: `npm run test:e2e`
Expected: all tests pass. The auth e2e tests now see `res.body.data.accessToken`; the health test confirms `@SkipEnvelope()` works.

- [ ] **Step 5: Commit**

```bash
git add test/auth.e2e-spec.ts test/health.e2e-spec.ts
git commit -m "test(e2e): update for response envelope and add health controller coverage"
```

---

## Task 9: Convert user primary key from serial to uuid

**Files:**
- Create: `src/db/migrations/<timestamp>-ConvertUserIdToUuid.ts`
- Modify: `src/auth/users.entity.ts`
- Modify: `src/auth/sessions/session.entity.ts`
- Modify: `src/auth/login-user.interface.ts` (id type widens to string)
- Modify: `src/auth/auth.service.ts` (no behavior change; type widens)
- Modify: `src/auth/auth.controller.ts` (no behavior change; type widens)
- Modify: `src/auth/jwt.strategy.ts` (type widens)
- Modify: `src/auth/sessions/sessions.service.ts` (type widens)
- Modify: `src/auth/sessions/sessions.controller.ts` (type widens)
- Modify: `src/auth/types.ts` (id type widens)
- Modify: `src/auth/jwt.strategy.spec.ts` (id assertion widens)
- Modify: `src/auth/sessions/sessions.service.spec.ts` (userId widens)
- Modify: `src/auth/auth.controller.spec.ts` (id type widens)
- Modify: `test/auth.e2e-spec.ts` (numeric comparisons become string comparisons if any)

**Interfaces:**
- Consumes: FK constraint names discovered at write-time; `gen_random_uuid()` available on the database.
- Produces: `user.id` is a uuid string; `session.user_id` is a uuid string; all consumer types reflect this.

- [ ] **Step 1: Discover FK and PK constraint names against the dev database**

Run, capturing the actual names:
```bash
psql "$DATABASE_URL" -c "SELECT conname FROM pg_constraint WHERE conrelid = 'session'::regclass AND contype = 'f' AND pg_get_constraintdef(oid) LIKE '%user%';"
psql "$DATABASE_URL" -c "SELECT conname FROM pg_constraint WHERE conrelid = 'user'::regclass AND contype = 'p';"
psql "$DATABASE_URL" -c "SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'gen_random_uuid');"
```

Note the FK name (e.g. `FK_<hash>`), the PK name (`PK_cace4a159ff9f2512dd42373760`), and whether `gen_random_uuid` is available. Substitute into the migration file in the next step.

- [ ] **Step 2: Write the migration**

Create `src/db/migrations/<TIMESTAMP>-ConvertUserIdToUuid.ts` where `<TIMESTAMP>` is a 13-digit epoch millisecond timestamp matching the existing migration files (e.g. `1788439874712`). The filename **must** end in a numeric timestamp — the `migration:run` command orders migrations by it. The class name **must** match the suffix of the filename: `ConvertUserIdToUuid<TIMESTAMP>`. Substitute the actual timestamp everywhere. The skeleton below uses `XXXX` for the timestamp; replace each instance:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConvertUserIdToUuidXXXX implements MigrationInterface {
  name = 'ConvertUserIdToUuidXXXX';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add the new uuid column to user, populated for every row.
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN "id_uuid" uuid NOT NULL DEFAULT gen_random_uuid()`,
    );

    // 2. Drop the FK from session -> user so we can change the user_id type.
    await queryRunner.query(
      `ALTER TABLE "session" DROP CONSTRAINT "<FK_NAME>"`,
    );

    // 3. Repoint session.user_id to the new uuid (mandatory for any DB with rows).
    await queryRunner.query(
      `UPDATE "session" s SET "user_id" = u."id_uuid"::text FROM "user" u WHERE u."id" = s."user_id"::integer`,
    );

    // 4. Change the column type to uuid.
    await queryRunner.query(
      `ALTER TABLE "session" ALTER COLUMN "user_id" TYPE uuid USING user_id::uuid`,
    );

    // 5. Drop the old PK, the old id column, rename id_uuid, re-add the PK.
    await queryRunner.query(
      `ALTER TABLE "user" DROP CONSTRAINT "<PK_NAME>"`,
    );
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "id"`);
    await queryRunner.query(`ALTER TABLE "user" RENAME COLUMN "id_uuid" TO "id"`);
    await queryRunner.query(`ALTER TABLE "user" ADD PRIMARY KEY ("id")`);

    // 6. Re-add the FK with the new column type.
    await queryRunner.query(
      `ALTER TABLE "session" ADD CONSTRAINT "<FK_NAME>" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop the FK.
    await queryRunner.query(
      `ALTER TABLE "session" DROP CONSTRAINT "<FK_NAME>"`,
    );

    // 2. Add back the integer id column.
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN "id_old" SERIAL NOT NULL`,
    );

    // 3. Cast session.user_id back to text so we can drop the FK-free path.
    await queryRunner.query(
      `ALTER TABLE "session" ALTER COLUMN "user_id" TYPE text USING user_id::text`,
    );

    // 4. Drop the uuid PK, drop the id column, rename id_old, re-add the integer PK.
    await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "<PK_NAME>"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "id"`);
    await queryRunner.query(`ALTER TABLE "user" RENAME COLUMN "id_old" TO "id"`);
    await queryRunner.query(`ALTER TABLE "user" ADD PRIMARY KEY ("id")`);

    // 5. Cast session.user_id back to integer (regenerate; original ids are lost).
    await queryRunner.query(
      `ALTER TABLE "session" ALTER COLUMN "user_id" TYPE integer USING 0`,
    );

    // 6. Re-add the FK (pointing at the new integer id).
    await queryRunner.query(
      `ALTER TABLE "session" ADD CONSTRAINT "<FK_NAME>" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE`,
    );
  }
}
```

Replace `<FK_NAME>` and `<PK_NAME>` with the values from Step 1. If `gen_random_uuid` is not available, replace it with `uuid_generate_v4()` and add `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` at the top of `up()`.

- [ ] **Step 3: Run the migration against the dev database**

Run: `npm run migration:run`
Expected: all 6 steps succeed. Verify with:
```sql
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'user' AND column_name = 'id';
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'session' AND column_name = 'user_id';
```
Both should report `uuid`.

- [ ] **Step 4: Update the User entity**

In `src/auth/users.entity.ts`, change:
```ts
@PrimaryGeneratedColumn()
id!: number;
```
to:
```ts
@PrimaryGeneratedColumn('uuid')
id!: string;
```

- [ ] **Step 5: Update the Session entity**

In `src/auth/sessions/session.entity.ts`, change:
```ts
@Column({ name: 'user_id', type: 'integer' })
userId!: number;
```
to:
```ts
@Column({ name: 'user_id', type: 'uuid' })
userId!: string;
```

- [ ] **Step 6: Widen id types in TS**

- `src/auth/login-user.interface.ts` — change `id: number;` to `id: string;`.
- `src/auth/types.ts` — change `id: number;` to `id: string;` in `RequestUser`. `RequestMeta` is unchanged.
- `src/auth/sessions/sessions.service.ts` — change `userId: number` parameter types to `userId: string` in `create`, `listForUser`, `deleteByJti`, `deleteAllForUser`.
- `src/auth/jwt.strategy.ts` — the `validate()` return type already widens via `id: session.userId`; confirm `tsc` accepts it.
- `src/auth/auth.controller.ts` — `loginUser.id` and `user.id` are now strings; no other changes needed.
- `src/auth/auth.service.ts` — no behavior change; `User.id` widens via the entity.

- [ ] **Step 7: Update jwt.strategy.spec.ts**

In `src/auth/jwt.strategy.spec.ts`, change the test setup to use uuid-shaped strings:
```ts
const basePayload = { sub: '7', email: 'a@b.c', jti: 'jti-1' };

it('returns the user when a non-expired session exists', async () => {
  sessions.findByJti.mockResolvedValue({
    id: 'jti-1',
    userId: '00000000-0000-0000-0000-000000000000',
    expiresAt: new Date(Date.now() + 60_000),
  });
  const result = await strategy.validate(basePayload);
  expect(result).toEqual({
    id: '00000000-0000-0000-0000-000000000000',
    email: 'a@b.c',
    jti: 'jti-1',
  });
});
```

Update the expired-session test similarly.

- [ ] **Step 8: Update sessions.service.spec.ts**

In `src/auth/sessions/sessions.service.spec.ts`, change every `userId: 42` to `userId: '00000000-0000-0000-0000-000000000042'` and every literal `42` argument to the same string. There are roughly 8 such substitutions across the file.

- [ ] **Step 9: Update auth.controller.spec.ts**

In `src/auth/auth.controller.spec.ts`, change `id: 7` to `id: '7'` and the user fixture to `{ id: '7', email: 'a@b.c', password: 'h', name: 'A' } as User`.

- [ ] **Step 10: Run the unit suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 11: Run the e2e suite**

Run: `npm run test:e2e`
Expected: all tests pass.

- [ ] **Step 12: Verify TypeORM metadata is in sync**

Run:
```bash
npm run typeorm -- schema:log
```

Expected: no diff between the entity metadata and the database. If TypeORM reports a diff, **stop and report** — the migration did not produce a schema matching the entity, which is a bug to fix in the migration, not by adding a second migration. Do not generate a "sync" migration; do not commit anything.

- [ ] **Step 13: Commit**

```bash
git add src/db/migrations src/auth test
git commit -m "feat(db): convert user.id to uuid, widen id types across the auth module"
```

---

## Task 10: Final verification

**Files:** none modified

- [ ] **Step 1: Run the full test suite end-to-end**

Run:
```bash
npm test
npm run test:e2e
```

Expected: all unit and e2e tests pass.

- [ ] **Step 2: Run the linter**

Run: `npm run lint`
Expected: no errors. If lint errors appear, fix them; do not commit `--no-verify`.

- [ ] **Step 3: Run the build**

Run: `npm run build`
Expected: clean compile, no TypeScript errors.

- [ ] **Step 4: Verify the spec is fully covered**

Cross-check each spec section against the tasks. Every spec section ("Migration plan", "Type changes", "Type reuse", "DRY token verification", "Hard-coded refresh expiry", "getRequestMeta double-call", "Validation", "Response envelope", "Error handling", "Testing") maps to at least one task. The migration plan is Task 9; type changes are Tasks 4 + 9; type reuse is Task 4; DRY verification is Task 5; hard-coded expiry is Task 6; getRequestMeta double-call is Task 6; validation is Tasks 2 + 3; response envelope is Task 7; error handling is Task 7; testing is Tasks 2-8.

- [ ] **Step 5: Update AGENTS.md if needed**

If any new file conventions emerged (e.g. `src/common/transform/response/` for cross-cutting interceptors), append a short note to `src/auth/AGENTS.md` or `AGENTS.md`. Skip if no new convention was introduced.

- [ ] **Step 6: Final commit (if AGENTS.md was updated)**

```bash
git add AGENTS.md src/auth/AGENTS.md
git commit -m "docs(agents): note response envelope module location"
```

(If no docs change, skip this commit.)
