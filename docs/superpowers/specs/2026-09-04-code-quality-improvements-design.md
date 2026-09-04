# Code Quality Improvements — Design

**Date:** 2026-09-04
**Status:** Approved (pending user review)
**Scope:** A bundle of small, well-scoped cleanups across the auth module and a new shared response-envelope system. No new product functionality.

## Background and motivation

The current codebase has accumulated a few rough edges that slow future work:

- The user table exposes a sequential integer `id` as the user identifier in JWTs, in DTOs, and in session ownership. Sequential ids are trivially guessable and a small privacy/security concern.
- `AuthController.generateTokenPair` hard-codes a 7-day refresh-token expiry even though `JWT_REFRESH_TOKEN_EXPIRES_IN` is environment-configurable. Drift is inevitable.
- `verifyAccessToken` and `verifyRefreshToken` in `TokenService` are line-for-line duplicates with a single different string in the error message.
- `AuthController.refreshToken` calls `getRequestMeta(req)` twice in a row.
- Three ad-hoc request-type interfaces (`AuthRequest`, `SessionsAuthRequest`, `RefreshTokenCookie`) and one inline `RegisterDto` repeat shapes that are already defined elsewhere.
- The API has no standard response envelope; every controller hand-rolls its own return shape.
- API request DTOs and DB entities are not validated with `class-validator`. Bad input is caught ad-hoc or not at all.

This spec addresses each item with the smallest change that fixes it. No new product surface.

## Goals

- Switch the user primary key from `SERIAL` to `uuid`, preserving existing data via a backfill migration.
- Source `Session.expires_at` from the refresh JWT's actual `exp` claim — single source of truth.
- Collapse `verifyAccessToken` / `verifyRefreshToken` to a single private helper.
- Store `getRequestMeta(req)` once per request in `refreshToken`.
- Extract shared request types into a single `src/auth/types.ts` and drop the per-controller duplicates.
- Add `class-validator` + `class-transformer` and a global `ValidationPipe`. Validate request DTOs.
- Add a global response-envelope interceptor that wraps successful responses as `{ data, meta? }`. Add a `@SkipEnvelope()` decorator and apply it to `GET /health`.
- Keep `LocalStrategy` as the source of truth for `/auth/login`'s password check.

## Non-goals

- Schema changes to anything other than `user.id` and the resulting `session.user_id` type.
- A new `externalId` column. The uuid PK replaces it.
- Standardising error-response shapes. Errors still flow through NestJS's stock exception filter; only success responses get the envelope.
- Pagination, sort, or filter improvements to `GET /auth/sessions`.
- New `class-validator` decorators on the `User` or `Session` TypeORM entities.
- Redis or other cache layer.
- Renaming `LoginUser.id` to `LoginUser.userId` (we keep the field name; the type widens from `number` to `string`).

## Architecture

### File layout

```
src/
  auth/
    types.ts                                 # NEW: RequestUser, RequestMeta
    dto/
      register.dto.ts                        # NEW
      login.dto.ts                           # NEW
    auth.controller.ts                       # MODIFIED
    auth.service.ts                          # MODIFIED (createUser signature: id becomes string)
    auth.module.ts                           # MODIFIED (no provider changes)
    users.entity.ts                          # MODIFIED (id type)
    token.service.ts                         # MODIFIED
    jwt.strategy.ts                          # MODIFIED (id type)
    local.strategy.ts                        # UNCHANGED
    sessions/
      session.entity.ts                      # MODIFIED (userId type)
      sessions.service.ts                    # MODIFIED (id types)
      sessions.controller.ts                 # MODIFIED (uses RequestUser)
  common/
    transform/
      response/
        envelope.interceptor.ts              # NEW (types live inline in this file)
        envelope.module.ts                   # NEW
        skip-envelope.decorator.ts           # NEW
        set-meta.decorator.ts                # NEW
  db/
    migrations/
      17879...-CreateSessions.ts             # UNCHANGED
      <new-timestamp>-ConvertUserIdToUuid.ts # NEW
  app.module.ts                              # MODIFIED (register EnvelopeModule)
  main.ts                                    # MODIFIED (ValidationPipe)
  health/
    health.controller.ts                     # MODIFIED (@SkipEnvelope on the class)
test/
  auth.e2e-spec.ts                           # MODIFIED (envelope assertions)
  common/transform/response/
    envelope.interceptor.spec.ts             # NEW
  auth/
    token.service.spec.ts                    # MODIFIED (still passes)
```

### Migration plan (real DB with data)

A single new migration `<timestamp>-ConvertUserIdToUuid.ts`. The FK constraint name and column names are determined by querying the DB schema at write-time (`information_schema`). The exact names go into the spec at write-time; the structure is:

`up()`:

1. `ALTER TABLE "user" ADD COLUMN "id_uuid" uuid NOT NULL DEFAULT gen_random_uuid();` — every existing row gets a fresh uuid in `id_uuid`. The original integer `id` column is untouched.
2. `ALTER TABLE "session" DROP CONSTRAINT "<FK_session_user_id>";` — name resolved via `information_schema.referential_constraints`. (Required before we can change the `user_id` column type.)
3. Repoint `session.user_id` from the old integer `user.id` to the new `user.id_uuid`. This step is **mandatory for any DB with existing session rows**:
   ```sql
   UPDATE "session" s
   SET "user_id" = u."id_uuid"::text
   FROM "user" u
   WHERE u."id" = s."user_id"::integer;
   ```
   (`u."id" = s."user_id"::integer` works because we haven't dropped the old integer id yet.)
4. `ALTER TABLE "session" ALTER COLUMN "user_id" TYPE uuid USING user_id::uuid;``
5. `ALTER TABLE "user" DROP CONSTRAINT "PK_cace4a159ff9f2512dd42373760";` — name resolved via `information_schema.table_constraints`.
6. `ALTER TABLE "user" DROP COLUMN "id";`
7. `ALTER TABLE "user" RENAME COLUMN "id_uuid" TO "id";`
8. `ALTER TABLE "user" ADD PRIMARY KEY ("id");`
9. `ALTER TABLE "session" ADD CONSTRAINT "<FK_session_user_id>" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;`

`down()`: reverse each step in order, using `gen_random_uuid()` to repopulate the dropped `id` column with placeholder integer ids if the down is run on a real DB. Document that the `down()` does not preserve original integer ids — it generates new serials.

**FK discovery at migration-write time** (before writing the file, the implementer must run):

```sql
SELECT conname FROM pg_constraint
WHERE conrelid = 'session'::regclass
  AND contype = 'f'
  AND pg_get_constraintdef(oid) LIKE '%user%';
```

and:

```sql
SELECT conname FROM pg_constraint
WHERE conrelid = 'user'::regclass
  AND contype = 'p';
```

The implementer pastes the actual names into the migration file.

**Migration assumption:** `pgcrypto` (or Postgres 13+) is available so `gen_random_uuid()` works. If it isn't, the migration uses `uuid_generate_v4()` from `uuid-ossp` and adds the extension in step 0: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`. The implementer checks for `gen_random_uuid()` availability via a `SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'gen_random_uuid');` query at write time and chooses the right one.

### Type changes

`User.id: number → string`. Every consumer updated:

- `auth.service.ts` — `createUser` return type stays `User`; no internal logic depends on `id` being numeric.
- `auth.controller.ts` — `LoginUser.id` is already a number; the controller builds `LoginUser` from `user.id` directly, so the type widens automatically. No code change beyond type inference.
- `jwt.strategy.ts` — `validate()` returns `{ id: session.userId, ... }`. `session.userId` is now a string. The return type widens.
- `sessions/session.entity.ts` — `userId: number → string`. `ManyToOne` join still works.
- `sessions/sessions.service.ts` — `userId: number` in method signatures → `string`. No behaviour change.
- `sessions/sessions.controller.ts` — `req.user.id: number` → `string`. No code change.
- `RequestUser.id: number → string` (see next section).

### Type reuse

New file `src/auth/types.ts`:

```ts
export interface RequestUser {
  id: string;          // user uuid, post-migration
  email: string;
  jti: string;         // session id
}

export interface RequestMeta {
  userAgent: string | null;
  ipAddress: string | null;
}
```

Removed:

- `AuthController.AuthRequest` — replaced with `Request & { user: RequestUser }`. The controller already has the request's `user` populated by the local strategy as `{ email, name, id, jti }` (the local strategy's validate returns the result of `authService.validateUser` with the password stripped; the `jti` field is added in the `login` controller method from the freshly generated jti). Going forward the `jti` is part of the user object before it ever hits `req.user`, so the request type simplifies.
- `SessionsController.SessionsAuthRequest` — replaced with `Request & { user: RequestUser }`. Same shape, one name.
- `AuthController.RefreshTokenCookie` — replaced by `Request & { cookies: Record<string, string | undefined> }` cast in one place. Cookie name remains a string literal at the call site.

Decision: **keep `LoginUser` distinct from `RequestUser`**. `LoginUser` is the JWT-payload-shaped object (no `jti`); `RequestUser` is the request-scoped object (with `jti`). Conflating them causes confusion when we later want to put a `LoginUser` into a token without a `jti`.

### DRY token verification

`TokenService`:

```ts
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
```

Public API unchanged. Existing tests pass without modification.

### Hard-coded refresh expiry

`TokenService` gains a private helper that decodes the JWT payload (no signature check — we just signed it) and returns the `exp` claim as a `Date`:

```ts
private decodeExpiry(jwt: string): Date {
  const payload = this.jwtService.decode(jwt) as TokenPayload | null;
  if (!payload?.exp) {
    throw new Error('Refresh token is missing the exp claim');
  }
  return new Date(payload.exp * 1000);
}
```

`AuthController.generateTokenPair` becomes:

```ts
const [accessToken, refreshToken] = await Promise.all([
  this.tokenService.generateAccessToken(loginUser, jti),
  this.tokenService.generateRefreshToken(loginUser, jti),
]);
const refreshExpiresAt = this.tokenService.getExpiryFromToken(refreshToken);
return { accessToken, refreshToken, jti, refreshExpiresAt };
```

`getExpiryFromToken` is a **public** method on `TokenService`. Public rationale: a unit test of `AuthController.generateTokenPair` should be able to mock it directly. Bracket-accessed private members force test-time casting. The public API reads: `getExpiryFromToken` decodes an unverified JWT to read its `exp` claim; `verifyAccessToken`/`verifyRefreshToken` verify the signature and return the payload. The two are clearly different.

### `getRequestMeta` double-call

`AuthController.refreshToken`:

```ts
const requestMeta = this.getRequestMeta(req);
// ... use requestMeta in the transaction ...
```

One constant, two uses.

### Validation

`class-validator` and `class-transformer` are added to `package.json` dependencies.

DTOs:

```ts
// src/auth/dto/register.dto.ts
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

// src/auth/dto/login.dto.ts
export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}
```

`main.ts`:

```ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
);
```

Controllers annotate `@Body()`:

```ts
@Post('register')
async register(@Body() registerDto: RegisterDto, ...) { ... }

@Post('login')
async login(
  @Body() _loginDto: LoginDto,
  @Req() req: Request & { user: RequestUser },
  @Res() res: Response,
) { ... }
// _loginDto is declared to trigger validation; passport-local then re-reads req.body
```

`LocalStrategy` is unchanged. `passport-local` re-extracts `(email, password)` from the validated `req.body` and passes them as primitives.

### Response envelope

`src/common/transform/response/envelope.interceptor.ts`:

```ts
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

`@SkipEnvelope()`:

```ts
export const SKIP_ENVELOPE_KEY = 'skipEnvelope';
export const SkipEnvelope = () => SetMetadata(SKIP_ENVELOPE_KEY, true);
```

`@SetMeta()`:

```ts
export const SET_META_KEY = 'setMeta';
export const SetMeta = (meta: Record<string, unknown>) => SetMetadata(SET_META_KEY, meta);
```

`EnvelopeModule`:

```ts
@Global()
@Module({
  providers: [
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
  ],
})
export class EnvelopeModule {}
```

Wired in `AppModule.imports`. `health.controller.ts` is decorated with `@SkipEnvelope()` at the class level.

### Error handling

Errors are **not** wrapped. The interceptor's `next.handle()` returns an observable that errors on exceptions. The `map` operator only fires on `next`, not on `error`, so the exception passes through to NestJS's exception filter untouched. This is verified by an interceptor unit test that throws from a fake handler and asserts the error reaches the test's `error` callback.

## Testing

### Existing tests

- `token.service.spec.ts` — public API unchanged; passes without modification.
- `jwt.strategy.spec.ts` — the strategy's `validate()` returns `{ id: session.userId, ... }`. After the PK switch, `session.userId` is a string. The existing test creates a session with `userId: 7` (number). The mock setup is updated so `userId: '7'` (a uuid-shaped string, just kept as a string for fixture clarity), and the assertion becomes `expect(result).toEqual({ id: '7', email: 'a@b.c', jti: 'jti-1' })`.
- `sessions.service.spec.ts` — `userId: 42` becomes `userId: 'uuid-string'` everywhere. The `userId` type widens.
- `auth.e2e-spec.ts` — assertions on `res.body.accessToken` become `res.body.data.accessToken`.

### New tests

- `envelope.interceptor.spec.ts`:
  - Wraps a plain value in `{ data: ... }`.
  - Merges `meta` from `@SetMeta()`.
  - Returns the original value when `@SkipEnvelope()` is set.
  - Does not wrap thrown errors (errors propagate to the consumer's `error` callback).
- New e2e: `GET /health` returns the raw body (no envelope). `GET /auth/sessions` after a successful login returns `res.body.data` as an array. `POST /auth/register` with a malformed body returns 400 with the standard NestJS error shape (no envelope on errors).

## Migration order (implementation)

1. `class-validator` + `class-transformer` added; `ValidationPipe` enabled; DTOs introduced; controllers annotated. Tests updated for DTOs.
2. `RequestUser` / `RequestMeta` extracted; per-controller interfaces removed; consumers updated.
3. `TokenService.verify` collapsed; tests still pass.
4. `TokenService.getExpiryFromToken` added; `generateTokenPair` uses it; `getRequestMeta` double-call fixed in `refreshToken`.
5. `EnvelopeInterceptor`, `@SkipEnvelope()`, `@SetMeta()`, `EnvelopeModule` added; `health.controller.ts` decorated; `AppModule` imports the module. New interceptor unit test. Existing e2e tests updated for the envelope.
6. Migration `<timestamp>-ConvertUserIdToUuid.ts` written and run. `User.id`, `Session.userId`, `RequestUser.id`, `LoginUser.id` types widen. All tests updated.

Each step compiles and the existing test suite passes before moving to the next. No step is optional.

## Risks and mitigations

- **Migration FK discovery** — the FK constraint name is database-generated. The implementer queries `information_schema` at write-time and pastes the actual name. Documented in the migration runbook cross-link.
- **Migration down()** — does not preserve original integer ids. Documented; down() is for dev only.
- **`LocalStrategy` body access** — the DTO is a class instance after `ValidationPipe`. `passport-local` reads `req.body` by field name and works on plain object literals or class instances identically. No risk.
- **Envelope + cookies** — `POST /auth/refresh-token` sets a `Set-Cookie` header on the response and returns the access token in the body. The interceptor wraps the body only, headers are untouched. Verified by the existing refresh-token e2e test once assertions are updated.
- **Errors via interceptor** — `Observable.pipe(map(...))` does not catch errors. We confirm with the unit test that `Observable.subscribe({ error })` sees the original error.
