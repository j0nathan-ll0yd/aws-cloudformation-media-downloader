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

## Related Patterns

- [Lambda Function Patterns](Lambda-Function-Patterns.md) - Handler patterns
- [Vitest Mocking Strategy](../Testing/Vitest-Mocking-Strategy.md) - Mocking Drizzle in tests

---

*Always use the vendor wrapper, never import directly from 'drizzle-orm'.*
