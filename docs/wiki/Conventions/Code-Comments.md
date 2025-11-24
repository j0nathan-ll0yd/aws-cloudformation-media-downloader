# Code Comments

## Quick Reference
- **When to use**: Writing or reviewing code comments
- **Enforcement**: Required - Git history is the source of truth
- **Impact if violated**: Medium - Code clutter and confusion

## The Rule

**Git history is the source of truth for code evolution.**

NEVER explain removed code in comments. Delete outdated comments about previous implementations, deprecated features, or removed architecture. Use `git log` and `git blame` to understand historical context.

## Core Principles

### 1. Git Is Source of Truth
- **Removed code** → Check git history
- **Why something changed** → Check git log
- **Who made changes** → Check git blame
- **Previous implementations** → Check git history

### 2. Comments Explain "Why", Not "What"
- **Code shows WHAT** it does
- **Comments explain WHY** it does it
- **Git shows HOW** it evolved

### 3. Delete, Don't Deprecate in Comments
- Remove dead code completely
- Don't comment out code "just in case"
- Don't leave "removed in v2" comments
- Trust version control

## Examples

### ❌ Incorrect - Explaining Removed Code

```typescript
// ❌ BAD - Explaining what was removed
class UserService {
  // We used to have a caching layer here but removed it
  // The old cache implementation was:
  // private cache: Map<string, User>;
  // But it caused memory leaks

  async getUser(id: string) {
    // Previously we checked cache first
    // return this.cache.get(id) || this.fetchUser(id);
    return this.fetchUser(id);
  }
}

// ❌ BAD - Commented out old code
function processData(data: any[]) {
  // Old implementation - DO NOT DELETE
  // for (let i = 0; i < data.length; i++) {
  //   processItem(data[i]);
  // }

  // New implementation
  data.forEach(processItem);
}

// ❌ BAD - Deprecation comments about removed features
interface Config {
  apiUrl: string;
  // timeout was removed in v2.0, use timeoutMs instead
  // timeout?: number; // DEPRECATED
  timeoutMs: number;
}
```

### ✅ Correct - Clean Code, Git History

```typescript
// ✅ GOOD - Clean, current implementation only
class UserService {
  // Direct fetch for simplicity and predictable memory usage
  async getUser(id: string) {
    return this.fetchUser(id);
  }
}

// ✅ GOOD - Only current implementation
function processData(data: any[]) {
  data.forEach(processItem);
}

// ✅ GOOD - Only current fields
interface Config {
  apiUrl: string;
  timeoutMs: number;
}

// To understand evolution, developers use:
// git log -p UserService.ts
// git blame UserService.ts
// git show <commit-hash>
```

## Appropriate Comment Types

### ✅ DO Write These Comments

#### 1. Business Logic Explanations
```typescript
// Apply 15% discount for premium members per business requirement BR-2024-01
if (user.isPremium) {
  price *= 0.85;
}
```

#### 2. Complex Algorithm Clarification
```typescript
// Using Fisher-Yates shuffle for uniform distribution
// See: https://en.wikipedia.org/wiki/Fisher-Yates_shuffle
function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
```

#### 3. Workarounds and Hacks (Temporary)
```typescript
// HACK: AWS SDK v3 has a bug with streaming uploads
// Remove this workaround after updating to v3.450+
// Issue: https://github.com/aws/aws-sdk-js-v3/issues/1234
const upload = new Upload({
  client: s3Client,
  params: uploadParams,
  partSize: 1024 * 1024 * 5, // Force 5MB parts to avoid bug
});
```

#### 4. TODOs with Context
```typescript
// TODO: Implement retry logic for transient failures
// Ticket: PROJ-123
// Owner: @teamname
async function apiCall() {
  // Current implementation without retry
}
```

#### 5. Performance Considerations
```typescript
// Pre-allocate array for 10x performance improvement
// Benchmarked on 2024-11-20: 100ms → 10ms for 10k items
const results = new Array(items.length);
```

#### 6. Security Notes
```typescript
// SECURITY: Input sanitized to prevent SQL injection
// All user input must pass through this validator
const sanitized = sanitizeSQL(userInput);
```

### ❌ DON'T Write These Comments

#### 1. Removed Code Explanations
```typescript
// ❌ We used to validate email here but moved it to middleware
```

#### 2. Old Implementation Details
```typescript
// ❌ Previously this used callbacks, now uses promises
```

#### 3. Commented-Out Code
```typescript
// ❌ Old version - keep for reference
// function oldImplementation() { }
```

#### 4. Version History
```typescript
// ❌ v1.0: Initial implementation
// ❌ v1.1: Added caching
// ❌ v2.0: Removed caching
```

#### 5. Obvious Comments
```typescript
// ❌ Increment counter by 1
counter++;

// ❌ Return the user
return user;
```

## Git Commands for History

Instead of comments about removed code, use:

```bash
# See file history
git log -p path/to/file.ts

# See who changed what
git blame path/to/file.ts

# Find when something was removed
git log -p -S "removed text" path/to/file.ts

# See specific commit
git show <commit-hash>

# See file at previous state
git show HEAD~1:path/to/file.ts

# Find deleted files
git log --diff-filter=D --summary

# Search all history for code
git grep "pattern" $(git rev-list --all)
```

## Migration Strategy

When cleaning up existing code:

### Step 1: Identify Violations
```bash
# Find commented-out code
grep -r "^[[:space:]]*\/\/" --include="*.ts" | grep -E "(function|class|const|let|var)"

# Find "removed" comments
grep -r -i "removed\|deprecated\|old implementation" --include="*.ts"

# Find TODO without context
grep -r "TODO" --include="*.ts" | grep -v "TODO.*:"
```

### Step 2: Clean Up
1. Delete commented-out code
2. Remove "removed/deprecated" comments
3. Delete version history comments
4. Keep only valuable "why" comments
5. Ensure TODOs have tickets/owners

### Step 3: Commit Appropriately
```bash
git add -A
git commit -m "chore: remove outdated comments per Git source of truth principle"
```

## Documentation Comments

### TypeDoc/JSDoc (Good)
```typescript
/**
 * Validates user credentials against the authentication service.
 *
 * @param username - User's email or username
 * @param password - Plain text password (will be hashed)
 * @returns Promise resolving to authenticated user or null
 * @throws {AuthenticationError} If service is unavailable
 * @example
 * const user = await authenticate('user@example.com', 'password123');
 */
async function authenticate(username: string, password: string): Promise<User | null> {
  // Implementation
}
```

## Special Cases

### Legal/Compliance Comments
```typescript
// Copyright (c) 2024 Company Name. All rights reserved.
// Licensed under MIT License - see LICENSE file

// GDPR: User data must be deleted within 30 days of request
```

### External API Quirks
```typescript
// Feedly API requires query params for auth (non-standard)
// Their webhook doesn't support standard Authorization header
```

### Critical Warnings
```typescript
// WARNING: Changing this value breaks iOS app compatibility
// Coordinate with mobile team before modifying
const API_VERSION = 2;
```

## Enforcement

### ESLint Rules
```json
{
  "rules": {
    "no-warning-comments": ["warn", {
      "terms": ["removed", "deprecated", "old implementation"],
      "location": "anywhere"
    }],
    "no-commented-out-code": "error"
  }
}
```

### Code Review Checklist
- [ ] No commented-out code
- [ ] No "removed" explanations
- [ ] No version history in comments
- [ ] TODOs have context/tickets
- [ ] Comments explain "why" not "what"

### Automated Detection
```bash
#!/bin/bash
# detect-bad-comments.sh

echo "Checking for code comment violations..."

# Check for commented code
if grep -r "^[[:space:]]*\/\/" --include="*.ts" | grep -qE "^\s*\/\/\s*(function|class|const|let|var|import|export)"; then
  echo "ERROR: Found commented-out code"
  exit 1
fi

# Check for removed/deprecated comments
if grep -r -i "\/\/.*\(removed\|deprecated\|old implementation\)" --include="*.ts"; then
  echo "WARNING: Found historical comments"
fi

echo "Comment check complete"
```

## Benefits

1. **Cleaner code** - No clutter from old implementations
2. **Trust in Git** - Version control is reliable
3. **Accurate history** - Git log doesn't lie
4. **Reduced confusion** - No conflicting information
5. **Easier refactoring** - Less text to update
6. **Professional codebase** - Shows maturity

## Related Patterns

- [Git Workflow](Git-Workflow.md) - Using Git effectively
- [Documentation Patterns](../Meta/Documentation-Patterns.md) - When to document
- [Naming Conventions](Naming-Conventions.md) - Self-documenting code
- [Error Handling](../TypeScript/Error-Handling.md) - Error documentation

---

*Remember: The code shows WHAT, comments explain WHY, and Git shows HOW it evolved. Keep comments focused on the present implementation's reasoning, not its history.*