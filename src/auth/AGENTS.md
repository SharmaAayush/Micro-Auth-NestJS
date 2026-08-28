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