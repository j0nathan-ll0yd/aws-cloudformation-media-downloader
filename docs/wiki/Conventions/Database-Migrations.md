# Database Migrations

This document describes the database migration strategy for Aurora DSQL.

## Overview

All database schema changes are managed through versioned SQL migration files. Migrations are applied automatically during Terraform deployment via the `MigrateDSQL` Lambda.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Deployment Flow                             │
├─────────────────────────────────────────────────────────────────┤
│  1. pnpm run build         (bundles Lambda + SQL files)         │
│  2. tofu apply                                                   │
│     ├── aws_dsql_cluster.media_downloader                       │
│     ├── aws_lambda_function.MigrateDSQL                         │
│     └── data.aws_lambda_invocation.run_migration                │
│  3. MigrateDSQL Lambda executes                                  │
│     ├── Reads SQL files from bundled migrations/                │
│     ├── Checks schema_migrations table for applied versions     │
│     ├── Applies pending migrations in order                     │
│     └── Records applied migrations                               │
└─────────────────────────────────────────────────────────────────┘
```

## Migration Files

Migration files are stored in the `migrations/` directory at the project root:

```
migrations/
├── 0001_initial_schema.sql
├── 0002_create_indexes.sql
└── NNNN_description.sql
```

### Naming Convention

Files follow the format: `NNNN_description.sql`

- `NNNN` - Zero-padded version number (0001, 0002, etc.)
- `description` - Snake_case description of the change
- Must end with `.sql`

### Creating New Migrations

1. **Modify the Drizzle schema** in `src/lib/vendor/Drizzle/schema.ts`

2. **Generate migration SQL** using Drizzle Kit:
   ```bash
   pnpm run db:generate
   ```

3. **Review and edit the generated SQL:**
   - Add `IF NOT EXISTS` to all CREATE statements
   - Replace `CREATE INDEX` with `CREATE INDEX ASYNC`
   - Ensure idempotency
   - Add `DEFAULT NULL` to nullable columns (for Better Auth compatibility)

4. **Copy to migrations directory** with proper naming:
   ```bash
   mv migrations/XXXX_migration.sql migrations/0003_add_new_table.sql
   ```

5. **Test locally:**
   ```bash
   docker-compose -f docker-compose.test.yml up -d
   pnpm run test:integration
   ```

6. **Deploy:**
   ```bash
   pnpm run deploy
   ```

## Aurora DSQL Requirements

Aurora DSQL has specific requirements that differ from standard PostgreSQL:

### CREATE INDEX ASYNC

Standard PostgreSQL indexes block writes during creation. Aurora DSQL requires `CREATE INDEX ASYNC` for non-blocking index creation:

```sql
-- Wrong
CREATE INDEX users_email_idx ON users(email);

-- Correct
CREATE INDEX ASYNC IF NOT EXISTS users_email_idx ON users(email);
```

### No Foreign Key Enforcement

Aurora DSQL accepts foreign key syntax but does not enforce constraints. Referential integrity must be handled at the application layer.

```sql
-- This is valid syntax but NOT enforced
CREATE TABLE user_files (
  user_id UUID REFERENCES users(user_id),  -- Not enforced!
  file_id TEXT NOT NULL
);
```

Use application-layer validation in `src/lib/vendor/Drizzle/fk-enforcement.ts`.

## Integration Testing

### Single Source of Truth Convention

**CRITICAL**: Migrations are the single source of truth for SQL. Test infrastructure reads from migration files, not from duplicate SQL definitions.

```
migrations/0001_initial_schema.sql  ← Single source of truth
            ↓
test/integration/globalSetup.ts     ← Reads and adapts migrations
            ↓
test/integration/helpers/           ← Uses tables created by globalSetup
```

### How It Works

1. **globalSetup.ts** runs once before all tests:
   - Reads SQL from `migrations/*.sql` files
   - Applies minimal transformations for test environment:
     - Schema prefix for worker isolation
     - `CREATE INDEX ASYNC` → `CREATE INDEX` (PostgreSQL compatibility)
     - `UUID` → `TEXT` (test simplicity with regular PostgreSQL)
   - Creates tables in worker-specific schemas

2. **Test files** call `createAllTables()` which only sets `search_path`

3. **Between tests**, `truncateAllTables()` clears data

### DO NOT Duplicate SQL

```typescript
// ❌ WRONG: Duplicate SQL in test helpers
await db.execute(sql.raw(`
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL
  )
`))

// ✅ CORRECT: Use migration-created tables
export async function createAllTables(): Promise<void> {
  // Tables are created by globalSetup from migrations
  await db.execute(sql.raw(`SET search_path TO ${schema}, public`))
}
```

### Why DEFAULT NULL in Migrations

Better Auth uses `generateId: false` and sends `DEFAULT` for columns without values:

```sql
-- Better Auth generates:
INSERT INTO users (id, email, name) VALUES (DEFAULT, 'user@example.com', DEFAULT)
```

PostgreSQL requires explicit `DEFAULT NULL` for nullable columns when `DEFAULT` is used in INSERT:

```sql
-- Must have DEFAULT NULL for nullable columns
name TEXT DEFAULT NULL,
image TEXT DEFAULT NULL,
```

### UUID Generation

Aurora DSQL supports `gen_random_uuid()` for UUID generation:

```sql
CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);
```

### No TRUNCATE

Use `DELETE FROM table_name` instead of `TRUNCATE`.

## Migration Tracking

Applied migrations are tracked in the `schema_migrations` table:

```sql
CREATE TABLE schema_migrations (
  version TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

The `MigrateDSQL` Lambda:
1. Creates this table if it doesn't exist
2. Queries for already-applied versions
3. Applies only pending migrations
4. Records each successful migration

## Rollback Strategy

### Option 1: Forward Migration (Recommended)

Create a new migration that reverts the change:

```sql
-- migrations/0004_rollback_0003.sql
DROP TABLE IF EXISTS new_table;
DELETE FROM schema_migrations WHERE version = '0003';
```

### Option 2: Point-in-Time Recovery

Aurora DSQL supports continuous backup. Use AWS Console/CLI to restore to a previous point.

### Option 3: Manual Rollback (Development Only)

Connect to DSQL and run rollback SQL manually:

```sql
DROP TABLE IF EXISTS new_table;
DELETE FROM schema_migrations WHERE version = '0003';
```

## Related Files

| File | Purpose |
|------|---------|
| `drizzle.config.ts` | Drizzle Kit configuration |
| `migrations/*.sql` | Migration SQL files |
| `src/lib/vendor/Drizzle/schema.ts` | Drizzle schema definitions |
| `src/lambdas/MigrateDSQL/src/index.ts` | Migration Lambda handler |
| `terraform/migrate_dsql.tf` | Terraform configuration |
| `config/esbuild.config.ts` | Build config (bundles SQL files) |

## References

- [Drizzle ORM Migrations](https://orm.drizzle.team/docs/migrations)
- [Aurora DSQL Migration Guide](https://docs.aws.amazon.com/aurora-dsql/latest/userguide/working-with-postgresql-compatibility-migration-guide.html)
