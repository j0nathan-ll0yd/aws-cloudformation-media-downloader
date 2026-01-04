# Emerging Conventions

## Quick Reference
- **When to use**: Capturing new patterns discovered during development
- **Enforcement**: Ongoing - live append-only log
- **Impact if violated**: LOW - Lost institutional knowledge

## Overview

This is a live, append-only log of conventions discovered during development that haven't yet been promoted to formal wiki pages. Think of it as the "working memory" of the Convention Capture System.

## Format

Each entry follows this structure:

```markdown
## [Date] - [Convention Name]

**Type**: [Rule/Pattern/Methodology/Anti-Pattern]
**Priority**: [Critical/High/Medium/Low]
**Context**: [Where/when this applies]

**What**: [One-sentence description]

**Why**: [Rationale for the convention]

**Example**:
```[language]
// Code example
```

**Status**: [Emerging/Validated/Documented/Deprecated]
**Wiki Page**: [Link when promoted to wiki, or "Pending"]
```

## Current Emerging Conventions

### 2025-11-24 - Drizzle Query Mock Pattern

**Type**: Pattern
**Priority**: High
**Context**: Unit testing with Drizzle ORM query functions

**What**: Mock `#entities/queries` with vi.mock() for testing Lambda handlers

**Why**:
- Consistent mock structure across all tests
- Standard function mocking (simpler than ORM entity mocking)
- Reduces test boilerplate
- Type-safe with entity fixture factories

**Example**:
```typescript
import {createMockUser} from '#test/helpers/entity-fixtures'

vi.mock('#entities/queries', () => ({
  getUser: vi.fn().mockResolvedValue(createMockUser()),
  createUser: vi.fn().mockResolvedValue(createMockUser()),
  updateUser: vi.fn().mockResolvedValue(createMockUser())
}))
```

**Status**: Validated (in use across test suite)
**Wiki Page**: Testing/Vitest-Mocking-Strategy.md

---

### 2025-11-24 - build/graph.json for Dependency Analysis

**Type**: Tool/Pattern
**Priority**: High
**Context**: Understanding code dependencies, especially for testing

**What**: Use auto-generated `build/graph.json` to find all transitive dependencies

**Why**:
- Shows complete dependency tree
- Critical for Vitest tests (need to mock ALL transitive deps)
- Prevents "missing mock" test failures
- Automated (regenerated on every build)

**Example**:
```bash
# Find all dependencies of a file
cat build/graph.json | jq '.transitiveDependencies["src/lambdas/WebhookFeedly/src/index.ts"]'

# Output shows ALL files that need mocking
```

**Status**: Validated (documented in project conventions)
**Wiki Page**: Mentioned in AGENTS.md, could be separate Testing wiki page

---

### 2025-11-24 - LocalStack Vendor Wrapper Configuration

**Type**: Pattern
**Priority**: Medium
**Context**: Integration testing with LocalStack

**What**: Vendor wrappers check `USE_LOCALSTACK` env var and configure endpoints accordingly

**Why**:
- Single source for LocalStack configuration
- Tests don't need to mock AWS service endpoints
- Same vendor wrappers work in LocalStack and real AWS
- Easy to switch between local and cloud testing

**Example**:
```typescript
// lib/vendor/AWS/S3.ts
function getS3Client(): S3Client {
  if (!s3Client) {
    const isLocalStack = process.env.USE_LOCALSTACK === 'true'
    
    s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-west-2',
      endpoint: isLocalStack ? 'http://localhost:4566' : undefined,
      forcePathStyle: isLocalStack  // Required for LocalStack
    })
  }
  return s3Client
}
```

**Status**: Validated (used in multiple vendor wrappers)
**Wiki Page**: Could be added to Integration/LocalStack-Testing.md or Testing/Integration-Testing.md

---

## How to Use This Page

### For Developers

1. **Check before coding** - See if someone already solved your problem
2. **Add discoveries** - Append new conventions you find
3. **Validate patterns** - Mark as "Validated" after successful use
4. **Promote to wiki** - Create proper wiki page for important patterns

### For AI Assistants

1. **Monitor this page** - Check for patterns relevant to current task
2. **Flag new patterns** - When you notice repeated decisions, flag them
3. **Suggest promotion** - Recommend validated patterns for wiki pages
4. **Update status** - Mark patterns as you see them used/validated

### Adding an Entry

```markdown
## [Today's Date] - [Descriptive Name]

**Type**: [Rule/Pattern/Methodology/Anti-Pattern]
**Priority**: [Critical/High/Medium/Low]
**Context**: [When/where this applies]

**What**: [Clear one-sentence description]

**Why**: [Brief rationale - what problem does this solve?]

**Example**:
```[language]
[Clear, minimal code example]
```

**Status**: Emerging
**Wiki Page**: Pending
```

## Promotion Criteria

A convention should be promoted to a wiki page when:

1. **Validated** - Used successfully in 3+ places
2. **Important** - Priority High or Critical
3. **Stable** - Pattern unlikely to change
4. **General** - Applies broadly, not one-off solution
5. **Ready** - Enough examples and rationale to document properly

## Archive

When a convention is promoted to a wiki page, update the entry:

```markdown
## [Date] - [Convention Name]
[... existing content ...]

**Status**: Documented
**Wiki Page**: `../Category/Page-Name.md` (example path)
**Promoted**: [Date]
```

Leave the entry here for reference, but mark it as documented.

## Anti-Patterns to Avoid

Document anti-patterns (things NOT to do):

```markdown
## [Date] - [Anti-Pattern Name]

**Type**: Anti-Pattern
**Priority**: [Level]
**Context**: [Where people try this]

**What**: [What people mistakenly do]

**Why Not**: [Why this doesn't work]

**Instead**: [What to do instead]

**Example of Problem**:
```[language]
// Bad approach
```

**Correct Approach**:
```[language]
// Good approach
```

**Status**: [Status]
**Wiki Page**: [Link or Pending]
```

## Integration with Convention Capture

This page is part of the Convention Capture System:

1. **Detection** - Patterns emerge during development
2. **Flagging** - Developer or AI flags pattern (adds to this page)
3. **Validation** - Pattern used successfully multiple times
4. **Documentation** - Create proper wiki page
5. **Enforcement** - Add linting/testing where possible

See [Convention Capture System](Convention-Capture-System.md) for full methodology.

## Status Definitions

- **Emerging**: Just discovered, not yet validated
- **Validated**: Successfully used in production code
- **Documented**: Promoted to formal wiki page
- **Deprecated**: Pattern no longer recommended
- **Rejected**: Tried but doesn't work well

## Related Patterns

- [Convention Capture System](Convention-Capture-System.md) - Full methodology
- [Documentation Patterns](Documentation-Patterns.md) - Wiki organization
- [Working with AI Assistants](Working-with-AI-Assistants.md) - AI collaboration

---

*This is a living document. Append new conventions as they emerge. Update status as patterns are validated and promoted to wiki pages. Never delete entries - they provide history of pattern evolution.*
