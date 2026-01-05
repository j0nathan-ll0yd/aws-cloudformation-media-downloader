# Drizzle Patterns

## Quick Reference
- **When to use**: Database operations with Aurora DSQL
- **Location**: `src/lib/vendor/Drizzle/`
- **Related**: [Lambda Function Patterns](Lambda-Function-Patterns.md)

## Overview

This project uses Drizzle ORM with Aurora DSQL for type-safe, serverless database operations. The Drizzle client wrapper provides IAM authentication and connection management.

---

## getDrizzleClient

**Use for**: Getting a configured Drizzle client for database queries.

**File**: `src/lib/vendor/Drizzle/client.ts`

```typescript
import {getDrizzleClient} from '#lib/vendor/Drizzle/client'

const db = await getDrizzleClient()
const users = await db.select().from(usersTable).where(eq(usersTable.id, userId))
```

**Notes**:
- Client is cached per Lambda instance
- IAM tokens are automatically refreshed before expiration
- Uses TEST_DATABASE_URL in test mode for local PostgreSQL

---

## withTransaction

**Use for**: Executing multiple database operations atomically.

**File**: `src/lib/vendor/Drizzle/client.ts`

**Signature**:
```typescript
async function withTransaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T>
```

**Example**:
```typescript
import {withTransaction} from '#lib/vendor/Drizzle/client'

// Create user and identity provider atomically
await withTransaction(async (tx) => {
  await tx.insert(users).values(userData)
  await tx.insert(identityProviders).values(idpData)
})

// Transaction with return value
const result = await withTransaction(async (tx) => {
  const [user] = await tx.insert(users).values(userData).returning()
  await tx.insert(sessions).values({userId: user.id, token: 'abc'})
  return user
})
```

**Notes**:
- Automatically rolls back on error
- Use for related operations that must succeed or fail together
- The transaction client (`tx`) has the same API as the regular Drizzle client

---

## closeDrizzleClient

**Use for**: Cleaning up database connections during shutdown or tests.

**File**: `src/lib/vendor/Drizzle/client.ts`

```typescript
import {closeDrizzleClient} from '#lib/vendor/Drizzle/client'

// In test cleanup
afterAll(async () => {
  await closeDrizzleClient()
})
```

---

## Zod Schema Generation (drizzle-zod)

**Use for**: Runtime validation of database insert and update operations.

**File**: `src/lib/vendor/Drizzle/zodSchemas.ts`

The project uses `drizzle-zod` to generate Zod validation schemas from Drizzle table definitions. All entity query functions validate input before database operations.

### Importing Schemas

```typescript
import {userInsertSchema, fileSelectSchema} from '#lib/vendor/Drizzle/zodSchemas'

// Validate insert data
const validatedUser = userInsertSchema.parse(userData)

// Validate partial update data
const validatedData = userUpdateSchema.partial().parse(updateData)
```

### Available Schemas

Each table has three schema variants:

| Variant | Purpose | Example |
|---------|---------|---------|
| `*InsertSchema` | Validates data for INSERT operations | `userInsertSchema` |
| `*SelectSchema` | Validates data from SELECT operations | `fileSelectSchema` |
| `*UpdateSchema` | Validates data for UPDATE operations | `deviceUpdateSchema` |

### Custom Refinements

Use factory functions for custom validation rules:

```typescript
import {createInsertSchema} from '#lib/vendor/Drizzle/zodSchemas'
import {files} from '#lib/vendor/Drizzle/schema'

const customFileSchema = createInsertSchema(files, {
  title: (schema) => schema.min(1).max(200),
  url: (schema) => schema.url()
})
```

### Entity Query Integration

All entity query insert/update functions validate input:

```typescript
// In entity query function
export async function createUser(input: CreateUserInput): Promise<UserItem> {
  // Validate input before database operation
  const validatedInput = userInsertSchema.parse(input)
  const db = await getDrizzleClient()
  const [user] = await db.insert(users).values(validatedInput).returning()
  return user
}
```

---

## ESLint Safety Rules (eslint-plugin-drizzle)

**Use for**: Preventing accidental bulk delete/update operations.

The project enforces two ESLint rules to prevent dangerous database operations:

| Rule | Purpose |
|------|---------|
| `drizzle/enforce-delete-with-where` | Requires `.where()` on all delete operations |
| `drizzle/enforce-update-with-where` | Requires `.where()` on all update operations |

### Configured Object Names

The rules apply to variables named `db` (main client) and `tx` (transaction client).

### Examples

```typescript
// ALLOWED - has where clause
await db.delete(users).where(eq(users.id, userId))
await tx.update(files).set({status: 'Downloaded'}).where(eq(files.fileId, fileId))

// BLOCKED by ESLint - no where clause
await db.delete(users)  // Error: use where clause or .all() to confirm
await tx.update(files).set({status: 'Failed'})  // Error: missing where clause
```

---

## Query Instrumentation

Query tracing and metrics in `src/lib/vendor/Drizzle/instrumentation.ts`.

### Usage

```typescript
import {withQueryMetrics} from '#lib/vendor/Drizzle/instrumentation'

const user = await withQueryMetrics('Users.get', async () => {
  return db.select().from(users).where(eq(users.id, userId))
})
```

The wrapper automatically records:
- Query duration to CloudWatch metrics
- X-Ray trace segments via OpenTelemetry
- Success/failure status and row counts

---

## Related Patterns

- [Lambda Function Patterns](Lambda-Function-Patterns.md) - Handler patterns
- [Vitest Mocking Strategy](../Testing/Vitest-Mocking-Strategy.md) - Mocking Drizzle in tests
- [Schema Consolidation Research](Schema-Consolidation-Research.md) - API vs Drizzle schema analysis

---

*Always use the vendor wrapper, never import directly from 'drizzle-orm' or 'drizzle-zod'.*
