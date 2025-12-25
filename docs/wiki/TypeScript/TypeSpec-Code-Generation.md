# TypeSpec-to-Runtime Code Generation

This script automatically generates TypeScript types and Zod schemas from TypeSpec API definitions.

## Overview

The `gen:api-types` script bridges the gap between API contract definitions in TypeSpec and runtime TypeScript types, ensuring the TypeSpec definitions are the single source of truth.

## What It Does

1. **Compiles TypeSpec to OpenAPI 3.0** - Runs `pnpm typespec:compile` to generate `tsp-output/openapi.yaml`
2. **Generates TypeScript Types** - Uses quicktype to create TypeScript interfaces from OpenAPI
3. **Generates Zod Schemas** - Creates runtime validation schemas for request/response types
4. **Outputs to** `src/types/api-schema/` directory

## Usage

```bash
# Generate API types and schemas
pnpm gen:api-types
```

## Output Files

- `src/types/api-schema/types.ts` - TypeScript type definitions (auto-generated)
- `src/types/api-schema/schemas.ts` - Zod validation schemas (auto-generated)

## Integration Points

### Lambda Handlers

Import generated schemas for runtime validation:

```typescript
import {registerDeviceSchema, type RegisterDeviceInput} from '#types/api-schema/schemas'

export const handler = async (event: APIGatewayProxyEvent) => {
  // Validate request body
  const result = registerDeviceSchema.safeParse(JSON.parse(event.body || '{}'))
  
  if (!result.success) {
    return buildApiResponse(400, {error: result.error.message})
  }
  
  const input: RegisterDeviceInput = result.data
  // ... handler logic
}
```

### Type Imports

Import types for type safety:

```typescript
import type {File, FileListResponse} from '#types/api-schema/types'

function processFiles(files: File[]): FileListResponse {
  return {contents: files}
}
```

## When to Regenerate

Run `pnpm gen:api-types` after:
- Modifying TypeSpec definitions in `tsp/`
- Adding new API operations
- Changing request/response schemas
- Updating enum values

## TypeSpec Sources

The generation process reads from:
- `tsp/main.tsp` - Main API definition
- `tsp/models/models.tsp` - Data model definitions
- `tsp/operations/operations.tsp` - API operation definitions

## Benefits

1. **Single Source of Truth** - TypeSpec definitions drive both documentation and implementation
2. **Compile-Time Safety** - Changes in TypeSpec immediately cause type errors in implementation
3. **Runtime Validation** - Zod schemas provide runtime type checking
4. **Reduced Drift** - Manual type definitions can't drift from API contract

## CI/CD Integration

Consider adding to CI pipeline:

```yaml
- name: Generate API types
  run: pnpm gen:api-types

- name: Check for uncommitted changes
  run: git diff --exit-code src/types/api-schema/
```

This ensures generated types are always up-to-date with TypeSpec definitions.

## Troubleshooting

### TypeSpec Compilation Fails

Check that TypeSpec definitions are valid:

```bash
pnpm run typespec:check
```

### Generated Types Are Empty

Verify OpenAPI output exists:

```bash
ls -la tsp-output/openapi.yaml
```

### Import Errors

Ensure import paths are configured in `package.json`:

```json
"imports": {
  "#types/*": "./src/types/*"
}
```

## Related Documentation

- [TypeSpec Documentation](https://typespec.io/)
- [Zod Documentation](https://zod.dev/)
- [OpenAPI 3.0 Specification](https://swagger.io/specification/)
- [Project TypeSpec Examples](../tsp/examples/)

## Future Enhancements

Planned improvements:
- [ ] Auto-generate on TypeSpec file changes
- [ ] Generate API client from TypeSpec
- [ ] Integrate with Lambda powertools for automatic validation
- [ ] Generate fixture data from TypeSpec examples
