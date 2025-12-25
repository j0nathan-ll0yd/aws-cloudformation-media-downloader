# Semantic Diff Test Fixtures

These fixtures demonstrate various code changes for testing the `diff_semantic` MCP tool.

## Files

- `base-functions.ts` - The "before" state
- `head-functions.ts` - The "after" state

## Expected Changes

### Breaking Changes (should fail CI)

| Change Type | Symbol | Description |
|-------------|--------|-------------|
| function_removed | `deprecatedFunction` | Exported function removed |
| parameter_added | `processData` | Required parameter added |
| interface_modified | `UserConfig` | Required field `role` added |
| type_alias_changed | `Status` | Type definition widened |
| export_removed | `API_VERSION` | Constant removed |

### Non-Breaking Changes (should pass CI)

| Change Type | Symbol | Description |
|-------------|--------|-------------|
| function_added | `newFeature` | New exported function |
| parameter_added | `formatOutput` | Optional parameter added |
| interface_modified | `Settings` | Optional field `darkMode` added |
| export_added | `API_ENDPOINT` | New constant added |

### Unchanged

| Symbol | Notes |
|--------|-------|
| `stableFunction` | No changes detected |

## Usage

These fixtures can be used to verify the semantic diff tool detects:
1. All breaking changes correctly
2. All non-breaking changes correctly
3. Unchanged symbols are not reported

```typescript
// Example test
const base = parseAtRef(baseContent, 'base-functions.ts')
const head = parseAtRef(headContent, 'head-functions.ts')
const changes = compareSymbols(extractExportedSymbols(base), extractExportedSymbols(head), 'test.ts')

expect(changes.filter(c => c.breaking)).toHaveLength(5)
expect(changes.filter(c => !c.breaking)).toHaveLength(4)
```
