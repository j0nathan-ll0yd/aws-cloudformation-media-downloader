# Template Organization

Code templates and fixtures must be stored in external files, not embedded as string literals in source code.

## Rule

| Aspect | Requirement |
|--------|-------------|
| Location | `src/mcp/templates/` for MCP handlers |
| Format | `.template.txt` extension |
| Loading | Use `loadTemplate()` or `loadAndInterpolate()` |

## Why This Matters

1. **Maintainability**: Templates are easier to read and modify than string literals
2. **Testability**: Templates can be tested independently
3. **Separation of Concerns**: Generator logic separate from template content
4. **Readability**: Generator code stays clean without embedded multi-line strings

## Template Location

```
src/mcp/templates/
├── loader.ts                           # Template loading utilities
├── test-scaffold/
│   ├── entity-mock.template.txt        # Drizzle query mock setup
│   ├── vendor-mock.template.txt        # Vendor wrapper mock
│   ├── test-structure.template.txt     # Test file structure
│   └── describe-block.template.txt     # Test describe blocks
└── convention-fix/
    ├── aws-sdk-wrapper.template.txt    # AWS SDK replacement
    └── response-helper.template.txt    # Response helper fix
```

## Template Loader API

### Basic Loading

```typescript
import {loadTemplate} from '#mcp/templates/loader'

// Load raw template
const template = loadTemplate('test-scaffold/entity-mock.template.txt')
```

### Interpolation

```typescript
import {loadAndInterpolate} from '#mcp/templates/loader'

// Load and replace placeholders
const code = loadAndInterpolate('test-scaffold/entity-mock.template.txt', {
  entityName: 'Files',
  mockMethods: 'get, query, create'
})
```

## Template Syntax

Templates use `{{placeholder}}` syntax:

```txt
// {{fileName}} - Drizzle query mock
import {createMock{{entityName}}} from '#test/helpers/entity-fixtures'

vi.mock('#entities/queries', () => ({
  get{{entityName}}: vi.fn().mockResolvedValue(createMock{{entityName}}()),
  create{{entityName}}: vi.fn().mockResolvedValue(createMock{{entityName}}()),
  update{{entityName}}: vi.fn().mockResolvedValue(createMock{{entityName}}())
}))
```

## Anti-Pattern: Embedded Templates

```typescript
// WRONG - Embedded string literal
function generateMock(entityName: string) {
  return `
import {createMock${entityName}} from '#test/helpers/entity-fixtures'

vi.mock('#entities/queries', () => ({
  get${entityName}: vi.fn()
}))
`
}
```

```typescript
// CORRECT - External template
function generateMock(entityName: string) {
  return loadAndInterpolate('test-scaffold/entity-mock.template.txt', {
    entityName,
    queryIndexes: '[]'
  })
}
```

## Template Guidelines

### Naming

- Use descriptive names: `entity-mock.template.txt` not `mock.txt`
- Group by feature: `test-scaffold/`, `convention-fix/`

### Content

- Include comments for context
- Use consistent placeholder naming (camelCase)
- Keep templates focused on single purpose

### Testing

```typescript
describe('entity-mock template', () => {
  test('generates valid TypeScript', () => {
    const code = loadAndInterpolate('test-scaffold/entity-mock.template.txt', {
      entityName: 'Files',
      queryIndexes: "'byKey', 'byUser'"
    })

    expect(code).toContain('FilesMock')
    expect(code).toContain("queryIndexes: ['byKey', 'byUser']")
  })
})
```

## Enforcement

| Method | Status | Notes |
|--------|--------|-------|
| Code Review | Active | Check for embedded templates |
| MCP Rule | Future | Could detect string literals > N lines |

## Migration

When you find embedded templates:

1. Extract to `.template.txt` file
2. Replace with `loadAndInterpolate()` call
3. Add test for template output
4. Update imports if needed
