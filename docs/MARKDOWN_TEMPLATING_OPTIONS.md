# Markdown Templating Options for GitHub Issue Templates

## Current State

The `github-helpers.ts` file contains three functions with embedded Markdown templates:

1. **createFailedUserDeletionIssue** - Simple template (1 line)
2. **createVideoDownloadFailureIssue** - Medium complexity with conditional content
3. **createCookieExpirationIssue** - Complex multi-section template with code blocks (70+ lines)

**Problem**: Mixing presentation (Markdown) with logic makes the code harder to maintain and test.

**Goal**: Extract Markdown into separate template files with variable injection.

---

## Option 1: Native Template Literals with File Reading

### How It Works
Store Markdown in separate files and use JavaScript template literals for interpolation.

### Implementation

**File Structure:**
```
src/templates/github-issues/
  ├── cookie-expiration.md
  ├── video-download-failure.md
  └── user-deletion-failure.md
```

**Template File** (`cookie-expiration.md`):
```markdown
## YouTube Cookie Expiration

YouTube has detected the cookies as expired or is blocking requests with bot detection.

**Triggered By**:
- **File ID**: ${fileId}
- **Video URL**: ${fileUrl}
- **Error Message**: ${error.message}
- **Timestamp**: ${timestamp}

---

## Required Action: Refresh YouTube Cookies
...
```

**Helper Function**:
```typescript
import {readFileSync} from 'fs'
import {join} from 'path'

function renderTemplate(templateName: string, data: Record<string, unknown>): string {
  const templatePath = join(__dirname, '../templates/github-issues', `${templateName}.md`)
  const template = readFileSync(templatePath, 'utf-8')

  // Use Function constructor for safe template evaluation
  const fn = new Function(...Object.keys(data), `return \`${template}\``)
  return fn(...Object.values(data))
}

// Usage
const body = renderTemplate('cookie-expiration', {
  fileId: 'abc123',
  fileUrl: 'https://youtube.com/watch?v=xyz',
  'error.message': error.message,
  timestamp: new Date().toISOString()
})
```

### Pros
- ✅ Zero dependencies
- ✅ Native JavaScript - no new syntax to learn
- ✅ Full JavaScript expressions in templates (e.g., `${new Date().toISOString()}`)
- ✅ Simple and fast
- ✅ TypeScript friendly

### Cons
- ❌ Template files need proper escaping of backticks
- ❌ Function constructor can be risky with untrusted data
- ❌ No built-in conditionals or loops (need to pass pre-formatted strings)
- ❌ Harder to validate templates at compile time

### Dependencies
None (uses Node.js built-ins)

---

## Option 2: Mustache.js (Logic-less Templates)

### How It Works
Popular, widely-used templating engine with simple `{{variable}}` syntax.

### Implementation

**Template File** (`cookie-expiration.mustache`):
```markdown
## YouTube Cookie Expiration

YouTube has detected the cookies as expired or is blocking requests with bot detection.

**Triggered By**:
- **File ID**: {{fileId}}
- **Video URL**: {{fileUrl}}
- **Error Message**: {{errorMessage}}
- **Timestamp**: {{timestamp}}

{{#hasStackTrace}}
## Stack Trace
```
{{stackTrace}}
```
{{/hasStackTrace}}
```

**Helper Function**:
```typescript
import Mustache from 'mustache'
import {readFileSync} from 'fs'
import {join} from 'path'

function renderTemplate(templateName: string, data: Record<string, unknown>): string {
  const templatePath = join(__dirname, '../templates/github-issues', `${templateName}.mustache`)
  const template = readFileSync(templatePath, 'utf-8')
  return Mustache.render(template, data)
}

// Usage
const body = renderTemplate('cookie-expiration', {
  fileId: 'abc123',
  fileUrl: 'https://youtube.com/watch?v=xyz',
  errorMessage: error.message,
  timestamp: new Date().toISOString(),
  hasStackTrace: !!error.stack,
  stackTrace: error.stack
})
```

### Pros
- ✅ Industry standard with wide adoption
- ✅ Logic-less design prevents complex logic in templates
- ✅ Built-in conditionals and loops
- ✅ Safe - no code execution in templates
- ✅ Well-documented and maintained
- ✅ Templates are readable and designer-friendly

### Cons
- ❌ Additional dependency (~25KB)
- ❌ Cannot execute code in templates (must pre-format all data)
- ❌ Extra step to prepare data object

### Dependencies
```bash
npm install mustache
npm install --save-dev @types/mustache
```

---

## Option 3: Simple Token Replacement

### How It Works
Custom lightweight solution with `{{variable}}` syntax, no logic.

### Implementation

**Template File** (`cookie-expiration.md`):
```markdown
## YouTube Cookie Expiration

**Triggered By**:
- **File ID**: {{fileId}}
- **Video URL**: {{fileUrl}}
- **Error Message**: {{errorMessage}}
- **Timestamp**: {{timestamp}}
```

**Helper Function**:
```typescript
import {readFileSync} from 'fs'
import {join} from 'path'

function renderTemplate(templateName: string, data: Record<string, unknown>): string {
  const templatePath = join(__dirname, '../templates/github-issues', `${templateName}.md`)
  let template = readFileSync(templatePath, 'utf-8')

  // Simple token replacement
  for (const [key, value] of Object.entries(data)) {
    const token = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    template = template.replace(token, String(value))
  }

  return template
}

// Usage - handle conditionals in code
let additionalDetails = ''
if (errorDetails) {
  additionalDetails = `### Additional Details\n\`\`\`\n${errorDetails}\n\`\`\``
}

const body = renderTemplate('video-download-failure', {
  fileId: 'abc123',
  fileUrl: 'https://youtube.com/watch?v=xyz',
  errorType: error.constructor.name,
  errorMessage: error.message,
  additionalDetails,
  stackTrace: error.stack || 'No stack trace available',
  timestamp: new Date().toISOString()
})
```

### Pros
- ✅ Zero dependencies
- ✅ Simple implementation (~15 lines of code)
- ✅ Full control over implementation
- ✅ Easy to understand and debug
- ✅ Fast performance

### Cons
- ❌ No built-in conditionals or loops
- ❌ Must handle conditional content in code
- ❌ No template validation
- ❌ Limited features compared to full templating engines

### Dependencies
None

---

## Option 4: Tagged Template Literals (Compile-time)

### How It Works
Pre-compile templates at build time as TypeScript functions.

### Implementation

**Template File** (`cookie-expiration.template.ts`):
```typescript
export interface CookieExpirationData {
  fileId: string
  fileUrl: string
  errorMessage: string
  stackTrace: string
  timestamp: string
}

export function cookieExpirationTemplate(data: CookieExpirationData): string {
  return `## YouTube Cookie Expiration

YouTube has detected the cookies as expired or is blocking requests with bot detection.

**Triggered By**:
- **File ID**: ${data.fileId}
- **Video URL**: ${data.fileUrl}
- **Error Message**: ${data.errorMessage}
- **Timestamp**: ${data.timestamp}

---

## Stack Trace
\`\`\`
${data.stackTrace}
\`\`\`

---
This issue was automatically created by the cookie monitoring system.`
}
```

**Usage**:
```typescript
import {cookieExpirationTemplate, CookieExpirationData} from '../templates/github-issues/cookie-expiration.template'

const data: CookieExpirationData = {
  fileId: 'abc123',
  fileUrl: 'https://youtube.com/watch?v=xyz',
  errorMessage: error.message,
  stackTrace: error.stack || 'No stack trace available',
  timestamp: new Date().toISOString()
}

const body = cookieExpirationTemplate(data)
```

### Pros
- ✅ Zero dependencies
- ✅ Full TypeScript type safety
- ✅ Compile-time validation
- ✅ Full JavaScript capabilities
- ✅ Fast runtime performance
- ✅ Code completion in IDEs

### Cons
- ❌ Templates are TypeScript code, not pure Markdown
- ❌ Mixing Markdown with code (just in different file)
- ❌ Harder for non-developers to edit templates
- ❌ Still need to escape backticks

### Dependencies
None

---

## Option 5: EJS (Embedded JavaScript)

### How It Works
Powerful templating with JavaScript embedded in templates.

### Implementation

**Template File** (`cookie-expiration.ejs`):
```markdown
## YouTube Cookie Expiration

YouTube has detected the cookies as expired or is blocking requests with bot detection.

**Triggered By**:
- **File ID**: <%= fileId %>
- **Video URL**: <%= fileUrl %>
- **Error Message**: <%= errorMessage %>
- **Timestamp**: <%= timestamp %>

---

<% if (hasAdditionalDetails) { %>
### Additional Details
```
<%= additionalDetails %>
```
<% } %>

## Stack Trace
```
<%= stackTrace %>
```
```

**Helper Function**:
```typescript
import ejs from 'ejs'
import {readFileSync} from 'fs'
import {join} from 'path'

function renderTemplate(templateName: string, data: Record<string, unknown>): string {
  const templatePath = join(__dirname, '../templates/github-issues', `${templateName}.ejs`)
  const template = readFileSync(templatePath, 'utf-8')
  return ejs.render(template, data)
}

// Usage
const body = renderTemplate('cookie-expiration', {
  fileId: 'abc123',
  fileUrl: 'https://youtube.com/watch?v=xyz',
  errorMessage: error.message,
  timestamp: new Date().toISOString(),
  hasAdditionalDetails: !!errorDetails,
  additionalDetails: errorDetails,
  stackTrace: error.stack || 'No stack trace available'
})
```

### Pros
- ✅ Full JavaScript logic in templates
- ✅ Conditionals and loops built-in
- ✅ Widely used in Node.js ecosystem
- ✅ Can execute any JavaScript
- ✅ Good documentation

### Cons
- ❌ Additional dependency
- ❌ Can become complex with too much logic
- ❌ Potential security risk if templates accept user input
- ❌ Less readable than pure Markdown

### Dependencies
```bash
npm install ejs
npm install --save-dev @types/ejs
```

---

## Comparison Matrix

| Feature | Native Templates | Mustache | Token Replace | Tagged Literals | EJS |
|---------|-----------------|----------|---------------|----------------|-----|
| **Dependencies** | None | 1 | None | None | 1 |
| **Conditionals** | In code | Built-in | In code | In code | Built-in |
| **Type Safety** | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Readability** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| **Maintainability** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Performance** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Security** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Ease of Use** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Bundle Size** | 0 KB | ~25 KB | 0 KB | 0 KB | ~88 KB |

---

## Recommendations

### For This Project: **Option 3 - Simple Token Replacement**

**Reasoning:**
1. **Zero dependencies** - Aligns with project's minimal dependency philosophy
2. **Simple and maintainable** - 15 lines of code vs external library
3. **Sufficient for current needs** - Templates don't require complex logic
4. **Performance** - No parsing overhead
5. **Security** - No code execution, just string replacement
6. **Readability** - Pure Markdown files with `{{variable}}` placeholders

**Conditional Handling Strategy:**
Handle conditionals in the TypeScript code before rendering:
```typescript
// Prepare conditional content in code
const additionalDetails = errorDetails
  ? `### Additional Details\n\`\`\`\n${errorDetails}\n\`\`\``
  : ''

// Simple template with all content pre-formatted
const body = renderTemplate('video-download-failure', {
  fileId,
  fileUrl,
  errorType: error.constructor.name,
  errorMessage: error.message,
  additionalDetails, // Already formatted or empty
  stackTrace: error.stack || 'No stack trace available',
  timestamp: new Date().toISOString()
})
```

### Alternative: **Option 2 - Mustache** (If complexity grows)

If templates become more complex or we need built-in conditionals, Mustache is the best next step:
- Industry standard
- Logic-less prevents template complexity
- Only 25KB dependency
- Better separation of concerns

---

## Implementation Plan (Option 3)

### Step 1: Create Template Directory Structure
```
src/templates/github-issues/
  ├── cookie-expiration.md
  ├── video-download-failure.md
  └── user-deletion-failure.md
```

### Step 2: Create Helper Module
```typescript
// src/util/template-helpers.ts
import {readFileSync} from 'fs'
import {join} from 'path'

export function renderGithubIssueTemplate(
  templateName: string,
  data: Record<string, string | number>
): string {
  const templatePath = join(__dirname, '../templates/github-issues', `${templateName}.md`)
  let template = readFileSync(templatePath, 'utf-8')

  for (const [key, value] of Object.entries(data)) {
    const token = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    template = template.replace(token, String(value))
  }

  return template
}
```

### Step 3: Extract Templates
Move Markdown from `github-helpers.ts` to individual `.md` files.

### Step 4: Update Functions
```typescript
export async function createCookieExpirationIssue(
  fileId: string,
  fileUrl: string,
  error: Error
) {
  const title = '🍪 YouTube Cookie Expiration Detected'
  const body = renderGithubIssueTemplate('cookie-expiration', {
    fileId,
    fileUrl,
    errorMessage: error.message,
    timestamp: new Date().toISOString(),
    stackTrace: error.stack || 'No stack trace available'
  })

  // ... rest of function
}
```

### Step 5: Add Tests
```typescript
describe('renderGithubIssueTemplate', () => {
  test('should replace all tokens with values', () => {
    const result = renderGithubIssueTemplate('cookie-expiration', {
      fileId: 'test123',
      fileUrl: 'https://example.com',
      errorMessage: 'Test error',
      timestamp: '2024-01-01T00:00:00.000Z',
      stackTrace: 'Test stack'
    })

    expect(result).toContain('test123')
    expect(result).toContain('https://example.com')
    expect(result).not.toContain('{{')
  })
})
```

---

## Decision Criteria

Choose based on:

1. **Current complexity** → Simple Token Replacement
2. **Need type safety** → Tagged Template Literals
3. **Expect growth/complexity** → Mustache
4. **Need JavaScript in templates** → EJS or Native Templates
5. **Want zero dependencies** → Token Replacement or Tagged Literals

---

## Next Steps

1. Review this document
2. Decide on approach
3. Implement chosen solution
4. Update LAMBDA_STYLE_GUIDE.md with template pattern
5. Add to PR review checklist
