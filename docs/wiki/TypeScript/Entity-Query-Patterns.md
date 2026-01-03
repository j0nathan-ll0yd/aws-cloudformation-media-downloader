# Entity Query Patterns

This document describes the native Drizzle ORM query patterns used in `src/entities/queries/`.

## Quick Reference

- **When to use**: Accessing database entities in Lambda handlers
- **Enforcement**: Required (use `#entities/queries` imports)
- **Impact if violated**: HIGH - Type safety issues, N+1 queries

## Architecture Overview

The project uses **Drizzle ORM with Aurora DSQL** for type-safe database access. Entity operations are organized as query functions rather than ORM entity classes.

```
src/entities/queries/
├── index.ts                 # Barrel export for all queries
├── user-queries.ts          # User operations (8 functions)
├── file-queries.ts          # File and FileDownload operations (14 functions)
├── device-queries.ts        # Device operations (8 functions)
├── session-queries.ts       # Session, Account, VerificationToken (20 functions)
└── relationship-queries.ts  # UserFiles, UserDevices (17 functions)
```

## Import Pattern

Always import from the barrel export:

```typescript
// ✅ CORRECT - Import from barrel
import {getUser, createUser, updateUser, type UserRow} from '#entities/queries'

// ❌ WRONG - Direct file import
import {getUser} from '#entities/queries/user-queries'
```

## Type System

Each entity module exports a consistent set of types:

| Type Pattern | Description | Example |
|--------------|-------------|---------|
| `*Row` | Database row type (select result) | `UserRow`, `FileRow`, `DeviceRow` |
| `*Item` | Row with joined data | `UserItem` (includes identity providers) |
| `Create*Input` | Insert input type | `CreateUserInput`, `CreateFileInput` |
| `Update*Input` | Update input type | `UpdateUserInput`, `UpdateFileInput` |

### Type Examples

```typescript
// Row type - direct database columns
type UserRow = {
  id: string
  email: string
  name: string | null
  status: 'active' | 'inactive'
  createdAt: Date
  updatedAt: Date
}

// Item type - row with joined data
type UserItem = UserRow & {
  identityProviders?: IdentityProviderData
}

// Input types - what you pass to create/update
type CreateUserInput = Omit<UserRow, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string  // Optional - generated if not provided
  identityProviders?: IdentityProviderData
}

type UpdateUserInput = Partial<Omit<UserRow, 'id' | 'createdAt'>>
```

## Query Function Patterns

### Basic CRUD Operations

```typescript
import {getUser, createUser, updateUser, deleteUser} from '#entities/queries'

// Get by ID
const user = await getUser(userId)  // Returns UserItem | null

// Create
const newUser = await createUser({
  email: 'user@example.com',
  name: 'John Doe',
  status: 'active'
})

// Update
const updated = await updateUser(userId, {
  name: 'Jane Doe'
})

// Delete
await deleteUser(userId)
```

### Query Functions (Multiple Results)

```typescript
import {getUsersByEmail, getFilesForUser, getDevicesForUser} from '#entities/queries'

// Find by field
const users = await getUsersByEmail('user@example.com')  // Returns UserItem[]

// Relationship queries with JOIN
const files = await getFilesForUser(userId)     // Returns FileRow[]
const devices = await getDevicesForUser(userId) // Returns DeviceRow[]
```

### Relationship Operations

```typescript
import {
  createUserFile, getUserFile, deleteUserFile,
  createUserDevice, getUserDevice, deleteUserDevice,
  getFilesForUser, getDevicesForUser
} from '#entities/queries'

// Create relationship
await createUserFile({userId, fileId})
await createUserDevice({userId, deviceId})

// Check relationship exists
const userFile = await getUserFile(userId, fileId)  // Returns UserFileRow | null

// Get related entities with JOIN
const files = await getFilesForUser(userId)   // Full FileRow objects
const devices = await getDevicesForUser(userId)

// Delete relationship
await deleteUserFile(userId, fileId)
```

### Upsert Operations

Use upsert when you need to create if not exists:

```typescript
import {upsertFile, upsertUserFile, upsertDevice} from '#entities/queries'

// Upsert uses ON CONFLICT DO NOTHING for atomicity
const file = await upsertFile({
  fileId: 'video-123',
  fileName: 'video.mp4',
  status: 'pending'
})

// Relationship upsert
await upsertUserFile({userId, fileId})
```

### Batch Operations

```typescript
import {getFilesBatch, getDevicesBatch, deleteUserFilesBatch} from '#entities/queries'

// Batch get by IDs
const files = await getFilesBatch(['file-1', 'file-2', 'file-3'])
const devices = await getDevicesBatch(['device-1', 'device-2'])

// Batch delete
await deleteUserFilesBatch(userId, ['file-1', 'file-2'])
```

## Transaction Handling

Use `withTransaction` for atomic operations:

```typescript
import {withTransaction} from '#lib/vendor/Drizzle/client'
import {users, identityProviders} from '#lib/vendor/Drizzle/schema'

// Transaction example - user with identity provider
const user = await withTransaction(async (tx) => {
  const [createdUser] = await tx.insert(users).values(userData).returning()

  await tx.insert(identityProviders).values({
    userId: createdUser.id,
    ...idpData
  })

  return createdUser
})
```

## Input Validation

All create/update functions validate input against Zod schemas:

```typescript
import {userInsertSchema, userUpdateSchema} from '#lib/vendor/Drizzle/zod-schemas'

// Validation happens automatically in query functions
const user = await createUser(input)  // Throws ZodError if invalid

// Manual validation if needed
const validated = userInsertSchema.parse(input)
```

## Testing Patterns

Mock query functions using `vi.mock()`:

```typescript
import {createMockUser, createMockFile} from '#test/helpers/entity-fixtures'
import {getUser, createUser, getFilesForUser} from '#entities/queries'

vi.mock('#entities/queries', () => ({
  getUser: vi.fn(),
  createUser: vi.fn(),
  getFilesForUser: vi.fn()
}))

describe('Lambda handler', () => {
  beforeEach(() => {
    vi.mocked(getUser).mockResolvedValue(createMockUser())
    vi.mocked(getFilesForUser).mockResolvedValue([createMockFile()])
  })

  it('fetches user and files', async () => {
    const result = await handler(event, context)
    expect(getUser).toHaveBeenCalledWith('user-123')
    expect(getFilesForUser).toHaveBeenCalledWith('user-123')
  })
})
```

See [Vitest Mocking Strategy](../Testing/Vitest-Mocking-Strategy.md) for comprehensive testing patterns.

## Migration from Legacy Entity Imports

If you see legacy ElectroDB-style imports, migrate to query functions:

```typescript
// ❌ LEGACY - ElectroDB entity style
import {Users} from '#entities/Users'
const result = await Users.get({id: userId}).go()
const user = result.data

// ✅ CURRENT - Query function style
import {getUser} from '#entities/queries'
const user = await getUser(userId)
```

### Key Differences

| Aspect | Legacy (ElectroDB) | Current (Drizzle Queries) |
|--------|-------------------|---------------------------|
| Return type | `{data: T \| null}` | `T \| null` |
| Method chaining | `.get({id}).go()` | `getUser(id)` |
| Mocking | Complex entity mock | Simple function mock |
| Type inference | Through entity | Direct return type |

## Available Query Functions

### User Queries

| Function | Parameters | Returns |
|----------|------------|---------|
| `getUser(id)` | User ID | `UserItem \| null` |
| `getUsersByEmail(email)` | Email address | `UserItem[]` |
| `getUsersByAppleDeviceId(deviceId)` | Apple device ID | `UserItem[]` |
| `createUser(input)` | `CreateUserInput` | `UserItem` |
| `updateUser(id, data)` | ID, `UpdateUserInput` | `UserItem` |
| `deleteUser(id)` | User ID | `void` |

### File Queries

| Function | Parameters | Returns |
|----------|------------|---------|
| `getFile(fileId)` | File ID | `FileRow \| null` |
| `getFilesByKey(key)` | S3 key | `FileRow[]` |
| `getFilesBatch(fileIds)` | Array of IDs | `FileRow[]` |
| `createFile(input)` | `CreateFileInput` | `FileRow` |
| `updateFile(fileId, data)` | ID, `UpdateFileInput` | `FileRow` |
| `upsertFile(input)` | `CreateFileInput` | `FileRow` |
| `deleteFile(fileId)` | File ID | `void` |

### Device Queries

| Function | Parameters | Returns |
|----------|------------|---------|
| `getDevice(deviceId)` | Device ID | `DeviceRow \| null` |
| `getAllDevices()` | None | `DeviceRow[]` |
| `getDevicesBatch(deviceIds)` | Array of IDs | `DeviceRow[]` |
| `createDevice(input)` | `CreateDeviceInput` | `DeviceRow` |
| `updateDevice(deviceId, data)` | ID, `UpdateDeviceInput` | `DeviceRow` |
| `upsertDevice(input)` | `CreateDeviceInput` | `DeviceRow` |
| `deleteDevice(deviceId)` | Device ID | `void` |

### Relationship Queries

| Function | Parameters | Returns |
|----------|------------|---------|
| `getUserFile(userId, fileId)` | User ID, File ID | `UserFileRow \| null` |
| `getFilesForUser(userId)` | User ID | `FileRow[]` |
| `getUserDevice(userId, deviceId)` | User ID, Device ID | `UserDeviceRow \| null` |
| `getDevicesForUser(userId)` | User ID | `DeviceRow[]` |
| `createUserFile(input)` | `CreateUserFileInput` | `UserFileRow` |
| `upsertUserFile(input)` | `CreateUserFileInput` | `UserFileRow` |
| `deleteUserFile(userId, fileId)` | User ID, File ID | `void` |

### Session Queries

| Function | Parameters | Returns |
|----------|------------|---------|
| `getSession(sessionId)` | Session ID | `SessionRow \| null` |
| `getSessionByToken(token)` | Token | `SessionRow \| null` |
| `createSession(input)` | `CreateSessionInput` | `SessionRow` |
| `updateSession(id, data)` | ID, `UpdateSessionInput` | `SessionRow` |
| `deleteSession(id)` | Session ID | `void` |
| `deleteExpiredSessions()` | None | `void` |

## Best Practices

1. **Always use barrel import** - Import from `#entities/queries`, not individual files
2. **Prefer JOINs over multiple queries** - Use `getFilesForUser()` instead of fetching IDs then files
3. **Use upsert for idempotency** - Avoid duplicates with `upsertFile()`, `upsertUserFile()`
4. **Validate with Zod schemas** - Query functions validate automatically
5. **Use transactions for atomicity** - Multiple related writes should use `withTransaction()`
6. **Mock at function level** - Simple `vi.mock()` for testing

## Related Documentation

- [Vitest Mocking Strategy](../Testing/Vitest-Mocking-Strategy.md) - Testing patterns
- [Drizzle Patterns](Drizzle-Patterns.md) - ORM configuration
- [Lambda Function Patterns](Lambda-Function-Patterns.md) - Handler patterns
- [Vendor Encapsulation Policy](../Conventions/Vendor-Encapsulation-Policy.md) - Import rules
