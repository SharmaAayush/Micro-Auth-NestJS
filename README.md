# Micro-Auth

A NestJS 11 authentication microservice. Email and password registration and login, JWT access tokens, rotating refresh tokens in HTTP-only cookies, and a session table for token-reuse detection. PostgreSQL via TypeORM.

This repository contains the auth service only. Other services in the same stack call `GET /auth/validate` over HTTP (or call `SessionsService.findByJti` directly when they share the database) to confirm a Bearer token is still good.

## Quick start

```bash
npm install
cp .env.example .env
# edit .env: set DB_*, JWT_SECRET, and PORT
npm run migration:run
npm run start:dev
```

The server listens on `PORT` (default `3000`). The interactive API docs are at `http://localhost:3000/api/docs` whenever `ENABLE_API_DOCS=true` is set (the default in `.env.example`).

## Scripts

Run with `npm run <name>`.

| Group | Command | What it does |
| --- | --- | --- |
| Run | `start:dev` | Watch mode (TypeScript, hot reload) |
| Run | `start` | One-shot start (no watch) |
| Run | `start:debug` | Start with the Node inspector attached |
| Run | `start:prod` | Run the compiled build in `dist/` (run `build` first) |
| Build | `build` | Compile TypeScript to `dist/` via `nest build` |
| Quality | `lint` | ESLint with auto-fix |
| Quality | `format` | Prettier on `src/` and `test/` |
| Test | `test` | Jest unit tests (matches `src/**/*.spec.ts`) |
| Test | `test:watch` | Jest watch mode |
| Test | `test:cov` | Unit tests with coverage |
| Test | `test:e2e` | Jest end-to-end tests (config under `test/jest-e2e.json`) |
| DB | `typeorm` | Low-level TypeORM CLI pass-through (uses `src/db/typeorm.config.ts`) |
| DB | `migration:create` | Create an empty migration file |
| DB | `migration:generate` | Generate a migration by diffing entities against the DB |
| DB | `migration:run` | Apply all pending migrations |
| DB | `migration:revert` | Revert the most recent applied migration |

The migration commands are run through `ts-node` so the same `DataSource` is shared with the running app. Full runbook: [agents/docs/MIGRATIONS.md](agents/docs/MIGRATIONS.md).

## Project layout

```
src/
  main.ts                       Bootstrap, ValidationPipe, calls setupApiDocs
  app.module.ts                 Root module (Config, TypeORM, Auth, Health, Envelope)
  config/                       Namespaced config (app.port, app.jwt, app.database, app.docs)
  db/
    typeorm.config.ts           Shared TypeORM DataSource (CLI and runtime)
    migrations/                 Versioned migration files
  auth/                         AuthModule (AuthController, AuthService, TokenService,
                                JwtStrategy, LocalStrategy, sessions/ sub-module)
  health/                       HealthModule (liveness and readiness probes)
  docs/                         Swagger UI setup (setupApiDocs; gated by app.docs.enabled)
  common/transform/response/    Global response envelope (EnvelopeModule, interceptor,
                                @SkipEnvelope, @SetMeta)
test/                           End-to-end Jest specs (one per controller)
agents/docs/                    Runbooks (e.g. MIGRATIONS.md)
```

## API surface

All paths are relative to the running server. Endpoints marked **Bearer** require an `Authorization: Bearer <accessToken>` header. Endpoints marked **Cookie** read the `refreshToken` HTTP-only cookie.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/register` | none | Create a user, return access token, set refresh cookie |
| POST | `/auth/login` | none | Authenticate, return access token, set refresh cookie |
| POST | `/auth/refresh-token` | Cookie | Rotate refresh cookie, return new access token |
| GET | `/auth/validate` | Bearer | 200 if access token and session are both valid; 401 otherwise |
| GET | `/auth/sessions` | Bearer | List the current user's active sessions |
| DELETE | `/auth/sessions/:id` | Bearer | Terminate a single session |
| DELETE | `/auth/sessions` | Bearer | Terminate every other session (log out everywhere else) |
| GET | `/health/livez` | none | Liveness probe (process alive) |
| GET | `/health/readyz` | none | Readiness probe (database reachable) |

## Response envelope

By default every successful controller response is wrapped in `{ data: ... }` by the global `EnvelopeInterceptor` (registered in `EnvelopeModule`).

- **Opt out** at the controller class level with `@SkipEnvelope()`. The health controller does this so probes return their raw bodies.
- **Add metadata** at the handler level with `@SetMeta(key, value)`. The metadata is merged in as a `meta` object on the envelope.
- **Errors** thrown via `HttpException` are not wrapped; they go through Nest's default exception filter and keep their `{ message, statusCode, ... }` shape.

This convention is enforced by [AGENTS.md](./AGENTS.md). The envelope interceptor spec at `src/common/transform/response/envelope.interceptor.spec.ts` is the executable description.

## Auth flow overview

- A user registers or logs in and receives an access token in the response body plus a refresh token in an HTTP-only cookie.
- The client sends the access token as `Authorization: Bearer <token>` on subsequent requests.
- The JWT strategy looks up the session row by `jti`. If the row is missing or expired, the request is rejected with 401 even if the JWT signature is still valid.
- To rotate, the client calls `POST /auth/refresh-token` (the browser sends the cookie automatically). The server deletes the old session, creates a new one, and sets a new cookie. The old refresh token can never be used again.
- If a refresh token is presented that no longer has a session row (replay of a previously rotated or revoked token), all sessions for the user are revoked and 401 is returned.

Full details, including the exact cookie attributes: [src/auth/AGENTS.md](src/auth/AGENTS.md).

## Database and migrations

PostgreSQL. The shared `DataSource` at `src/db/typeorm.config.ts` is used by both the running app and the TypeORM CLI. Entities are auto-discovered via a glob; the only registered entities are `User` and `Session`. `synchronize` is off (the migrations are the source of truth).

The `User.id` column is a `uuid`. The `Session.id` is the JWT `jti` (also a `uuid`); `Session.user_id` cascades on user delete. Migrations live in `src/db/migrations/`. The runbook: [agents/docs/MIGRATIONS.md](agents/docs/MIGRATIONS.md). Module contract: [src/db/AGENTS.md](src/db/AGENTS.md).

## API documentation

Swagger UI is served at `/api/docs` when the app is running **and** `ENABLE_API_DOCS=true` is set. The OpenAPI document is built at startup by `SwaggerModule.createDocument` in `src/main.ts` and reflects every `@ApiTags`, `@ApiOperation`, `@ApiResponse`, and `@ApiProperty` decorator on the controllers and DTOs.

The toggle exists so production builds can ship without the docs route exposed. `src/main.ts` skips the entire `DocumentBuilder` / `SwaggerModule.setup` block when the flag is off, so no `swagger-ui-express` handler is registered. `.env.example` sets `ENABLE_API_DOCS=true` so local development still has the UI by default.

Authorizing requests from the UI:

- For Bearer-protected routes, click **Authorize** at the top, paste an access token into the `bearer` field.
- For the refresh-token route, the browser sends the cookie automatically; the Swagger UI does not need a separate auth step.

## Environment variables

All variables are read by `src/config/configuration.ts` and exposed under the `app.*` namespace.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Port the HTTP server listens on |
| `DOMAIN` | (unset) | Cookie `domain` in production only |
| `JWT_SECRET` | `your-secret-key` | HMAC secret for signing access and refresh tokens |
| `JWT_ACCESS_TOKEN_EXPIRES_IN` | `15m` | Access-token TTL |
| `JWT_REFRESH_TOKEN_EXPIRES_IN` | `7d` | Refresh-token TTL and session lifetime |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USERNAME` | — | PostgreSQL user |
| `DB_PASSWORD` | — | PostgreSQL password |
| `DB_DATABASE` | — | PostgreSQL database name |
| `DB_SYNCHRONIZE` | `false` | DANGER: enable only for ephemeral dev databases |
| `DB_LOGGING` | (unset) | TypeORM SQL logging |
| `ENABLE_API_DOCS` | (unset, treated as `false`) | When `true`, serve the Swagger UI at `/api/docs`. Leave unset or `false` in production. |

## Conventions

Project-wide role, code standards, and the response-envelope contract: [AGENTS.md](./AGENTS.md).
