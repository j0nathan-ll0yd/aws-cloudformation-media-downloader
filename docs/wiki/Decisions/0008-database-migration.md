# ADR-0008: Aurora DSQL Migration Strategy

## Status
Accepted

## Date
2025-12-26

## Context

The project migrated from DynamoDB to Aurora DSQL (serverless PostgreSQL-compatible). This required establishing patterns for:

1. **Schema Migrations**: How to evolve database schema over time
2. **Index Creation**: Aurora DSQL requires async index creation
3. **Rollback Strategy**: How to handle migration failures
4. **Deployment Integration**: How migrations fit deployment workflow

Aurora DSQL has specific constraints:
- No foreign key enforcement (application must handle)
- Indexes must be created asynchronously (`CREATE INDEX ASYNC`)
- Serverless scaling affects migration timing

## Decision

### Migration System
- **Tool**: Drizzle ORM with MigrateDSQL Lambda
- **Location**: `drizzle/` directory for migrations, `src/entities/` for schema
- **Execution**: Lambda-based, triggered during deployment

### Schema Pattern
```typescript
// src/entities/Files.ts (Drizzle schema)
export const files = pgTable('files', {
  fileId: text('file_id').primaryKey(),
  fileName: text('file_name').notNull(),
  status: text('status').notNull(),
  createdAt: timestamp('created_at').defaultNow()
})
```

### Migration Pattern
```sql
-- drizzle/0001_initial.sql
CREATE TABLE files (
  file_id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- CREATE INDEX ASYNC (required for Aurora DSQL)
CREATE INDEX ASYNC idx_files_status ON files(status);
```

### Rollback Strategy
- Forward migrations only (no `down` migrations)
- Rollback by creating new migration that reverts changes
- Keep migrations small and reversible

### No Foreign Keys
- Aurora DSQL has limited FK support
- Application enforces referential integrity
- Entity relationships documented in code

## Consequences

### Positive
- Type-safe schema with Drizzle ORM
- Migrations versioned in git
- Lambda-based execution fits serverless model
- Async indexes don't block deployment
- Simple rollback via forward migrations

### Negative
- Must remember `CREATE INDEX ASYNC` syntax
- No database-enforced foreign keys
- Drizzle learning curve

## Enforcement

| Method | Purpose |
|--------|---------|
| MigrateDSQL Lambda | Executes migrations on deploy |
| Terraform integration | Triggers migration Lambda |
| Code review | Validates ASYNC index syntax |

## Related

- [Database Migrations](../Conventions/Database-Migrations.md) - Implementation guide
- [ADR-0005: Drift Prevention](0005-drift-prevention.md) - Deployment workflow
