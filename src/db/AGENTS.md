# Database Configuration

This area contains the TypeORM database setup and migration files.

## Role

Manages PostgreSQL database connection, entity scanning, and migration handling via TypeORM.

## Conventions

- **DataSource**: `src/db/typeorm.config.ts` creates and exports a DataSource instance:
  * Loads `.env` file via `dotenv.config()` for CLI context.
  * Connection parameters sourced from environment variables with defaults:
    - `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`
    - `DB_SYNCHRONIZE` (boolean, defaults to false)
    - `DB_LOGGING` (boolean, defaults to false)
  * Type: 'postgres'
  * Entity scanning: `__dirname + '/..//**/*.entity{.ts,js}'` (searches src/ and dist/ for entity files)
  * Migration directory: `__dirname + '/migrations/*.ts'` (TypeScript migration files only)
- **Migration Files**: Located in `src/db/migrations/`:
  * Naming pattern: `<timestamp>-<name>.ts` (e.g., `1787932818277-create-users.ts`)
  * Implement `MigrationInterface` with `up()` and `down()` methods
  * Example migration creates a "user" table with id, email, password, name fields, unique email constraint
- **TypeORM Module Registration**: In `src/app.module.ts`:
  * `TypeOrmModule.forRootAsync()` uses a factory that returns an empty object (configuration ignored)
  * `dataSourceFactory: async () => { return dataSource.initialize(); }` reuses the DataSource instance from `typeorm.config.ts`
  * This ensures a single connection instance is shared
- **Configuration**: Application-wide config (including JWT) handled by `src/config/configuration.ts` via `ConfigModule.forRoot({ isGlobal: true, load: [configuration] })` in `AppModule`.
- **Environment Variables**: Database connection settings and flags are expected in `.env` or process environment.

## Notes

- Refer to the [Agent Migration Runbook](/agents/docs/MIGRATIONS.md) for best practices when generating and running migrations.
- Entity files should follow the `*.entity.ts` naming convention and be placed in their respective feature modules (e.g., `src/auth/users.entity.ts`).
- The `synchronize` flag is controlled by `DB_SYNCHRONIZE` environment variable; it is recommended to keep this false in production and use migrations for schema changes.