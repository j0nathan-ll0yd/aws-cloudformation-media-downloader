# Database Permissions Decorator

## Quick Reference
- **When to use**: Lambda handlers that access Aurora DSQL via `#entities/queries`
- **Enforcement**: MCP validation rule (HIGH severity)
- **Impact if violated**: Undocumented database access, potential security audit failures

## Overview

The `@RequiresDatabase` decorator explicitly documents which database tables and operations each Lambda handler requires. This provides:

1. **Documentation**: Database access requirements are visible in code
2. **Validation**: MCP rules enforce decorator matches actual imports
3. **Foundation**: Enables future generation of per-Lambda PostgreSQL roles

## Usage

### Basic Syntax

```typescript
import {DatabaseTable, DatabaseOperation} from '#types/databasePermissions'
import {ApiHandler, RequiresDatabase} from '#lib/lambda/handlers'

@RequiresDatabase([
  {table: DatabaseTable.Users, operations: [DatabaseOperation.Select]},
  {table: DatabaseTable.Files, operations: [DatabaseOperation.Select, DatabaseOperation.Update]}
])
class MyHandler extends ApiHandler {
  // Handler implementation
}
```

### Available Tables

| Enum Value | Table Name | Description |
|------------|------------|-------------|
| `DatabaseTable.Users` | users | User accounts |
| `DatabaseTable.Files` | files | Media file metadata |
| `DatabaseTable.FileDownloads` | file_downloads | Download tracking |
| `DatabaseTable.Devices` | devices | iOS device registrations |
| `DatabaseTable.Sessions` | sessions | Better Auth sessions |
| `DatabaseTable.Accounts` | accounts | Better Auth OAuth accounts |
| `DatabaseTable.VerificationTokens` | verification_tokens | Email verification tokens |
| `DatabaseTable.UserFiles` | user_files | User-File junction table |
| `DatabaseTable.UserDevices` | user_devices | User-Device junction table |

### Available Operations

| Enum Value | SQL Operation | Use Case |
|------------|---------------|----------|
| `DatabaseOperation.Select` | SELECT | Reading data |
| `DatabaseOperation.Insert` | INSERT | Creating records |
| `DatabaseOperation.Update` | UPDATE | Modifying records |
| `DatabaseOperation.Delete` | DELETE | Removing records |

## Query Function Mapping

The MCP validation rule maps imported query functions to required tables:

| Query Function | Table | Operation |
|----------------|-------|-----------|
| `getUser`, `getUserByEmail` | users | SELECT |
| `createUser` | users | INSERT |
| `updateUser` | users | UPDATE |
| `deleteUser` | users | DELETE |
| `getFile`, `getFiles`, `getFilesByKey` | files | SELECT |
| `createFile` | files | INSERT |
| `updateFile` | files | UPDATE |
| `deleteFile` | files | DELETE |
| `upsertDevice` | devices | INSERT, UPDATE |
| `deleteDevice` | devices | DELETE |
| `getFilesForUser` | user_files | SELECT |
| `createUserFile` | user_files | INSERT |
| `deleteUserFilesByUserId` | user_files | DELETE |

See `src/mcp/validation/rules/database-permissions.ts` for the complete mapping.

## MCP Validation

### Rule Details

- **Name**: `database-permissions`
- **Severity**: HIGH
- **Applies to**: `src/lambdas/*/src/index.ts`

### What Gets Checked

1. **Missing decorator**: Lambda imports from `#entities/queries` but lacks `@RequiresDatabase`
2. **Missing table permissions**: Decorator exists but doesn't cover all imported query functions

### Running Validation

```bash
# Via MCP
pnpm run validate:conventions

# Check specific file
pnpm run validate:conventions -- --file src/lambdas/ListFiles/src/index.ts
```

## Build-Time Extraction

The `scripts/extractDbPermissions.ts` script extracts decorator metadata at build time:

```bash
pnpm run extract:db-permissions
```

Generates `build/db-permissions.json`:

```json
{
  "lambdas": {
    "ListFiles": {
      "tables": [
        {"table": "user_files", "operations": ["SELECT"]},
        {"table": "files", "operations": ["SELECT"]}
      ],
      "computedAccessLevel": "readonly"
    },
    "UserDelete": {
      "tables": [
        {"table": "users", "operations": ["DELETE"]},
        {"table": "devices", "operations": ["SELECT"]},
        {"table": "user_files", "operations": ["DELETE"]},
        {"table": "user_devices", "operations": ["DELETE"]}
      ],
      "computedAccessLevel": "readwrite"
    }
  },
  "generatedAt": "2026-01-16T..."
}
```

## Current Lambda Permissions

| Lambda | Tables | Access Level |
|--------|--------|--------------|
| ListFiles | user_files, files | readonly |
| UserDelete | users, devices, user_files, user_devices | readwrite |
| RegisterDevice | devices, user_devices | readwrite |
| RegisterUser | users, sessions, accounts | readwrite |
| S3ObjectCreated | files, user_files | readonly |
| SendPushNotification | devices, user_devices | readonly |
| WebhookFeedly | files, file_downloads, user_files | readwrite |
| StartFileUpload | file_downloads, files, user_files | readwrite |
| PruneDevices | devices, user_devices | readwrite |
| CleanupExpiredRecords | files, file_downloads, user_files, sessions, verification_tokens | readwrite |
| LoginUser | users, sessions | readwrite |
| RefreshToken | sessions | readwrite |
| UserSubscribe | user_devices | readwrite |
| MigrateDSQL | All tables | admin |

## Helper Functions

### Getting Permissions at Runtime

```typescript
import {getDatabasePermissions} from '#lib/lambda/handlers'

const permissions = getDatabasePermissions(MyHandler)
// Returns: [{table: 'users', operations: ['SELECT']}, ...]
```

### Computing Access Level

```typescript
import {computeAccessLevel} from '#lib/lambda/handlers'

const level = computeAccessLevel(permissions)
// Returns: 'readonly' | 'readwrite' | 'admin'
```

## Future Work

This decorator system provides the foundation for:

1. **Per-Lambda PostgreSQL roles**: Generate SQL migrations with fine-grained GRANT statements
2. **Terraform generation**: Auto-generate IAM policies based on declared permissions
3. **Runtime enforcement**: Validate database access matches declared permissions

See the plan file for Phase 9 implementation details.

## Related Documentation

- [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md)
- [Entity Query Patterns](../TypeScript/Entity-Query-Patterns.md)
- [OpenTofu Patterns](./OpenTofu-Patterns.md)
