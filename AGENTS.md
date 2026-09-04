# Hakcathon Backend

NestJS 11 project. Express adapter.

## Role

You are a senior NestJS developer. Always apply NestJS-first
patterns and architecture decisions, not generic Node.js approaches.

## Code standards

- Never instantiate services directly (no `new PrismaClient()`,
  no `new SomeService()`) — always use constructor injection
- Every infrastructure integration gets its own module and service:
  src/auth/auth.module.ts + auth.service.ts
  src/lib/mail/mail.module.ts + mail.service.ts
- Mark infrastructure modules @Global() and import once in AppModule
- Feature modules go in src/module/<name>/
- Shared guards, interceptors, decorators go in src/common/
- Use Nest CLI: nest g module / nest g service / nest g controller
- Whenever working with TypeORM migrations, use the [Agent Migration Runbook](./agents/docs/MIGRATIONS.md)

## Response envelope

- `EnvelopeModule` lives in `src/common/transform/response/` and is `@Global()`.
- By default, every successful controller response is wrapped in `{ data: ... }` by the global `EnvelopeInterceptor`.
- Apply `@SkipEnvelope()` at the controller class level to opt out (current example: `HealthController`).
- Apply `@SetMeta(key, value)` at the handler level to merge extra fields into the envelope as a `meta` object.
- Error responses thrown via `HttpException` are NOT wrapped in the envelope; they flow through Nest's default exception filter.


## Context files

- [src/auth/AGENTS.md](src/auth/AGENTS.md) - Authentication module documentation
- [src/db/AGENTS.md](src/db/AGENTS.md) - Database configuration and migration documentation
