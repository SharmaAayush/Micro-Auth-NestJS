# 🤖 Agent Migration Runbook (TypeORM & NestJS)

This document provides system rules, descriptions, and structural boundaries for automated agents (LLMs, Copilot, internal tools) interacting with the migration framework in this repository.

## 📋 Available Commands

| Script Target | Command | Purpose / Trigger Condition |
| :--- | :--- | :--- |
| **Generate Schema** | `npm run migration:generate -- src/db/migrations/<name>` | Run this when entity fields (`@Column`, `@Entity`, etc.) are created or changed. |
| **Create Blank** | `npm run migration:create -- src/db/migrations/<name>` | Run this for seed data, views, triggers, indices, or custom data patches. |
| **Execute Pending** | `npm run migration:run` | Run this during CI/CD steps or local startup to synchronize the DB state. |
| **Rollback Last** | `npm run migration:revert` | Run this if a local migration fails validation or breaks an active integration test. |

---

## 🛠 Command Behavior & Context Rules

### 1. Schema Modifications (`migration:generate`)
* **Behavior:** Compares internal TypeScript metadata against the live target database schemas to compute structural differentials automatically.
* **Agent Constraints:**
  * **Requires a running database instance.** Verify database connection environments before spinning up this child process.
  * Always provide a descriptive, PascalCase suffix path (e.g., `-- src/db/migrations/AddStatusField`).
  * If the execution outputs `"No changes in database schema were found"`, check if `synchronize: true` is conflicting in `AppModule` or if file pathways are misaligned.

### 2. Manual Customizations & Data Seeding (`migration:create`)
* **Behavior:** Scaffolds an offline, template-driven boilerplate migration containing blank `up()` and `down()` parameters.
* **Agent Constraints:**
  * **Do not provide data source configurations (`-d` flags).** This script executes entirely offline and throws an "Unknown argument" error if forced to connect.
  * When writing queries inside the template block, always use parameterized queries to mitigate SQL injection vulnerabilities.

### 3. Execution Loops (`migration:run`)
* **Behavior:** Evaluates the `migrations` directory alongside the database tracking table (`typeorm_metadata`), sequentially running pending files based on timestamps.

### 4. System Reversals (`migration:revert`)
* **Behavior:** Pops the last executed migration row out of the metadata table and calls its unique `down()` class configuration.
* **Agent Constraints:** Always verify that structural rollbacks will not silently purge active developer or production storage subsets unexpectedly.

---

## 🚦 System Architecture & File Formats

* **Type Safety Overrides:** All outputs must remain in native TypeScript (`.ts`). JavaScript (`.js`) file configurations inside development workflows are prohibited.
* **Environment Variables:** The pipeline depends on a primary `.env` file configuration in the root execution pathway to populate local `DataSource` connection pools during CLI parsing.
* **Migration File Paths:** All migration files must be created in `src/db/migrations/` folder. Ensure this by passing appropriate parameters when generating schema or creating blank migration.

## Migration safety notes

- The `ConvertUserIdToUuid` migration's `down()` is destructive — it sets `session.user_id = 0` for every row and requires `NOT VALID` on the FK re-add. See the migration file for details. Do not run `down()` on a production database.
