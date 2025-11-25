# Code Comments

## Quick Reference
- **When to use**: Writing or reviewing code comments
- **Enforcement**: Required - Git history is the source of truth
- **Impact if violated**: Medium - Code clutter and confusion

## The Rule

**Git history is the source of truth for code evolution.**

NEVER explain removed code in comments. Delete outdated comments about previous implementations, deprecated features, or removed architecture. Use `git log` and `git blame` to understand historical context.

## Core Principles

1. **Git Is Source of Truth** - Removed code → Check git history
2. **Comments Explain "Why", Not "What"** - Code shows WHAT, comments explain WHY
3. **Delete, Don't Deprecate** - Remove dead code completely, trust version control

## Examples

### ❌ Incorrect - Explaining Removed Code

```typescript
// ❌ BAD - Explaining what was removed
class UserService {
  // We used to have a caching layer here but removed it
  // The old cache implementation caused memory leaks

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

  data.forEach(processItem);
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

// To understand evolution, developers use:
// git log -p UserService.ts
// git blame UserService.ts
```

## Appropriate Comment Types

### ✅ DO Write These Comments

#### Business Logic Explanations

```typescript
// Apply 15% discount for premium members per business requirement BR-2024-01
if (user.isPremium) {
  price *= 0.85;
}
```

#### Complex Algorithm Clarification

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

#### Workarounds and Hacks

```typescript
// HACK: AWS SDK v3 has bug with streaming uploads
// Remove after updating to v3.450+
// Issue: https://github.com/aws/aws-sdk-js-v3/issues/1234
const upload = new Upload({
  partSize: 1024 * 1024 * 5, // Force 5MB parts to avoid bug
});
```

#### TODOs with Context

```typescript
// TODO: Implement retry logic for transient failures
// Ticket: PROJ-123
// Owner: @teamname
async function apiCall() {
  // Current implementation without retry
}
```

### ❌ DON'T Write These Comments

```typescript
// ❌ We used to validate email here but moved it to middleware
// ❌ Previously this used callbacks, now uses promises
// ❌ Old version - keep for reference
// ❌ v1.0: Initial, v1.1: Added caching, v2.0: Removed caching
// ❌ Increment counter by 1
counter++;
```

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
 */
async function authenticate(username: string, password: string): Promise<User | null>
```

## Enforcement

### Code Review Checklist

- [ ] No commented-out code
- [ ] No "removed" explanations
- [ ] No version history in comments
- [ ] TODOs have context/tickets
- [ ] Comments explain "why" not "what"

## Related Patterns

- [Git Workflow](Git-Workflow.md) - Using Git effectively
- [Naming Conventions](Naming-Conventions.md) - Self-documenting code

---

*Remember: The code shows WHAT, comments explain WHY, and Git shows HOW it evolved. Keep comments focused on the present implementation's reasoning, not its history.*
