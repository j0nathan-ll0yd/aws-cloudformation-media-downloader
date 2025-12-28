# ADR-0011: Type Organization Rules

## Status
Accepted

## Date
2025-12-17

## Context

TypeScript type definitions were scattered inconsistently:
- Some inline in Lambda handlers
- Some in separate `types.ts` files per Lambda
- Some in a global `types/` directory
- Duplicate types across Lambdas

This caused:
- Difficulty finding types
- Duplication and drift
- Unclear import paths
- Maintenance burden

## Decision

Establish clear rules for type location based on usage scope.

### 3+ Type Threshold
When a file has **3 or more exported types**, extract to `src/types/`.

### Type Location Rules

| Scenario | Location | Rationale |
|----------|----------|-----------|
| Single-use, simple types (1-2) | Inline in file | Reduces navigation |
| 3+ types in one file | `src/types/` | Discoverability |
| Re-exported types | `src/types/` | Single source of truth |
| Complex types | `src/types/` | Maintainability |
| Entity types | With entity definition | Co-location |
| Lambda-specific types | Lambda directory | Isolation |

### Type File Organization

```
src/types/
├── domain-models.d.ts    # User, File, Device
├── request-types.d.ts    # *Input types for APIs
├── response-types.d.ts   # *Response types
├── notification-types.d.ts
├── persistence-types.d.ts
├── infrastructure-types.d.ts
└── enums.ts              # FileStatus, UserStatus
```

### Naming Patterns

| Pattern | Usage | Examples |
|---------|-------|----------|
| Simple nouns | Domain entities | `User`, `File`, `Device` |
| `*Item` | Entity row types | `UserItem`, `FileItem` |
| `*Input` | Request payloads | `UserLoginInput`, `CreateFileInput` |
| `*Response` | API responses | `FileResponse`, `LoginResponse` |
| `*Error` | Error classes | `AuthorizationError` |

### Enum Values (PascalCase)
```typescript
enum FileStatus {
  Queued = 'Queued',
  Downloading = 'Downloading',
  Downloaded = 'Downloaded',
  Failed = 'Failed'
}
```

## Consequences

### Positive
- Clear rules for where types belong
- Easy to find types
- Single source of truth for shared types
- Consistent naming patterns
- IDE autocomplete works well

### Negative
- Requires refactoring existing types
- May move types between locations as usage grows
- Some judgment calls on "complex enough"

## Enforcement

- MCP rule: `types-location` (HIGH severity)
- Code review: Verify type placement follows rules

## Related

- [Type Definitions](../TypeScript/Type-Definitions.md) - Implementation guide
- [Naming Conventions](../Conventions/Naming-Conventions.md) - Naming patterns
