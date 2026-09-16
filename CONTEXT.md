# Micro-Auth Context

The single-source glossary for domain concepts used across this NestJS authentication microservice.

## Key Concepts

### Access Token
A short-lived (15 minutes by default) JWT signed with the server's `JWT_SECRET`. Sent in the `Authorization: Bearer <token>` header on authenticated requests. The access token contains a `jti` claim that references a Session row for revocation checking.

### Refresh Token
A longer-lived (7 days by default) JWT used only to obtain new access tokens. Stored in an HTTP-only cookie named `refreshToken`. The `jti` claim in the refresh token references the same Session row as the corresponding access token.

### Session
A database record representing an authenticated user's login session. The Session's `id` column is the JWT `jti`. Each Session has a `userId` (FK to User), `userAgent`, `ipAddress`, `createdAt`, and `expiresAt`. The Session record enables token revocation, session listing ("show my active devices"), and refresh-token reuse detection.

### JTI (JWT ID)
A unique identifier embedded in both access and refresh tokens for a session pair. The Session's primary key is the `jti`, enabling O(1) lookups for token validation and revocation. When a refresh token is rotated, a new Session row is created with a new `jti`.

### Reuse Detection
A security mechanism that detects when a refresh token is presented after it has been rotated. The system checks if the `jti` in the refresh token exists in the Sessions table. If no row exists but the JWT signature is valid, this indicates a leaked token was replayed. In response, **all** sessions for that user are revoked.

### Refresh Token Rotation
The process of issuing a new refresh token on each `POST /auth/refresh-token` call. The old Session row is deleted and a new one is created atomically. This invalidates the old refresh token and binds the new token to a new Session.

### LoginUser
An interface representing user data extracted from a Session during JWT validation. Contains `id` (user's UUID), `email`, and `name`. This is the "authenticated user" passed to routes after JWT validation.

### Response Envelope
The global `{ data: <value> }` wrapper applied to all successful HTTP responses by the `EnvelopeInterceptor`. Applied via `APP_INTERCEPTOR` as a global provider. Opt out per-controller with `@SkipEnvelope()`. Add metadata with `@SetMeta()`.

## Related Types

### TokenPayload
The JWT payload structure: `{ email, sub, jti, exp, iat }`. The `sub` is the user's UUID, `jti` is the session ID. Returned by `jwt.decode()` for token introspection.

### RequestUser
The user context attached to `req.user` after JWT validation: `{ id, email, jti }`. Differs from `LoginUser` in that it includes `jti` for session management operations (like "log out this device").

### RequestMeta
Metadata captured during login/registration: `{ userAgent, ipAddress }`. Used to populate Session fields for device identification.

---

## Architecture Decisions

### [ADR-0001](./docs/adr/0001-session-based-jwt-revocation.md)

**Decision**: JWT access tokens are bound to database-backed Session records via the `jti` claim, enabling active revocation and reuse detection.

**Context**: Traditional stateless JWTs are valid until expiration, making revocation impossible. A leaked token could be used until the 15-minute access token expires, and refresh tokens held by attackers could be used until the 7-day expiry.

**Alternatives Considered**:
- Stateless JWTs with very short access token expiry (still allows refresh token replay)
- Redis blocklist (adds infrastructure dependency, eventual consistency)
- Opaque reference tokens (requires token introspection on every request)

**Decision**: TypeORM Session entity with `jti` as primary key. JWT `jti` claim references Session. `/auth/validate` checks Session existence. Refresh rotation deletes old Session, creates new.

**Consequences**:
- Every authenticated request hits the database (`findByJti`). Future caching layer (Redis) is a wrapper around this interface.
- Access tokens become unusable when their Session is revoked, even if signature is valid.
- Refresh token reuse triggers full session revocation (defense in depth).
- Session lifetime equals refresh token lifetime (7 days).

---

## Glossary Index

| Term | Description | File Reference |
|------|-------------|----------------|
| Access Token | 15-min JWT in `Authorization` header | `src/auth/token.service.ts` |
| Refresh Token | 7-day JWT in HTTP-only cookie | `src/auth/token.service.ts` |
| Session | DB row (by `jti`) tracking active login | `src/auth/sessions/session.entity.ts` |
| JTI | JWT ID claim, also Session primary key | `src/auth/token.service.ts` |
| Reuse Detection | Detect/reply to stale refresh token replay | `src/auth/auth.controller.ts:186-196` |
| Response Envelope | `{ data: ... }` wrapper on success | `src/common/transform/response/` |
| LoginUser | User data (id, email, name) from Session | `src/auth/login-user.interface.ts` |
| RequestUser | Request-level user with jti for session ops | `src/auth/types.ts` |