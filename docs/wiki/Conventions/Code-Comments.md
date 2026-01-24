# Code Comments

## Quick Reference
- **When to use**: Writing or reviewing code comments
- **Enforcement**: MCP Rule + ESLint + Code Review
- **Impact if violated**: HIGH - Inconsistent documentation and confusion

## The Rule

**Git history is the source of truth for code evolution. Comments explain WHY, not WHAT.**

NEVER explain removed code in comments. Delete outdated comments about previous implementations, deprecated features, or removed architecture. Use `git log` and `git blame` to understand historical context.

## Table of Contents

1. [Core Principles](#core-principles)
2. [Comment Types](#comment-types)
3. [JSDoc/TSDoc Standards](#jsdoctsdoc-standards)
4. [File Headers](#file-headers)
5. [Single-Line Comments](#single-line-comments)
6. [Comment Placement & Spacing](#comment-placement--spacing)
7. [Function Spacing](#function-spacing)
8. [@example and @see/@link](#example-and-seelink)
9. [Type & Interface Documentation](#type--interface-documentation)
10. [Entity Documentation](#entity-documentation)
11. [Coverage Ignore Patterns](#coverage-ignore-patterns)
12. [Terraform Comments](#terraform-comments)
13. [Test File Comments](#test-file-comments)
14. [Comment Density](#comment-density)

---

## Core Principles

1. **Git Is Source of Truth** - Removed code -> Check git history
2. **Comments Explain "Why," Not "What"** - Code shows WHAT, comments explain WHY
3. **Delete, Don't Deprecate** - Remove dead code completely, trust version control

---

## Comment Types

| Type | Syntax | Use Case | Example |
|------|--------|----------|---------|
| **JSDoc Block** | `/** */` | Functions, interfaces, classes, type aliases | Parameter docs, return types |
| **Single-line** | `//` | Inline explanations, brief context | Business logic "why" |
| **Coverage Ignore** | `/* c8 ignore */` | Skip coverage for specific lines/blocks | AWS SDK wrappers |
| **Format Override** | `// fmt: multiline` | Force multiline arrays/objects | Test fixtures |
| **dprint Ignore** | `// dprint-ignore` | Skip formatting for statement | Matrix data |

---

## JSDoc/TSDoc Standards

### Required For
- All exported functions with business logic
- All internal helper functions (with `@notExported` tag)
- All interfaces and type aliases
- Lambda handler entry points (with `@label` tag)

### NOT Required For (Self-Documenting)
- **AWS vendor wrapper files** (`src/lib/vendor/AWS/*.ts`) - These are thin pass-through wrappers by design
- **Thin wrapper functions** (5 lines or fewer body)
- **Simple utility functions** with self-documenting signatures (for example, `stringAttribute(value: string): MessageAttributeValue`)
- **Functions with c8 ignore comments** that already explain purpose (for example, `/* c8 ignore start - Pure AWS SDK wrapper */`)
- **Re-export barrel files** (index.ts with only exports)

### Format

```typescript
/**
 * Brief description of what the function does.
 *
 * Additional context explaining WHY, if needed.
 *
 * @param paramName - Description of parameter
 * @returns Description of return value
 * @throws {ErrorType} When this error occurs
 * @notExported
 */
```

### Rules
- **Hyphen required** after `@param` name (TSDoc standard): `@param name - Description`
- **No types in JSDoc** (TypeScript provides types)
- **Don't restate parameter names** as descriptions

### Good JSDoc Example

```typescript
/**
 * Validates user credentials against the authentication service.
 *
 * Uses Better Auth for OAuth token validation.
 *
 * @param username - User's email or username
 * @param password - Plain text password (will be hashed)
 * @returns Promise resolving to authenticated user or null
 * @throws {AuthenticationError} If service is unavailable
 */
async function authenticate(username: string, password: string): Promise<User | null>
```

---

## File Headers

### Required For
All Lambda source files (`src/lambdas/*/src/index.ts`)

### Format

```typescript
/**
 * [LambdaName] Lambda
 *
 * [1-2 sentence description of what this Lambda does]
 *
 * Trigger: [API Gateway | S3 Event | CloudWatch Schedule | Lambda Invoke]
 * Input: [Brief description of event source]
 * Output: [Brief description of response/effect]
 */
```

### Example

```typescript
/**
 * FileCoordinator Lambda
 *
 * Orchestrates file downloads by querying pending and scheduled downloads,
 * then invoking StartFileUpload for each in batches.
 *
 * Trigger: CloudWatch Schedule (every 5 minutes)
 * Input: ScheduledEvent
 * Output: Void (initiates downstream Lambda invocations)
 */
```

### Not Required For
- Test files (use test-specific headers for integration tests)
- Utility files (self-documenting)
- Entity files (use entity documentation pattern instead)

---

## Single-Line Comments

### Style Rules

| Rule | Status | Example |
|------|--------|---------|
| Space after `//` | **Required** | `// Comment` not `//Comment` |
| Capitalize first letter | **Preferred** | Lowercase OK for very short notes |
| No period for single sentences | **Required** | `// This is a comment` |
| Period for multi-sentence | **Required** | `// First sentence. Second sentence.` |
| Blank line before comment blocks | **Preferred** | For 2+ line comments |

### Good Examples

```typescript
// Parallelize independent operations for ~60% latency reduction
// Use Promise.allSettled to handle partial failures gracefully
const results = await Promise.allSettled([op1(), op2()])

// Extract userId from JWT claims
const userId = claims.sub

// ok for simple notes
const x = getX()
```

### Bad Examples

```typescript
//no space after slash
// Ends with period for single sentence.
```

---

## Comment Placement & Spacing

| Placement | Rule |
|-----------|------|
| JSDoc before function | No blank line between JSDoc and function |
| Blank line before JSDoc | Yes, if not at file start |
| Single-line comment | Directly above code it describes |
| Inline comment (same line) | Use sparingly, for very brief notes |
| Blank line before comment block | Yes, for 2+ line comments |

---

## Function Spacing

**Core Principle:** Blank lines separate logical concerns, not individual statements.

See [Function Spacing](Function-Spacing.md) for detailed rules.

### Quick Reference

| Situation | Pattern |
|-----------|---------|
| Simple sequential ops (1-5 lines) | No blanks |
| Variable initialization -> logic | Blank after variables |
| Guard clause (early return) | No blank before |
| Distinct logical phases | Blank between phases |
| Try-catch block | No blank before try |
| Multiple if-branches (all return) | Blank between |
| Comments introducing sections | Blank before comment |
| Before return statements | Blank only if complex |

### Good Example (Logical Phases)

```typescript
async function download(event: Event) {
  // Phase 1: Setup
  const fileId = event.fileId
  const url = buildUrl(fileId)

  // Phase 2: Fetch
  const data = await fetch(url)

  // Phase 3: Store and return
  await save(data)
  return buildResponse(data)
}
```

### Bad Example (Unnecessary Spacing)

```typescript
async function simple() {
  const result = getValue()

  logDebug('result', result)  // No blank needed - sequential ops

  return result  // No blank needed - simple return
}
```

---

## @example and @see/@link

**Rule:** Keep source code comments concise; detailed examples go in wiki.

### When to Use @example in Source
- Very short examples (1-3 lines max)
- Essential for understanding the function signature

### When to Use @see/@link Instead
- Examples longer than 3 lines
- Multiple usage patterns to show
- Examples that need prose explanation

### Format

```typescript
/**
 * Brief description of function.
 *
 * @param name - Parameter description
 * @returns Return description
 * @see {@link https://github.com/owner/repo/wiki/PageName | Detailed Examples}
 */
```

### Migration Pattern

```typescript
// BEFORE (messy in source)
/**
 * Wraps an API handler...
 * @example
 * ```typescript
 * export const handler = wrapApiHandler(async ({event}) => {
 *   // 10+ lines of example code cluttering source
 * })
 * ```
 */

// AFTER (clean in source, detailed in wiki)
/**
 * Wraps an API handler with error handling and logging.
 * @see {@link https://github.com/.../wiki/Lambda-Middleware-Patterns | Usage Examples}
 */
```

---

## Type & Interface Documentation

### File-Level Documentation Required For
- All type definition files in `src/types/`
- Include purpose and @see tags to related implementations

### Interface-Level JSDoc Required For
- All exported interfaces
- All exported type aliases

### Property-Level Documentation Required For
- Properties with non-obvious names
- Optional properties (explain when undefined vs null)
- Properties with constraints (min/max values, format requirements)

### Exemplary Type Files
- `src/types/video.ts` - File-level JSDoc with @see tags + property-level inline comments
- `src/types/util.ts` - File-level context with implementation references + type-level JSDoc

### Example

```typescript
/**
 * Configuration for exponential backoff retry behavior.
 *
 * @see {@link calculateExponentialBackoff} for usage
 */
interface RetryConfig {
  /** Maximum retry attempts before permanent failure (default: 5) */
  maxRetries: number
  /** Base delay in seconds between retries (default: 900) */
  baseDelaySeconds: number
  /** Maximum delay cap in seconds (default: 14400) */
  maxDelaySeconds: number
  /** Whether to add jitter to prevent thundering herd (default: true) */
  addJitter?: boolean
}
```

---

## Entity Documentation

**Reference Standards:** `Collections.ts` and `FileDownloads.ts`

### Required Sections

1. **Purpose** - One-line description
2. **Design philosophy** - Why structured this way (if non-obvious)
3. **Lifecycle** - State transitions (if applicable)
4. **Related entities** - @see tags to related entities
5. **Index usage** - Which GSIs this entity uses and why

### Example

```typescript
/**
 * Devices entity for push notification registrations.
 *
 * Manages Apple Push Notification Service (APNS) endpoint associations.
 * Each device has a unique deviceToken from iOS and an SNS endpointArn.
 *
 * Lifecycle:
 * 1. Created when user registers device (RegisterDevice Lambda)
 * 2. Updated when device token changes (app reinstall)
 * 3. Deleted when user unregisters or device goes stale (PruneDevices Lambda)
 *
 * @see UserDevices for user-device associations
 * @see SendPushNotification Lambda for notification delivery
 */
```

### Entity Tiers

| Tier | Description | Examples |
|------|-------------|----------|
| **Tier 1: COMPREHENSIVE** | Multi-paragraph docs, usage patterns, @see tags | Collections.ts, FileDownloads.ts |
| **Tier 2: GOOD** | Design philosophy, partial property docs | Files.ts, UserFiles.ts |
| **Tier 3: MINIMAL** | Single-line, needs improvement | Users.ts, Devices.ts |

---

## Coverage Ignore Patterns

### Standard Format

```typescript
/* c8 ignore start - [reason] */
// ... code to ignore
/* c8 ignore stop */

// Or for single lines:
/* c8 ignore next */
const unreachableBranch = ...

// Or for else branches:
/* c8 ignore else */
if (condition) { ... }
```

### When to Use
- AWS SDK wrapper functions (tested via integration tests)
- Unreachable error branches
- Environment-specific code paths

---

## Terraform Comments

### Style
- Use `#` for all comments (not `/* */`)
- Document GSI access patterns with usage examples
- Document IAM policy rationale
- **Unique descriptions** for each Lambda resource (no copy-paste)

### Format

```hcl
# [AccessPatternName]: [What it queries]
# Access pattern: "[Human-readable description]"
# Used by: [Lambda1, Lambda2, ...]
```

### Example

```hcl
# UserCollection: Query all resources by userId (files, devices)
# Access pattern: "Get all files and devices for a user"
# Used by: ListFiles, UserDelete, RegisterDevice
attribute {
  name = "gsi1pk"
  type = "S"
}
```

---

## Test File Comments

### File-Level Header (Required for Integration Tests)

```typescript
/**
 * [TestName] Integration Tests
 *
 * Tests the [workflow] against LocalStack:
 * 1. [Step 1]
 * 2. [Step 2]
 *
 * Validates:
 * - [Validation point 1]
 * - [Validation point 2]
 */
```

### Mock Setup Comments (Recommended)

```typescript
// Mock [EntityName] queries ([purpose])
vi.mock('#entities/queries', () => ({getUser: vi.fn(), createUser: vi.fn()}))
```

---

## Comment Density

### Guidelines
- **Target:** 8-12% comment lines to code lines
- **Low density files:** Add JSDoc to undocumented functions
- **High density files:** Review for redundant comments
- **Measurement:** Use SonarQube or `pnpm run validate:conventions`

---

## What NOT to Comment

### Forbidden Patterns

```typescript
// We used to validate email here but moved it to middleware
// Previously this used callbacks, now uses promises
// Old version - keep for reference
// v1.0: Initial, v1.1: Added caching, v2.0: Removed caching
// Increment counter by 1
counter++;
```

### Why These Are Bad
- **Removed code explanations** - Use git history
- **Version history** - Use git log
- **Obvious operations** - Code is self-documenting
- **TODO without context** - Use ticket links

---

## Git Commands for History

Instead of comments about removed code:

```bash
# See file history
git log -p path/to/file.ts

# See who changed what
git blame path/to/file.ts

# Find when something was removed
git log -p -S "removed text" path/to/file.ts

# See specific commit
git show <commit-hash>
```

---

## Enforcement

### Automated
- **MCP Rule** (`comment-conventions`): Validates file headers, JSDoc presence, @example length
- **ESLint** (`eslint-plugin-jsdoc`): @param format, @returns, hyphen
- **CI Pipeline**: Full validation on every PR

### Code Review Checklist
- [ ] No commented-out code
- [ ] No "removed" explanations
- [ ] No version history in comments
- [ ] TODOs have context/tickets
- [ ] Comments explain "why" not "what"
- [ ] Lambda files have headers
- [ ] Exported functions have JSDoc
- [ ] @param uses hyphen format

---

## Related Patterns

- [Function Spacing](Function-Spacing.md) - Blank line rules within functions
- [Lambda Middleware Patterns](../TypeScript/Lambda-Middleware-Patterns.md) - Usage examples for wrapApiHandler
- [Git Workflow](Git-Workflow.md) - Using Git effectively
- [Naming Conventions](Naming-Conventions.md) - Self-documenting code
- [Code Formatting](Code-Formatting.md) - dprint and `// fmt: multiline`

---

*Remember: The code shows WHAT, comments explain WHY, and Git shows HOW it evolved. Keep comments focused on the present implementation's reasoning, not its history.*
