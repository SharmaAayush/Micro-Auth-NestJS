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

- [CONTEXT.md](./CONTEXT.md) - Domain glossary and architecture decisions
- [src/auth/AGENTS.md](src/auth/AGENTS.md) - Authentication module documentation
- [src/db/AGENTS.md](src/db/AGENTS.md) - Database configuration and migration documentation
- [docs/adr/0001-session-based-jwt-revocation.md](./docs/adr/0001-session-based-jwt-revocation.md) - ADR for session-based JWT revocation

## Agent skills

### Issue tracker

Issues and specs for this repo live as GitHub issues. Use the `gh` CLI for all operations. See `docs/agents/issue-tracker.md`.

### Triage labels

The skills speak in terms of five canonical triage roles. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (one `CONTEXT.md` + `docs/adr/` at repo root). See `docs/agents/domain.md`.
