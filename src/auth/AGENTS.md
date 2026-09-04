# Authentication Module

This area contains the authentication infrastructure for the NestJS application.

## Role

Handles user registration, login, JWT token generation/validation, and refresh token management via HTTP-only cookies.

## Conventions

- **Entity**: `users.entity.ts` defines the User TypeORM entity with a BeforeInsert hook to hash passwords using bcrypt.
- **DTO/Interface**: `login-user.interface.ts` provides the `LoginUser` interface (id, email, name) used for token payloads and returning user data without password.
- **Service**: `auth.service.ts` provides methods for user lookup, validation, and creation (password hashing delegated to entity hook).
- **Token Service**: `token.service.ts` handles access and refresh token generation and verification using `@nestjs/jwt`, with configuration from `ConfigService`.
- **Strategy**: `local.strategy.ts` implements PassportJS local strategy with email as username field, delegating validation to `AuthService`.
- **Module**: `auth.module.ts` imports:
  * `PassportModule`
  * `JwtModule.registerAsync` with `ConfigService` for dynamic secret
  * `TypeOrmModule.forFeature([User])`
  * Controllers: `AuthController`
  * Providers: `AuthService`, `LocalStrategy`, `TokenService`
- **Controller**: `auth.controller.ts` implements:
  * `POST /auth/register`: creates user, generates token pair, sets refresh token as HTTP-only cookie, returns access token
  * `POST /auth/login`: uses local guard, generates token pair, sets refresh token cookie, returns access token
  * `POST /auth/refresh-token`: validates refresh token from cookie, issues new token pair, updates cookie
- **Cookie Settings**: Refresh tokens stored in HTTP-only cookies with:
  * `sameSite`: 'none' in production (requires secure), 'lax' in development
  * `secure`: true in production
  * `path`: '/'
  * `maxAge`: 7 days
  * `domain`: set from `process.env.DOMAIN` in production, omitted in development
- **Environment Variables**: JWT secrets and expiration times configured via `src/config/configuration.ts` under `app.jwt.*`.
- **Nest CLI**: Use `nest g service auth`, `nest g module auth`, etc. for generation.

## Notes

- The AuthModule is imported in `AppModule` but is not marked `@Global()` (consider adding `@Global()` if needed across multiple modules).
- Password hashing occurs via a BeforeInsert hook in the User entity (not shown in service but assumed).

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

## Response envelope

`EnvelopeModule` lives in `src/common/transform/response/` and is `@Global()`. Every successful controller response is wrapped in `{ data: ... }` by default via the global `EnvelopeInterceptor`. Use `@SkipEnvelope()` on a controller class to opt out (current example: `HealthController`). Use `@SetMeta(key, value)` on a handler to merge extra fields into the envelope as a `meta` object.