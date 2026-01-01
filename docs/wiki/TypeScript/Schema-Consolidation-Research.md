# Schema Consolidation Research

## Overview

This document analyzes the relationship between TypeSpec-generated API schemas (`src/types/api-schema/schemas.ts`) and Drizzle-Zod entity schemas (`src/lib/vendor/Drizzle/zod-schemas.ts`) to determine consolidation opportunities.

## Current Schema Sources

### TypeSpec API Schemas
- **Source**: TypeSpec definitions compiled by `scripts/generateApiTypes.ts`
- **Purpose**: API contract validation (request/response shapes)
- **Location**: `src/types/api-schema/schemas.ts`

### Drizzle-Zod Entity Schemas
- **Source**: Auto-generated from Drizzle table definitions
- **Purpose**: Database insert/update validation
- **Location**: `src/lib/vendor/Drizzle/zod-schemas.ts`

## Schema Comparison

| Entity | API Schema | Drizzle Schema | Overlap Level | Notes |
|--------|-----------|----------------|---------------|-------|
| File | `fileSchema` | `fileSelectSchema` | **High** | API schema is subset with `url` as `.url()` |
| Device | `deviceSchema` | `deviceSelectSchema` | **High** | Nearly identical, `endpointArn` optional in API |
| User | N/A | `userSelectSchema` | **None** | Not exposed in API |
| Session | N/A | `sessionSelectSchema` | **None** | Internal Better Auth table |
| FileStatus | `fileStatusSchema` | N/A (text column) | **Partial** | Drizzle uses text, API has enum |

### Request/Response Schemas (API-Only)

These schemas exist only in the API layer and have no database equivalent:

| Schema | Purpose |
|--------|---------|
| `errorResponseSchema` | Standard error response wrapper |
| `unauthorizedErrorSchema` | 401 response |
| `forbiddenErrorSchema` | 403 response |
| `internalServerErrorSchema` | 500 response |
| `fileListResponseSchema` | Paginated file list |
| `deviceRegistrationRequestSchema` | Device registration input |
| `deviceRegistrationResponseSchema` | Device registration output |
| `feedlyWebhookRequestSchema` | Feedly webhook payload |
| `webhookResponseSchema` | Webhook acknowledgment |
| `userLoginRequestSchema` | Login request (idToken) |
| `userLoginResponseSchema` | Login response (token) |
| `userRegistrationRequestSchema` | Registration request |
| `userRegistrationResponseSchema` | Registration response |
| `userSubscriptionRequestSchema` | Subscription request |

## Detailed Analysis

### File Schema Comparison

**API Schema (`fileSchema`)**:
```typescript
z.object({
  fileId: z.string(),
  key: z.string().optional(),
  size: z.number().optional(),
  status: fileStatusSchema.optional(),
  title: z.string().optional(),
  publishDate: z.string().optional(),
  authorName: z.string().optional(),
  authorUser: z.string().optional(),
  contentType: z.string().optional(),
  description: z.string().optional(),
  url: z.string().url().optional()
})
```

**Drizzle Schema (`fileSelectSchema`)**:
```typescript
// Generated from files table - all fields required except url
z.object({
  fileId: z.string(),
  size: z.number(),
  authorName: z.string(),
  authorUser: z.string(),
  publishDate: z.string(),
  description: z.string(),
  key: z.string(),
  url: z.string().nullable(),
  contentType: z.string(),
  title: z.string(),
  status: z.string()
})
```

**Key Differences**:
1. API makes most fields optional (for partial responses)
2. API uses `.url()` refinement on url field
3. API uses enum for status, Drizzle uses string
4. Drizzle reflects database nullability (`.nullable()`)

### Device Schema Comparison

**API Schema (`deviceSchema`)**:
```typescript
z.object({
  deviceId: z.string(),
  name: z.string(),
  systemName: z.string(),
  systemVersion: z.string(),
  token: z.string(),
  endpointArn: z.string().optional()
})
```

**Drizzle Schema (`deviceSelectSchema`)**:
```typescript
// Generated from devices table - all fields required
z.object({
  deviceId: z.string(),
  name: z.string(),
  token: z.string(),
  systemVersion: z.string(),
  systemName: z.string(),
  endpointArn: z.string()
})
```

**Key Differences**:
1. API makes `endpointArn` optional (not available before SNS registration)
2. Drizzle requires all fields (database column is NOT NULL)

## Consolidation Options

### Option A: Derive API from Drizzle (Not Recommended)

Use `.pick()` and `.extend()` on drizzle-zod schemas to create API schemas:

```typescript
import {fileSelectSchema} from '#lib/vendor/Drizzle/zod-schemas'

export const fileApiSchema = fileSelectSchema
  .partial()  // Make all optional
  .extend({
    url: z.string().url().optional()  // Add refinement
  })
```

**Pros**:
- Single source of truth for field names
- Database changes automatically reflected

**Cons**:
- API shape becomes tightly coupled to database schema
- Loses TypeSpec as the API contract definition
- Complex transformations for nullable vs optional
- Makes API evolution harder (can't add API-only fields easily)

### Option B: Keep Separate (Recommended)

Maintain distinct schema sources:
- **TypeSpec**: API contract (what clients see)
- **Drizzle-Zod**: Database validation (internal consistency)

**Pros**:
- Clear separation of concerns (API vs persistence)
- TypeSpec remains authoritative for API contract
- Each schema optimized for its purpose
- Easier to evolve API independently of database

**Cons**:
- Potential drift between API and DB types
- Manual sync required when fields change

### Option C: Shared Primitives (Partial Consolidation)

Share base primitives and enums while keeping schemas separate:

```typescript
// Shared primitives
export const fileIdSchema = z.string()
export const fileStatusSchema = z.enum(['Queued', 'Downloading', 'Downloaded', 'Failed'])

// API uses primitives
export const fileApiSchema = z.object({
  fileId: fileIdSchema,
  status: fileStatusSchema.optional(),
  // ...
})

// Drizzle uses primitives for refinements
export const customFileInsertSchema = createInsertSchema(files, {
  status: () => fileStatusSchema
})
```

**Pros**:
- Shared validation logic for enums and patterns
- Type consistency for common fields
- Schemas remain independent for their domains

**Cons**:
- Requires manual coordination
- Adds indirection layer

## Recommendation

**Keep schemas separate (Option B)** for the following reasons:

1. **Different purposes**: API schemas validate client contracts; Drizzle schemas ensure database integrity. Coupling them creates maintenance burden.

2. **TypeSpec authority**: The project uses TypeSpec as the API specification source. Replacing it with derived schemas would lose the explicit contract definition.

3. **Flexibility**: API responses may intentionally differ from database rows (e.g., computed fields, omitted internal fields, different nullability).

4. **Risk mitigation**: Accidental database schema changes shouldn't automatically break the API contract.

### When to Revisit

Consider consolidation if:
- The project adds many new entities with 1:1 API-to-DB mapping
- TypeSpec is abandoned as the API specification source
- Drift between schemas becomes a maintenance burden

## Implementation Actions

No changes required. The current dual-source approach is appropriate:

1. **API validation**: Continue using TypeSpec-generated schemas
2. **Database validation**: Use drizzle-zod schemas (newly added)
3. **Runtime checks**: Entity query functions now validate inserts/updates

## Future Considerations

1. **Status enum consolidation**: Consider using `fileStatusSchema` from API schemas in Drizzle insert validation for type safety.

2. **Cross-layer validation**: Lambda handlers could validate both:
   - Request body against API schema
   - Entity input against Drizzle schema (now implemented)

3. **Schema documentation**: Generate schema documentation from both sources for API consumers.
