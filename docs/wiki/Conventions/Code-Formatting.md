# Code Formatting

## Quick Reference
- **When to use**: Understanding and overriding automatic code formatting
- **Formatter**: dprint (TypeScript plugin)
- **Config file**: `dprint.json`
- **Enforcement**: Automatic - `pnpm run format`

## The Rule

**Let the formatter handle formatting, with targeted overrides when readability suffers.**

This project uses [dprint](https://dprint.dev/) for code formatting. The formatter makes most decisions automatically based on line width (156 characters). Use the techniques below only when the automatic formatting harms readability.

## Key Configuration

| Setting | Value | Effect |
|---------|-------|--------|
| `lineWidth` | 156 | Maximum line length before wrapping |
| `semiColons` | "asi" | No semicolons (automatic semicolon insertion) |
| `quoteStyle` | "preferSingle" | Single quotes for strings |
| `trailingCommas` | "never" | No trailing commas |
| `objectExpression.preferSingleLine` | true | Objects on one line when possible |
| `arrayExpression.preferSingleLine` | false | Arrays expand to multiline |
| `arguments.preferHanging` | "always" | First argument on same line as function |

## Multiline Formatting Hint

### The Problem

When dprint wraps arrays/objects that exceed line width, it uses a "best fit" algorithm that can create ugly mixed inline/multiline formatting:

```typescript
// dprint's default - first elements inline, then wrap
const items = [{id: 1, name: 'first'}, {id: 2, name: 'second'}, {
  id: 3,
  name: 'third'
}]
```

### The Solution: `// fmt: multiline`

Add `// fmt: multiline` after the first element to force consistent multiline formatting:

```typescript
// Clean, consistent multiline
const items = [
  {id: 1, name: 'first'}, // fmt: multiline
  {id: 2, name: 'second'},
  {id: 3, name: 'third'}
]
```

### Why It Works

Line comments (`//`) cannot be collapsed to a single line. dprint must keep the line break, which triggers full multiline formatting for the entire expression.

### When to Use

Use `// fmt: multiline` when:
- An array/object wraps with some elements inline and others multiline
- The mixed formatting harms readability
- Elements are similar and should be visually aligned

Do NOT use when:
- The expression fits on one line (let dprint keep it compact)
- The multiline format is already clean
- Adding the comment would be the only thing preventing single-line

### Examples

#### Arrays of Similar Objects

```typescript
// Test fixtures with consistent structure
const mockDevices = [
  {deviceId: 'device-1', userId: 'user-123'}, // fmt: multiline
  {deviceId: 'device-2', userId: 'user-456'},
  {deviceId: 'device-3', userId: 'user-789'}
]

// Metrics with consistent structure
await putMetrics([
  {name: 'Success', value: 1, unit: 'Count'}, // fmt: multiline
  {name: 'Duration', value: duration, unit: 'Seconds'},
  {name: 'FileSize', value: fileSize, unit: 'Bytes'}
])
```

#### Configuration Arrays

```typescript
// DynamoDB indexes
indexes: [
  {name: 'Primary', pk: 'pk', sk: 'sk'}, // fmt: multiline
  {name: 'GSI1', pk: 'gsi1pk', sk: 'gsi1sk'},
  {name: 'GSI2', pk: 'gsi2pk', sk: 'gsi2sk'}
]
```

## Function Call Formatting

### Hanging Arguments

With `arguments.preferHanging: "always"`, when function arguments must wrap, the first argument stays on the same line as the function name:

```typescript
// Function name and first argument together (good context)
jest.unstable_mockModule('#lib/vendor/AWS/SNS',
  () => ({deleteEndpoint: jest.fn(), subscribe: jest.fn()}))

// NOT like this (loses context)
jest.unstable_mockModule(
  '#lib/vendor/AWS/SNS',
  () => ({deleteEndpoint: jest.fn(), subscribe: jest.fn()})
)
```

This keeps the function name and its primary argument visually connected.

## Complete Formatting Bypass

### `// dprint-ignore`

Skip formatting for a single statement:

```typescript
// dprint-ignore
const matrix = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1]
];
```

### `// dprint-ignore-file`

Skip formatting for an entire file (use sparingly):

```typescript
// dprint-ignore-file

// ... rest of file is not formatted
```

### When to Use Ignore

- **Matrix/grid data** - Visual alignment matters
- **Complex regex** - Manual formatting aids readability
- **Generated code** - Preserve generator's formatting
- **Temporary debugging** - Will be removed soon

## Running the Formatter

```bash
# Format all files
pnpm run format

# Check formatting without changing (CI)
pnpm run format:check

# Format specific file
npx dprint fmt path/to/file.ts
```

## Finding Format Issues

```bash
# Find potential // fmt: multiline candidates
# (arrays starting with element on same line as [, then wrapping)
grep -rn "= \[{.*}, {$" --include="*.ts" src/

# Find existing format hints
grep -rn "fmt: multiline" --include="*.ts" src/
```

## Rationale

1. **Consistency over preference** - Automated formatting eliminates style debates
2. **Targeted overrides** - Only intervene when readability suffers
3. **Self-documenting** - `// fmt: multiline` explains its purpose
4. **Searchable** - Easy to find all format hints in codebase

## Related Patterns

- [Code Comments](Code-Comments.md) - When and how to use comments
- [Naming Conventions](Naming-Conventions.md) - Variable and file naming
- [Import Organization](Import-Organization.md) - Import ordering

---

*Trust the formatter for most decisions. Use `// fmt: multiline` sparingly for arrays/objects where the automatic formatting creates inconsistent visual structure.*
