# Auth Sessions — Design

**Date:** 2026-09-03
**Status:** Approved (pending user review)
**Scope:** Add a `Session` table to the auth module, bind JWT token pairs to sessions via the `jti` claim, make `/auth/validate` meaningful (200 if a valid session exists, 401 if the session has been terminated), and expose session-management endpoints so users can see and revoke their active devices.

## Background and motivation

The auth controller today issues JWT access/refresh pairs on `register`, `login`, and `refresh-token`, and exposes a `GET /auth/validate` endpoint protected by the JWT strategy. The endpoint exists, but it answers a narrow question — "is this JWT signature valid?" — and not the one other services actually need to ask: "is the user who holds this token still allowed to use it?"

Today, a leaked access token is valid until its 15-minute expiry with no way to revoke it; a leaked refresh token is valid until its 7-day expiry with no way to revoke it. The only "logout" mechanism is waiting for tokens to expire.

This spec adds an active-session model so we can answer "is this token still authorized?" in O(1) and let users revoke individual devices.

## Goals

- `GET /auth/validate` returns 200 only when a `Session` row exists for the token's `jti`; otherwise 401.
- Users can see their active sessions and revoke individual ones.
- Refresh-token rotation deletes the old session and creates a new one atomically.
- A leaked refresh token that is replayed after rotation triggers a defense that revokes all sessions for that user.
- The hot-path lookup is a single indexed row read (`findByJti`), so a future Redis cache-aside layer is a wrapper, not a redesign.

## Non-goals

- Redis caching of session lookups. The interface is shaped to allow it; the implementation is DB-only.
- A "log out this device too" endpoint. Users terminate the current device by waiting for the access token to expire (15 minutes) or by clearing cookies client-side.
- Background purging of expired session rows. The migration adds an index on `expires_at`; a future cron job can purge. Out of scope here.
- Parsing of the `user_agent` string into a friendly device name. The raw string is stored; future work can parse it.
- Rate limiting on login / refresh-token / register.
- Notification to the user when reuse-detection revokes their sessions.

## Design

### Data model

New entity `Session` in `src/auth/sessions/session.entity.ts`:

| Column       | Type             | Notes                                                                                       |
| ------------ | ---------------- | ------------------------------------------------------------------------------------------- |
| `id`         | uuid PK          | Same value as `payload.jti` in both the access and refresh tokens of this session.          |
| `user_id`    | int FK → user.id | Indexed. `ON DELETE CASCADE` so deleting a user cleans up.                                  |
| `user_agent` | varchar nullable | Raw `User-Agent` header from the request that created the session.                         |
| `ip_address` | varchar nullable | Client IP, resolved with `x-forwarded-for` only if behind a known proxy.                    |
| `created_at` | timestamptz      | Set once at creation.                                                                       |
| `expires_at` | timestamptz      | Set to the same instant as the refresh token's `exp` (now + 7d).                            |

Indexes:

- Primary key on `id` (also the jti lookup).
- `(user_id)` for the list-my-sessions query.
- `(expires_at)` for the future purge job.

### Module structure

New module at `src/auth/sessions/`:

- `session.entity.ts` — TypeORM entity.
- `sessions.module.ts` — `TypeOrmModule.forFeature([Session])`, providers: `SessionsService`. Imports: nothing new.
- `sessions.service.ts` — pure data access + business rules. No HTTP, no JWT.
- `sessions.controller.ts` — thin HTTP layer for `GET /auth/sessions`, `DELETE /auth/sessions/:id`, `DELETE /auth/sessions`.

`AuthModule` imports `SessionsModule` so `AuthService`, `AuthController`, and `JwtStrategy` can inject `SessionsService`. The `Session` entity is registered once, in `SessionsModule`.

`SessionsService` public surface:

```
create(userId, jti, { userAgent, ipAddress }, expiresAt): Promise<Session>
findByJti(jti): Promise<Session | null>          // hot path
listForUser(userId): Promise<Session[]>
deleteByJti(jti, userId): Promise<boolean>       // false if not found or not owned
deleteAllForUser(userId, exceptJti?): Promise<number>
```

### Token changes

Both the access and refresh tokens gain a `jti` claim. A token pair issued for a given session shares the same jti.

`TokenService` is reshaped so the caller (the controller) generates the jti once and passes it to both `generateAccessToken(user, jti)` and `generateRefreshToken(user, jti)`. This keeps the "one jti per pair" invariant in one place.

`TokenPayload` gains `jti: string`.

### `/auth/validate` semantics

The `JwtStrategy.validate(payload)` becomes:

```ts
const session = await this.sessionsService.findByJti(payload.jti);
if (!session) return null;                         // 401
if (session.expires_at.getTime() <= Date.now()) return null;  // 401
return { id: session.user_id, email: payload.email, jti: payload.jti };
```

`GET /auth/validate` with `AuthGuard('jwt')` returns 200 with no body when the session is valid, 401 otherwise. The handler stays empty; the guard does the work. Other services get the same 200/401 contract whether they call this endpoint or query the table directly.

### Login / register

`POST /auth/register` and `POST /auth/login`:

1. Verify credentials (login only; register creates the user).
2. Generate a jti in the controller.
3. Generate the access/refresh token pair using that jti.
4. Set the refresh-token cookie (unchanged).
5. `await sessionsService.create(user.id, jti, { userAgent, ipAddress }, refreshExpiresAt)`.

If the `create` call fails after the tokens have been issued, the user sees a 500. The tokens are unusable for `/auth/validate` (no session row), and the next login attempt will succeed normally. We accept this small window rather than introducing a transaction across the JWT signing step.

### Refresh-token rotation with reuse detection

`POST /auth/refresh-token`:

1. Read `refreshToken` from cookie. Missing → 401.
2. Verify the refresh JWT. Bad signature or expired → 401.
3. **Reuse-detection check.** Call `sessionsService.findByJti(payload.jti)`:
   - If a row exists: this is the legitimate rotation. Continue.
   - If no row exists but the JWT is otherwise valid: this is a replay of a previously rotated (or revoked) refresh token. Revoke all sessions for this user (`deleteAllForUser(userId)`) and return 401. Do not issue new tokens.
4. Find the user by `payload.email`. Not found → 401.
5. Generate a new jti, issue a new token pair, set the new cookie.
6. In a TypeORM transaction: delete the old session row by the old jti, then `create(user.id, newJti, { userAgent, ipAddress }, newRefreshExpiresAt)`.
7. Return the new access token in the body.

If the transaction's `create` step fails, the user is logged out. This is preferable to leaving the old session in place, since the refresh token has already been rotated client-side and re-using it would not produce a valid pair anyway.

### Cookie behavior

Unchanged. Same name (`refreshToken`), same options builder, same `sameSite`/`secure` logic. The cookie's `maxAge` resets to 7 days on each rotation, as today.

### Session lifetime

`Session.expires_at` is set to the same instant as the refresh token's `exp` (now + 7 days). The two clocks are aligned on purpose — a session's "real" lifetime is bounded by its refresh token.

### Session management endpoints

- `GET /auth/sessions` — `AuthGuard('jwt')`. Returns the current user's `Session[]` ordered by `created_at` desc. Each row: `{ id, userAgent, ipAddress, createdAt, expiresAt }`.
- `DELETE /auth/sessions/:id` — `AuthGuard('jwt')`. Calls `deleteByJti(id, req.user.id)`. Returns 204 on success, 404 if not found or not owned by the current user.
- `DELETE /auth/sessions` — `AuthGuard('jwt')`. Calls `deleteAllForUser(req.user.id, exceptJti = req.user.jti)`. Returns 204. Logs out everywhere except the current device.

### Migration

New migration in `src/db/migrations/<timestamp>-create-sessions.ts`. `up` creates the `session` table with the columns, indexes, and `ON DELETE CASCADE` FK to `user(id)`. `down` drops the table. The migration does **not** backfill sessions for already-issued tokens — any access tokens in flight at deploy time will return 401 from `/auth/validate` because their `jti` has no row. The access-token lifetime is 15 minutes, so the disruption window is bounded.

### Client IP resolution

A small helper `getClientIp(req)` reads `x-forwarded-for` (first hop) and falls back to `req.ip` and then `req.socket.remoteAddress`. The "behind a known proxy" condition is left as a config flag (`TRUST_PROXY`) for the future; the spec uses the simple form. The helper lives in `src/auth/sessions/client-ip.util.ts` and is the only place that touches the request object's IP fields.

## Files

New:
- `src/auth/sessions/session.entity.ts`
- `src/auth/sessions/sessions.module.ts`
- `src/auth/sessions/sessions.service.ts`
- `src/auth/sessions/sessions.controller.ts`
- `src/auth/sessions/client-ip.util.ts`
- `src/auth/sessions/sessions.service.spec.ts`
- `src/db/migrations/<timestamp>-create-sessions.ts`

Modified:
- `src/auth/auth.module.ts` — import `SessionsModule`.
- `src/auth/auth.controller.ts` — wire session create/delete into login/register/refresh; route refresh through reuse detection; widen `generateTokenPair` to also return jti + refresh expiry.
- `src/auth/token.service.ts` — accept `jti` as a parameter on both `generateAccessToken` and `generateRefreshToken`; add `jti` to `TokenPayload`.
- `src/auth/jwt.strategy.ts` — inject `SessionsService`; `validate()` checks the session row.
- `src/auth/AGENTS.md` — document the new module, the jti claim, the `/auth/sessions` routes, and the validate semantics.
- `src/auth/auth.controller.spec.ts` — extend e2e to cover session-aware validate, rotation, reuse detection, and the new management routes.

## Testing

Three layers:

1. **Unit tests for `SessionsService`** — mocked `Repository<Session>`. Cover: `create` returns the persisted row, `findByJti` returns null when missing, `deleteByJti` returns false when not found or not owned, `deleteAllForUser` honors `exceptJti`.
2. **Unit test for `JwtStrategy.validate`** — mocked `SessionsService`. Cover: returns the user when the session exists, returns null when no session, returns null when the session is expired.
3. **e2e (`auth.controller.spec.ts`)** — extend, don't rewrite. New cases:
   - `POST /auth/register` → `GET /auth/validate` with the returned access token → 200.
   - `POST /auth/login` → manually delete the session row → access token then 401 on validate.
   - `POST /auth/refresh-token` → new access token validates 200, old access token validates 401.
   - Replay the old refresh token after rotation → 401 + all sessions for that user are gone.
   - `GET /auth/sessions` lists the current user's sessions; `DELETE /auth/sessions/:id` removes the matching one; `DELETE /auth/sessions` removes all except the current.

## Manual / smoke verification

- `npm run build` — types compile.
- `npm run lint` — no new warnings in changed files.
- `npm test` — full suite green.
- `npm run migration:run` against a dev DB — table exists, FK + cascade present, indexes present.
- `npm run migration:revert` — drops cleanly.
- Hand-curl: register → validate (200) → list sessions (1 row) → delete session → validate with same access token (401) → refresh (401).

## Risks and mitigations

| Risk                                                                 | Mitigation                                                                                                          |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Migration backfill gap breaks in-flight tokens on deploy.            | Documented; 15-minute window; callout in release notes.                                                             |
| `findByJti` on every authenticated request is a hot-path DB hit.    | Future Redis cache-aside; interface already a single method to wrap.                                                |
| Transaction on refresh adds latency.                                | Single round-trip in practice; acceptable for an auth endpoint that's not on the per-request hot path.              |
| Reuse-detection nukes all sessions on stolen-refresh replay.        | Intentional; standard hardening. Users re-authenticate but no persistent damage.                                    |
| Other services coupling to `Session` schema.                        | `/auth/validate` is the published contract; recommend they use it, not the table.                                   |
