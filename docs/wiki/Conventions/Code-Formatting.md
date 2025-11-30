# Code Formatting

## Quick Reference
- **When to use**: Understanding and overriding automatic code formatting
- **Formatter**: dprint (TypeScript plugin)
- **Config file**: `dprint.json`
- **Enforcement**: Automatic - `pnpm run format`

## The Rule

**Let the formatter handle formatting, with targeted overrides when readability suffers.**

This project uses [dprint](https://dprint.dev/) for code formatting. The formatter makes most decisions automatically based on line width (157 characters). Use the techniques below only when the automatic formatting harms readability.

## Key Configuration

| Setting | Value | Effect |
|---------|-------|--------|
| `lineWidth` | 157 | Maximum line length before wrapping |
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

## Type Aliases for Line Width Management

### The Problem

Function signatures with multiple parameters, long return types, or complex generics can exceed the line width limit, causing dprint to wrap them across multiple lines:

```typescript
// Wrapped due to length - loses visual clarity
export async function createUserSession(
  userId: string,
  deviceId?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{token: string; expiresAt: number; sessionId: string}> {
```

### The Solution: Extract Type Aliases

Create type aliases for return types or parameter groups to keep signatures under the line width:

```typescript
// Type alias keeps the signature on one line
type SessionResult = {token: string; expiresAt: number; sessionId: string}

export async function createUserSession(userId: string, deviceId?: string, ipAddress?: string, userAgent?: string): Promise<SessionResult> {
```

### Guidelines

**When to create type aliases:**
- Function signature exceeds 157 characters
- Return type is complex (multiple properties)
- Generic type parameter is verbose
- Multiple functions share the same type

**When NOT to use type aliases:**
- Type is used only once and is self-explanatory
- Alias would obscure the actual type
- Signature already fits on one line

### Examples

#### Return Type Extraction

```typescript
// Before: 175 characters, wraps
export async function getResourceDetails(id: string): Promise<{userId: string; fileId: string; metadata: Record<string, unknown>}> {

// After: 89 characters, stays on one line
type ResourceDetails = {userId: string; fileId: string; metadata: Record<string, unknown>}

export async function getResourceDetails(id: string): Promise<ResourceDetails> {
```

#### Parameter Type Extraction

```typescript
// Before: Parameters cause wrapping
export function validateRequest(
  requestBody: Webhook | DeviceRegistrationRequest | UserRegistration | UserSubscribe | UserLogin,
  schema: Joi.ObjectSchema
): void {

// After: Union type extracted
type RequestPayload = Webhook | DeviceRegistrationRequest | UserRegistration | UserSubscribe | UserLogin

export function validateRequest(requestBody: RequestPayload, schema: Joi.ObjectSchema): void {
```

#### Generic Type Simplification

```typescript
// Before: Long generic wraps
export function captureAWSClient<T extends {
  middlewareStack: {remove: unknown; use: unknown};
  config: unknown
}>(client: T): T {

// After: Collapsed to one line (111 chars, fits)
export function captureAWSClient<T extends {middlewareStack: {remove: unknown; use: unknown}; config: unknown}>(client: T): T {
```

### Naming Conventions for Type Aliases

- **Result types**: `[Function]Result` - `SessionResult`, `ValidationResult`
- **Input types**: `[Function]Input` or `[Entity]Payload` - `RequestPayload`, `CreateUserInput`
- **Configuration types**: `[Feature]Config` - `AuthConfig`, `CacheConfig`

### Trade-offs

| Type Alias | Inline Type |
|------------|-------------|
| Reusable | Single use |
| Named (self-documenting) | Immediately visible |
| Shorter signatures | All info in one place |
| Requires navigation to understand | No navigation needed |

**Prefer type aliases when:**
- Type is complex (3+ properties)
- Type is reused
- Signature would exceed line width

**Prefer inline types when:**
- Type is simple (1-2 properties)
- Type is used once
- Signature fits comfortably

## Sequential Mock Return Values

### The Problem

When configuring multiple return values with `mockResolvedValueOnce`, method chaining can exceed line width and wrap awkwardly:

```typescript
// Chained - dprint wraps mid-chain (ugly, inconsistent)
mockOperation.mockResolvedValueOnce({data: ['page1'], cursor: 'cursor1'}).mockResolvedValueOnce({
  data: ['page2'],
  cursor: 'cursor2'
}).mockResolvedValueOnce({data: ['page3'], cursor: null})
```

### The Solution: Separate Statements

Use separate statements instead of chaining. `mockResolvedValueOnce` queues return values internally—chaining is syntactic sugar, not required:

```typescript
// Separate statements - clean, consistent, dprint-stable
mockOperation.mockResolvedValueOnce({data: ['page1'], cursor: 'cursor1'})
mockOperation.mockResolvedValueOnce({data: ['page2'], cursor: 'cursor2'})
mockOperation.mockResolvedValueOnce({data: ['page3'], cursor: null})
```

### Why It Works

1. **Readability** - Each return value on its own line, clear sequence
2. **dprint stability** - Separate statements won't collapse or wrap mid-chain
3. **Consistent** - Same visual structure regardless of content length

### Pattern

```typescript
// Type alias for the mock function signature
type ScanFn<T> = (cursor?: string) => Promise<{data: T[]; cursor: string | null}>

it('should paginate through multiple pages', async () => {
  // Declare mock with type
  const mockScan = jest.fn<ScanFn<string>>()

  // Configure sequential returns as separate statements
  mockScan.mockResolvedValueOnce({data: ['item1', 'item2'], cursor: 'cursor1'})
  mockScan.mockResolvedValueOnce({data: ['item3', 'item4'], cursor: 'cursor2'})
  mockScan.mockResolvedValueOnce({data: ['item5'], cursor: null})

  const result = await scanAllPages(mockScan)
  // ...assertions
})
```

### When to Apply

- **Always** for `mockResolvedValueOnce` sequences (2+ calls)
- **Always** for `mockReturnValueOnce` sequences (2+ calls)
- Single `mockResolvedValue` or `mockReturnValue` can stay on same line as mock declaration

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
