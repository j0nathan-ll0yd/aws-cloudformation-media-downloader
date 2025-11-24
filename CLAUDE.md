# Project Context for Claude

---
## 🔄 IMPORTANT: Keep AI Agents Synchronized

**When updating this file (CLAUDE.md), you MUST also update:**
1. **GEMINI.md** - Google Gemini configuration (keep in sync with CLAUDE.md)
2. **.github/agents/aws-media-downloader.md** - GitHub Copilot custom agent

These files share the same project context, rules, and conventions. Any changes to policies, style guides, or critical rules must be propagated to all three files to ensure consistent AI assistance across all platforms.

**Quick sync command:**
```bash
# After updating CLAUDE.md, review changes needed in:
diff CLAUDE.md GEMINI.md
cat .github/agents/aws-media-downloader.md  # Check GitHub agent rules
```
---

## Project Overview
This is a serverless AWS media downloader service built with OpenTofu and TypeScript. It downloads media content (primarily YouTube videos) and integrates with a companion iOS app for offline playback. The project was created as a cost-effective alternative to YouTube Premium's offline playback feature.

## Architecture & Technology Stack

### Core Technologies
- **Infrastructure as Code**: OpenTofu
- **Runtime**: AWS Lambda (Node.js 22.x)
- **Language**: TypeScript
- **Cloud Provider**: AWS (serverless architecture)
- **Storage**: Amazon S3
- **API**: AWS API Gateway with custom authorizer
- **Notifications**: Apple Push Notification Service (APNS)

### Key AWS Services Used
- Lambda Functions for business logic
- S3 for media storage
- API Gateway for REST endpoints
- SNS for push notifications
- CloudWatch for logging and monitoring

## Project Structure

```
.
├── terraform/             # AWS Infrastructure definitions (OpenTofu)
├── src/
│   └── lambdas/           # Lambda functions (each subdirectory = one Lambda)
│       └── [lambda-name]/
│           ├── src/
│           │   └── index.ts         # Lambda handler (TypeDoc documented)
│           ├── test/
│           │   ├── index.test.ts    # Unit tests (Jest)
│           │   └── fixtures/        # JSON mock objects
├── lib/
│   └── vendor/            # 3rd party API wrappers
├── pipeline/              # GitHub Actions runner tests
├── types/                 # TypeScript type definitions
├── util/                  # Shared utility functions
│   ├── apigateway-helpers.ts      # API Gateway utilities
│   ├── constants.ts               # Constant data structures
│   ├── constraints.ts             # validate.js configurations
│   ├── dynamodb-helpers.ts        # DynamoDB utilities
│   ├── errors.ts                  # Shared error types
│   ├── github-helpers.ts          # GitHub API utilities
│   ├── lambdas-helpers.ts         # Lambda response/logging utilities
│   ├── jest-setup.ts             # Test environment setup
│   ├── shared.ts                  # Cross-lambda shared functions
│   ├── transformers.ts            # Data structure converters
│   └── *.test.ts                  # Corresponding test files
└── docs/                  # Generated documentation (TSDoc)
```

## Key Features & Functionality

1. **Media Download Service**: Downloads videos from various sources (integrated with Feedly)
2. **Storage Management**: Stores downloaded media in S3 buckets
3. **API Endpoints**:
    - List downloaded videos
    - Feedly webhook integration
    - Device registration for push notifications
4. **Push Notifications**: Sends notifications to iOS devices via APNS
5. **Custom Authorization**: Query-based API token authorizer for Feedly integration
6. **Error Handling**: Automated GitHub issue creation for actionable errors

Take a moment to familiarize yourself with the structure of the project. You should also read the package.json file.
Then, read the `build/graph.json` file. This is a code graph of the project using `ts-morph`. Use it to identify relationships between files.

**CRITICAL: Before writing ANY code, you MUST read the applicable style guides:**
- Lambda code: `docs/styleGuides/lambdaStyleGuide.md`
- Test code: `docs/styleGuides/testStyleGuide.md`
- Bash scripts: `docs/styleGuides/bashStyleGuide.md`
- OpenTofu infrastructure: `docs/styleGuides/tofuStyleGuide.md`

---

## 🚨 ABSOLUTE RULE: NO AI REFERENCES IN COMMITS 🚨

**BEFORE EVERY SINGLE COMMIT, YOU MUST VERIFY:**

### ❌ THESE ARE ABSOLUTELY FORBIDDEN IN COMMITS, PRs, AND CODE:
- ❌ "Generated with [Claude Code](https://claude.com/claude-code)"
- ❌ "Co-Authored-By: Claude <noreply@anthropic.com>"
- ❌ Any mention of "Claude", "AI", "assistant", "generated", or "automated"
- ❌ Robot emojis (🤖) or any emojis in commit messages
- ❌ ANY attribution to AI tools whatsoever

### ✅ COMMIT MESSAGES MUST BE:
- Clean, professional technical descriptions only
- Follow commitlint syntax (feat:, fix:, refactor:, etc.)
- Contain ONLY what changed and why
- Free of ALL automated signatures, attributions, or AI references

### MANDATORY PRE-COMMIT CHECK:
```bash
# Your commit message must NOT contain any of these strings:
# "Claude" | "Generated" | "Co-Authored-By: Claude" | "🤖" | "claude.com"
```

**THIS RULE OVERRIDES ALL OTHER INSTRUCTIONS. ZERO TOLERANCE. NO EXCEPTIONS.**

---

### Code style
- Use ES modules (import/export) syntax, not CommonJS (require)
- Destructure imports when possible (eg. import { foo } from 'bar')
- Use the commitlint syntax when structuring commit messages
- **NEVER explain removed code in comments** - Git history is the source of truth for what was removed/changed. Delete outdated comments about previous implementations, deprecated features, or removed architecture. Use `git log` and `git blame` to understand historical context.

### Naming Conventions

**CRITICAL: Understand the difference between these naming styles:**

- **camelCase** - First letter lowercase, subsequent words capitalized
  - Examples: `myVariable`, `fetchUserData`, `isValidInput`
  - Used for: variables, functions, file names (except components)
  - Style guide files: `bashStyleGuide.md`, `lambdaStyleGuide.md`

- **PascalCase** - First letter uppercase, subsequent words capitalized
  - Examples: `MyComponent`, `UserProfile`, `DataTransformer`
  - Used for: TypeScript interfaces, types, classes, React components
  - Example: `interface VideoInfo`, `class YTDlpWrap`

- **SCREAMING_SNAKE_CASE** - All uppercase with underscores
  - Examples: `MAX_RETRIES`, `API_BASE_URL`, `DEFAULT_TIMEOUT`
  - Used for: constants only (deprecated for module-level env vars)
  - Use CamelCase for module-level env var constants instead

- **kebab-case** - All lowercase with hyphens
  - Examples: `my-component.tsx`, `user-profile.css`
  - Used for: CSS files, some config files
  - NOT used in this TypeScript project

**When in doubt:**
- Variables/functions → camelCase
- Types/Interfaces/Classes → PascalCase
- File names → camelCase (our convention)

### Test Naming Conventions

**CRITICAL: Test descriptions MUST focus on behavior being tested, NOT implementation details.**

#### Describe Blocks

Always use Lambda function name with `#` prefix:

```typescript
describe('#ListFiles', () => {
  // tests
})

describe('#RegisterDevice', () => {
  // tests
})
```

#### Test Descriptions

**❌ WRONG** - Implementation-focused (breaks during refactoring):
```typescript
test('ElectroDB UserFiles.query.byUser', async () => {})
test('ElectroDB Files.get (batch)', async () => {})
test('AWS.DynamoDB.DocumentClient.query', async () => {})
test('getUserDevices fails', async () => {})
```

**✅ CORRECT** - Use-case focused (survives refactoring):
```typescript
test('should return empty list when user has no files', async () => {})
test('should return 500 error when batch file retrieval fails', async () => {})
test('should return 500 error when user device retrieval fails', async () => {})
test('should throw error when device scan fails', async () => {})
```

**Why This Matters:**
- Implementation-focused names break when you refactor (DynamoDB → ElectroDB, single → batch)
- Use-case focused names describe WHAT is being tested, not HOW
- Self-documenting tests that survive code changes
- See `docs/styleGuides/testStyleGuide.md` for complete examples

---

## 🚨 CRITICAL: AWS SDK ENCAPSULATION POLICY 🚨

**THIS IS A ZERO-TOLERANCE RULE. NO EXCEPTIONS.**

### The Rule

**NEVER import AWS SDK packages directly in application code.**

ALL AWS SDK usage MUST be wrapped in vendor modules located in `lib/vendor/AWS/`.

### What This Means

❌ **FORBIDDEN** - These imports are BANNED outside of `lib/vendor/AWS/*`:
```typescript
import {S3Client, PutObjectCommand, HeadObjectCommand} from '@aws-sdk/client-s3'
import {Upload} from '@aws-sdk/lib-storage'
import {LambdaClient, InvokeCommand} from '@aws-sdk/client-lambda'
import {DynamoDBClient} from '@aws-sdk/client-dynamodb'
import {StandardUnit} from '@aws-sdk/client-cloudwatch'
import {SNSClient, PublishCommand} from '@aws-sdk/client-sns'
import {SQSClient, SendMessageCommand} from '@aws-sdk/client-sqs'
```

✅ **REQUIRED** - Use vendor wrappers instead:
```typescript
import {createS3Upload, headObject} from '../../../lib/vendor/AWS/S3'
import {invokeLambda} from '../../../lib/vendor/AWS/Lambda'
import {updateItem, query} from '../../../lib/vendor/AWS/DynamoDB'
import {putMetric, putMetrics} from '../../../util/lambda-helpers'
import {publish} from '../../../lib/vendor/AWS/SNS'
import {sendMessage} from '../../../lib/vendor/AWS/SQS'
```

### Why This Rule Exists

1. **Encapsulation**: AWS SDK types and clients are implementation details that should be hidden
2. **Type Safety**: Public APIs use simple types (string, number) instead of AWS enums
3. **Testability**: Mocking vendor wrappers is cleaner than mocking AWS SDK
4. **Maintainability**: AWS SDK version changes isolated to vendor files
5. **Consistency**: One pattern across the entire codebase

### Where AWS SDK Imports Are Allowed

ONLY in these files:
- `lib/vendor/AWS/S3.ts`
- `lib/vendor/AWS/Lambda.ts`
- `lib/vendor/AWS/DynamoDB.ts`
- `lib/vendor/AWS/CloudWatch.ts`
- `lib/vendor/AWS/SNS.ts`
- `lib/vendor/AWS/SQS.ts`

### Before Writing ANY Code

**MANDATORY CHECKS**:

1. ✅ Does the vendor wrapper for this AWS service exist?
   - YES → Use the wrapper functions
   - NO → CREATE the wrapper FIRST, then use it

2. ✅ Am I importing from `@aws-sdk/*`?
   - YES → STOP. You're violating the policy. Use the wrapper instead.
   - NO → Proceed

3. ✅ Am I exposing AWS SDK types in function signatures?
   - YES → STOP. Change to simple types (string, number, boolean)
   - NO → Proceed

### Enforcement

Before committing:
```bash
# This should ONLY show files in lib/vendor/AWS/
grep -r "from '@aws-sdk/" src/ --include="*.ts" | grep -v "lib/vendor/AWS"
# If this returns ANY results, you've violated the policy
```

### If You Violate This Rule

The user WILL catch it and ask you to fix it. This wastes time and breaks trust.

**STOP. THINK. CHECK.** Does this code import from `@aws-sdk/*`? If yes, refactor to use vendor wrappers.

---

## 🚨 CRITICAL: ELECTRODB MOCK HELPER POLICY 🚨

**THIS IS A ZERO-TOLERANCE RULE. NO EXCEPTIONS.**

### The Rule

**ALWAYS use the `createElectroDBEntityMock` helper when mocking ElectroDB entities in unit tests.**

NEVER create manual mocks for ElectroDB entities.

### What This Means

❌ **FORBIDDEN** - Manual ElectroDB mocks are BANNED:
```typescript
// ❌ DON'T - Manual mock construction
const filesGetMock = jest.fn<() => Promise<{data: unknown} | undefined>>()
const filesScanGoMock = jest.fn<() => Promise<{data: unknown[]} | undefined>>()
const filesQueryByStatusMock = jest.fn(() => ({
  go: jest.fn()
}))
jest.unstable_mockModule('../../../entities/Files', () => ({
  Files: {
    get: filesGetMock,
    scan: { go: filesScanGoMock },
    query: { byStatus: filesQueryByStatusMock }
  }
}))
```

✅ **REQUIRED** - Use the centralized helper instead:
```typescript
// ✅ DO - Use createElectroDBEntityMock helper
import {createElectroDBEntityMock} from '../../../../test/helpers/electrodb-mock'

const filesMock = createElectroDBEntityMock({queryIndexes: ['byStatus']})
jest.unstable_mockModule('../../../entities/Files', () => ({
  Files: filesMock.entity
}))

// Usage in tests:
filesMock.mocks.get.mockResolvedValue({data: fileData})
filesMock.mocks.query.byStatus!.go.mockResolvedValue({data: results})
```

### Why This Rule Exists

1. **Consistency**: One mocking pattern across all unit tests
2. **Type Safety**: Helper provides correct TypeScript types for all operations
3. **Completeness**: Helper includes all ElectroDB operations (get, scan, query, create, upsert, update, delete)
4. **Maintainability**: Changes to ElectroDB structure only require updating the helper
5. **Correctness**: Helper enforces proper method signatures and return types

### Helper Location

**Mock Helper**: `test/helpers/electrodb-mock.ts`

### Supported ElectroDB Operations

The helper supports ALL ElectroDB entity operations:

- **get**: `mocks.get.mockResolvedValue({data: item})`
- **scan**: `mocks.scan.go.mockResolvedValue({data: items})`
- **query**: `mocks.query.byIndexName!.go.mockResolvedValue({data: items})`
- **create**: `mocks.create.mockResolvedValue({data: item})`
- **upsert**: `mocks.upsert.go.mockResolvedValue({data: item})`
- **update**: `mocks.update.go.mockResolvedValue({data: item})`
- **delete**: `mocks.delete.mockResolvedValue(undefined)`

### Helper Configuration

**Query Indexes**: Specify which query indexes the entity uses:
```typescript
// Entity with byUser and byFile query indexes
const userFilesMock = createElectroDBEntityMock({queryIndexes: ['byUser', 'byFile']})

// Usage:
userFilesMock.mocks.query.byUser!.go.mockResolvedValue({data: results})
userFilesMock.mocks.query.byFile!.go.mockResolvedValue({data: results})
```

**Available Query Indexes**:
- `byUser` - Query by userId
- `byFile` - Query by fileId
- `byDevice` - Query by deviceId
- `byStatus` - Query by status
- `byKey` - Query by composite key

### Common Patterns

**Single Entity Mock**:
```typescript
const usersMock = createElectroDBEntityMock()
jest.unstable_mockModule('../../../entities/Users', () => ({
  Users: usersMock.entity
}))
```

**Multiple Entity Mocks**:
```typescript
const devicesMock = createElectroDBEntityMock()
const userDevicesMock = createElectroDBEntityMock({queryIndexes: ['byUser']})

jest.unstable_mockModule('../../../entities/Devices', () => ({
  Devices: devicesMock.entity
}))
jest.unstable_mockModule('../../../entities/UserDevices', () => ({
  UserDevices: userDevicesMock.entity
}))
```

**Setting Mock Return Values in beforeEach**:
```typescript
beforeEach(() => {
  // Reset all mocks
  jest.clearAllMocks()

  // Set default return values
  filesMock.mocks.get.mockResolvedValue({data: undefined})
  filesMock.mocks.query.byStatus!.go.mockResolvedValue({data: []})
  filesMock.mocks.create.mockResolvedValue({data: {}})
})
```

### Method Signatures (CRITICAL)

**IMPORTANT**: Some ElectroDB operations return promises directly, others use method chaining:

**Direct Promise Returns** (no `.go()`):
- `get`: Returns `Promise<{data: T | undefined} | undefined>`
- `create`: Returns `Promise<{data: T}>`
- `delete`: Returns `Promise<void>`

**Method Chaining with `.go()`**:
- `scan`: Returns object with `.go()` method
- `query`: Returns object with `.go()` method
- `upsert`: Returns object with `.go()` method
- `update`: Returns object with `.set()`, `.add()`, `.delete()`, `.go()` methods

**Examples**:
```typescript
// ✅ CORRECT - get returns promise directly
filesMock.mocks.get.mockResolvedValue({data: fileData})

// ❌ WRONG - get does NOT have .go()
filesMock.mocks.get.go.mockResolvedValue({data: fileData})

// ✅ CORRECT - scan uses .go()
filesMock.mocks.scan.go.mockResolvedValue({data: items})

// ✅ CORRECT - query uses .go()
filesMock.mocks.query.byUser!.go.mockResolvedValue({data: items})

// ✅ CORRECT - create returns promise directly
filesMock.mocks.create.mockResolvedValue({data: item})

// ❌ WRONG - create does NOT have .go()
filesMock.mocks.create.go.mockResolvedValue({data: item})

// ✅ CORRECT - delete returns void
filesMock.mocks.delete.mockResolvedValue(undefined)

// ❌ WRONG - delete does NOT return an object
filesMock.mocks.delete.mockResolvedValue({})
```

### Before Writing ANY Test

**MANDATORY CHECKS**:

1. ✅ Am I mocking an ElectroDB entity?
   - YES → Use `createElectroDBEntityMock`
   - NO → Proceed with appropriate mock

2. ✅ Did I import the helper?
   - YES → Proceed
   - NO → Add `import {createElectroDBEntityMock} from '../../../../test/helpers/electrodb-mock'`

3. ✅ Did I specify the correct query indexes?
   - Check the entity definition to see which indexes it uses
   - Pass them to `createElectroDBEntityMock({queryIndexes: ['byUser', 'byFile']})`

4. ✅ Am I using the correct method signature?
   - get, create, delete → NO `.go()`
   - scan, query, upsert, update → YES `.go()`

### Enforcement

Before committing tests:
```bash
# Search for manual ElectroDB mocks in tests
grep -r "jest.unstable_mockModule.*entities" src/lambdas/*/test/*.ts

# Each result should use createElectroDBEntityMock, not manual mocks
# Manual patterns to watch for:
# - jest.fn() followed by ElectroDB method names
# - Object literals with get, scan, query, create, update, delete
```

### If You Violate This Rule

The user WILL catch it and ask you to refactor. This wastes time and creates inconsistency.

**STOP. THINK. CHECK.** Are you mocking ElectroDB? If yes, use `createElectroDBEntityMock`.

### Real-World Example

**FileCoordinator Test** (src/lambdas/FileCoordinator/test/index.test.ts):

❌ **WRONG** - Manual mock:
```typescript
const filesQueryGoMock = jest.fn<() => Promise<{data: unknown[]} | undefined>>()
const filesQueryWhereMock = jest.fn(() => ({
  where: filesQueryWhereMock,
  go: filesQueryGoMock
}))
const filesQueryByStatusMock = jest.fn(() => ({
  where: filesQueryWhereMock,
  go: filesQueryGoMock
}))
jest.unstable_mockModule('../../../entities/Files', () => ({
  Files: {
    query: {
      byStatus: filesQueryByStatusMock
    }
  }
}))
```

✅ **RIGHT** - Using helper:
```typescript
import {createElectroDBEntityMock} from '../../../../test/helpers/electrodb-mock'

const filesMock = createElectroDBEntityMock({queryIndexes: ['byStatus']})
jest.unstable_mockModule('../../../entities/Files', () => ({
  Files: filesMock.entity
}))

// In test:
filesMock.mocks.query.byStatus!.go.mockResolvedValue({data: scanResponse.Items || []})
```

**Result**: Cleaner, type-safe, consistent with all other tests.

---

## 🚨 DEVELOPMENT PHILOSOPHY: DO IT THE RIGHT WAY FIRST 🚨

**THIS IS A CORE PROJECT PRINCIPLE. ALWAYS APPLY IT.**

### The Philosophy

When solving problems, **ALWAYS prioritize doing it the RIGHT way over doing it the least disruptive way.**

### What This Means

❌ **WRONG APPROACH** - Optimizing for backward compatibility at the expense of code quality:
- Creating translation layers to avoid changing existing code
- Adding complex marshalling/routing logic to preserve old interfaces
- Building elaborate compatibility wrappers around new libraries
- Choosing "least breaking" over "most correct"

✅ **RIGHT APPROACH** - Prioritizing correctness and simplicity:
- Using libraries and tools as they were designed to be used
- Refactoring existing code to adopt better patterns
- Embracing breaking changes when they lead to cleaner solutions
- Choosing "most correct" over "least effort"

### Why This Matters

**Choosing backward compatibility over correctness leads to:**
- ✗ Unnecessary complexity in the codebase
- ✗ More code to maintain and test
- ✗ Harder debugging when things go wrong
- ✗ Technical debt that compounds over time
- ✗ Confusion for future developers about "why is it done this way?"

**Choosing correctness leads to:**
- ✓ Simpler, more maintainable code
- ✓ Patterns that align with documentation and best practices
- ✓ Easier onboarding for new developers
- ✓ Less code overall (deletion is better than addition)
- ✓ Solutions that are obvious in retrospect

### Real-World Example: ElectroDB Migration

**WRONG (what was initially done)**:
```typescript
// Created elaborate DynamoDB wrapper that translates old calls to ElectroDB
// Added complex table routing logic
// Each Lambda still used old DynamoDB wrapper API
// Result: 3 layers of indirection, env var routing complexity, messy marshalling
```

**RIGHT (what should have been done)**:
```typescript
// Import ElectroDB entities directly in each Lambda
import {Files} from '../../../lib/vendor/ElectroDB/entities/Files'

// Use ElectroDB naturally
const file = await Files.get({fileId}).go()

// Result: Clean, direct, obvious. Each Lambda references only tables it uses.
```

### Application Guidelines

1. **When adopting a new library**: Use it as designed, don't wrap it to mimic the old one
2. **When refactoring**: Change the consumers, don't add compatibility layers
3. **When facing breaking changes**: Embrace them if they lead to better code
4. **When in doubt**: Ask "What would the library author recommend?" not "What changes the least code?"

### Enforcement

Before implementing a solution, ask yourself:

1. ✅ Am I using this library/pattern as it was designed?
2. ✅ Would a new developer looking at this code understand it without archaeology?
3. ✅ Am I adding indirection to avoid changing existing code?
4. ✅ Is this the simplest correct solution, or the simplest backward-compatible solution?

**If your answers reveal you're optimizing for backward compatibility over correctness, STOP and redesign.**

---

### Workflow
- **Format code automatically**: Run `npm run format` to auto-format all code with Prettier (250 char line width)
- Be sure to typecheck when you're done making a series of code changes
- Prefer running single tests, and not the whole test suite, for performance
- Don't output commands that just list files (like 'ls -l')
- Always ignore the `node_modules` directory when searching
- Always ignore the `dist` directory
- Always ignore the `package-lock.json` file when searching, unless your dealing with dependencies
- **Use TodoWrite tool** for complex tasks to track progress and ensure thoroughness - this prevents missing critical steps and provides visibility into progress

### Git Workflow (CRITICAL)

**IMPORTANT**: ONLY push to remote when explicitly asked by the user. Never push automatically.

**Commit Workflow**:
1. Make code changes
2. Run verification commands (see below)
3. Stage changes: `git add -A`
4. **VERIFY COMMIT MESSAGE**: Ensure NO AI references (Claude, Generated, Co-Authored-By, emojis)
5. Commit: `git commit -m "message"`
6. **STOP** - Wait for user to request push
7. ONLY when asked: `git push`

**Pre-Commit Verification (REQUIRED)**:
Before committing changes, ALWAYS run these commands to ensure code quality:

```bash
npm run format   # Auto-format all code with Prettier
npm run build    # Verify TypeScript compilation and webpack build
npm test         # Run full test suite to ensure all tests pass
```

All commands must complete successfully without errors before committing. This prevents broken builds in GitHub Actions and maintains code quality standards.

**Commit Message Verification (MANDATORY)**:
Your commit message must NEVER contain:
- "Claude" or "claude"
- "Generated" or "generated"
- "Co-Authored-By: Claude"
- Any emojis (🤖, ✨, etc.)
- "claude.com" or any AI tool references

### Jest Test Mocking Strategy (CRITICAL)

**Problem Solved**: Tests can fail with obscure 500 errors despite code working in production. Root cause: missing mocks for transitive dependencies.

#### The Core Issue: Module-Level Imports

In ES modules with Jest, **ALL module-level code executes when ANY function from that module is imported**. This means:

```typescript
// YouTube.ts
import YTDlpWrap from 'yt-dlp-wrap'  // ← Executes even if you only import getVideoID()
import {spawn} from 'child_process'   // ← Executes
import {Upload} from '@aws-sdk/lib-storage'  // ← Executes

export function getVideoID(url: string) { /* ... */ }  // ← What you actually imported
export function streamVideoToS3() { /* uses all the above */ }
```

When a test imports `getVideoID`, the entire YouTube module loads, attempting to instantiate all dependencies. **All must be mocked.**

#### Mandatory Testing Checklist

**For EVERY new test file:**

- [ ] **Step 1**: List all direct imports in the test
- [ ] **Step 2**: Read each source file and list its imports
- [ ] **Step 3**: Recursively map transitive dependencies (imports of imports)
- [ ] **Step 4**: Mock ALL external dependencies BEFORE importing handler
- [ ] **Step 5**: Verify mocks match module structure (classes vs functions)
- [ ] **Step 6**: Add proper TypeScript types to mocks (especially SDK clients)
- [ ] **Step 7**: Test locally AND in CI

#### Common Mocking Patterns

**Type Annotation Policy for jest.fn():**

❌ **AVOID truly generic type annotations**:
```typescript
// ❌ DON'T - `unknown` and `any` provide no type safety
const sendMock = jest.fn<() => Promise<unknown>>()
const updateMock = jest.fn<() => Promise<any>>()
```

❌ **NEVER use type escape hatches (as any, as unknown)**:
```typescript
// ❌ ABSOLUTELY FORBIDDEN - defeats the entire purpose of TypeScript
const queryMock = jest.fn() as any
const batchGetMock = jest.fn() as unknown

// ❌ FORBIDDEN - even for "just testing" or "quick fixes"
const result = data as any
const value = response as unknown as MyType
```

✅ **USE specific type annotations when using mockResolvedValue/mockReturnValue**:
```typescript
// ✅ DO - specific return shapes for AWS responses
const sendMock = jest.fn<() => Promise<{StatusCode: number}>>()
const updateMock = jest.fn<() => Promise<Record<string, unknown>>>()
const headObjectMock = jest.fn<() => Promise<{ContentLength: number}>>()
```

✅ **USE type annotations for domain-specific types**:
```typescript
// ✅ DO - provides meaningful type safety for domain models
const fetchVideoInfoMock = jest.fn<() => Promise<YtDlpVideoInfo>>()
const chooseFormatMock = jest.fn<() => YtDlpFormat>()
```

✅ **OMIT type annotations for simple mocks without mockResolvedValue/mockReturnValue**:
```typescript
// ✅ DO - TypeScript can infer from usage
const logDebugMock = jest.fn()
const spawnMock = jest.fn()
```

⚠️ **USE `Promise<void>` when calling mockResolvedValue(undefined)**:
```typescript
// ✅ DO - Promise<void> required for mockResolvedValue(undefined)
const copyFileMock = jest.fn<() => Promise<void>>()
// In test:
copyFileMock.mockResolvedValue(undefined)
```

**AWS SDK Clients** (require full type annotations for proper client structure):
```typescript
jest.unstable_mockModule('@aws-sdk/client-lambda', () => ({
  LambdaClient: jest.fn<() => {send: jest.Mock<() => Promise<{StatusCode: number}>>}>()
    .mockImplementation(() => ({
      send: jest.fn<() => Promise<{StatusCode: number}>>()
        .mockResolvedValue({StatusCode: 202})
    })),
  InvokeCommand: jest.fn()
}))
```

**NPM Class Constructors** (must be actual classes):
```typescript
class MockYTDlpWrap {
  constructor(public binaryPath: string) {}
  getVideoInfo = jest.fn()
}
jest.unstable_mockModule('yt-dlp-wrap', () => ({
  default: MockYTDlpWrap
}))
```

**Node.js Built-ins** (no type annotations needed):
```typescript
jest.unstable_mockModule('child_process', () => ({
  spawn: jest.fn()
}))

jest.unstable_mockModule('fs', () => ({
  promises: {
    copyFile: jest.fn()
  }
}))
```

#### Transitive Dependency Example

**Test Structure**:
```
WebhookFeedly test → handler import → getVideoID() from YouTube.ts
                                    → initiateFileDownload() from shared.ts
```

**Required Mocks** (ALL of these):
```typescript
// YouTube.ts dependencies (external packages)
jest.unstable_mockModule('yt-dlp-wrap', () => ({ default: MockYTDlpWrap }))
jest.unstable_mockModule('child_process', () => ({ spawn: jest.fn() }))
jest.unstable_mockModule('fs', () => ({ promises: { copyFile: jest.fn() } }))

// YouTube.ts dependencies (vendor wrappers - NEVER mock @aws-sdk/* directly)
jest.unstable_mockModule('./AWS/S3', () => ({
  headObject: jest.fn(),
  createS3Upload: jest.fn()
}))

// CloudWatch vendor wrapper (used by util/lambda-helpers)
jest.unstable_mockModule('./AWS/CloudWatch', () => ({
  putMetricData: jest.fn(),
  getStandardUnit: (unit?: string) => unit || 'None'
}))

// shared.ts dependencies (vendor wrappers - NEVER mock @aws-sdk/* directly)
jest.unstable_mockModule('./AWS/Lambda', () => ({
  invokeLambda: jest.fn<() => Promise<{StatusCode: number}>>()
    .mockResolvedValue({StatusCode: 202})
}))

// DynamoDB vendor wrapper
jest.unstable_mockModule('./AWS/DynamoDB', () => ({
  query: jest.fn(),
  updateItem: jest.fn()
}))

// THEN import the handler
const {handler} = await import('./../src')
```

**CRITICAL**: Notice we mock `./AWS/S3`, `./AWS/Lambda`, `./AWS/DynamoDB` (vendor wrappers), NOT `@aws-sdk/*` packages directly. This follows our AWS SDK Encapsulation Policy.

#### Why This Matters

**Without comprehensive mocking:**
- ✗ Tests fail with obscure 500 errors
- ✗ Error doesn't point to missing mock
- ✗ CI/CD blocks valid code
- ✗ Wastes hours debugging

**With comprehensive mocking:**
- ✓ Tests pass reliably
- ✓ Clear errors when mocks missing
- ✓ Fast iteration
- ✓ Follows AWS SDK Encapsulation Policy

#### Key Takeaway

**When importing ANY function from a module, you must mock ALL of that module's transitive dependencies:**
1. External NPM packages (yt-dlp-wrap, etc.)
2. Node.js built-ins (child_process, fs, etc.)
3. **Vendor wrappers** (lib/vendor/AWS/*) - NEVER mock @aws-sdk/* directly

---

### Library Migration Best Practices
When migrating libraries (e.g., jsonwebtoken → jose), follow these steps for success:

1. **Understand Type Compatibility**: New libraries may have different type systems. Extend custom interfaces from the new library's types (e.g., `interface CustomToken extends JWTPayload`) rather than casting to `unknown`

2. **Handle Key Formats Properly**: Different libraries expect different key formats. Use Node.js `crypto.createPrivateKey()` and `crypto.createPublicKey()` to normalize key handling rather than format-specific import methods

3. **Test with Real Implementations**: Don't just fix TypeScript errors - run the actual functions to catch runtime issues like algorithm mismatches or missing claims

4. **Maintain API Consistency**: Ensure the new library provides the same claims (e.g., `iat` timestamps) that existing code expects

5. **Update Test Fixtures Appropriately**: Adapt test mocks to work with the new library's expectations while keeping existing test data formats

6. **Follow the TodoWrite Pattern**: Break complex migrations into tracked steps to ensure nothing is missed and progress is visible

## Development Workflow

### Local Development Setup
1. Use Node Version Manager (nvm). Reference the .nvmrc file for version information.
2. Required tools: terraform, awscli, jq, quicktype, terraform-docs, act
3. AWS credentials must be configured
4. APNS certificates required for push notifications

### Build & Deployment Commands
- `npm run build` - Builds Lambda functions with webpack (each `src/lambdas/*/src/index.ts` becomes an entry point)
- `npm run deploy` - Deploys infrastructure with OpenTofu
- `npm run test` - Runs local tests
- `npm run test-remote-*` - Tests production endpoints
- `npm run document-source` - Generates TSDoc documentation

### Webpack Configuration & AWS SDK Dependencies
**CRITICAL**: When adding or changing AWS SDK dependencies, you MUST update the webpack externals configuration.

**Location**: `config/webpack.config.ts`

**Why**: Webpack bundles Lambda code and needs to know which dependencies to externalize (exclude from bundling). AWS SDK packages should be externalized because they're available in the Lambda runtime environment.

**Steps when adding new AWS SDK packages**:
1. Install the package: `npm install @aws-sdk/client-xyz`
2. Add to webpack externals in `config/webpack.config.ts`:
   ```typescript
   externals: {
     // ... existing entries
     '@aws-sdk/client-xyz': '@aws-sdk/client-xyz',
   }
   ```
3. Clean build and redeploy:
   ```bash
   rm -rf build/lambdas
   npm run build
   npm run deploy
   ```

**Common AWS SDK packages that need externals**:
- `@aws-sdk/client-lambda` - Lambda invocation
- `@aws-sdk/client-s3` - S3 operations
- `@aws-sdk/client-dynamodb` - DynamoDB client
- `@aws-sdk/lib-storage` - S3 multipart uploads
- `@aws-sdk/lib-dynamodb` - DynamoDB document client
- `@aws-sdk/client-sfn` - Step Functions (legacy)
- `@aws-sdk/client-sns` - SNS notifications
- `@aws-sdk/client-sqs` - SQS queues

**Troubleshooting**: If OpenTofu shows "No changes" after code updates, check:
1. Archive hash in OpenTofu output - should change when code changes
2. Webpack externals - missing entries cause old code to bundle
3. Build output - verify new packages are externalized, not bundled

### Testing Strategy

#### Unit Tests
- **Location**: Each Lambda has `test/index.test.ts` alongside `src/index.ts`
- **Framework**: Jest with ES modules support
- **Mocking**: Comprehensive mocking of AWS SDK and external dependencies
- **Fixtures**: JSON mock data in `test/fixtures/` directories
- **Utilities**: Most `util/*.ts` files have corresponding `*.test.ts` files
- **Setup**: `util/jest-setup.ts` configures the test environment
- **Run**: `npm test`

#### Integration Tests with LocalStack
- **Location**: `test/integration/` organized by AWS service (s3, dynamodb, lambda, etc.)
- **Framework**: Jest with LocalStack environment configuration
- **Purpose**: Verify AWS service interactions work correctly without mocking
- **Environment**: LocalStack running on `http://localhost:4566`
- **Architecture**: Uses vendor wrappers with `USE_LOCALSTACK=true` environment variable
- **Commands**:
  - `npm run localstack:start` - Start LocalStack container
  - `npm run localstack:stop` - Stop LocalStack container
  - `npm run localstack:logs` - View LocalStack logs
  - `npm run localstack:health` - Check LocalStack service health
  - `npm run test:integration` - Run integration tests (assumes LocalStack running)
  - `npm run test:integration:full` - Full test suite with LocalStack lifecycle management
- **CI/CD**: GitHub Actions workflow automatically runs integration tests on push/PR
- **Configuration**: `config/jest.integration.config.mjs` and `docker-compose.localstack.yml`
- **Documentation**: See `test/integration/README.md` for detailed information

#### Production Integration Tests
- **Purpose**: Remote endpoint testing against production AWS
- **Commands**:
  - `test-remote-list` - Tests file listing
  - `test-remote-hook` - Tests Feedly webhook
  - `test-remote-registerDevice` - Tests device registration

#### Pipeline Tests
- **Location**: `pipeline/` directory
- **Purpose**: GitHub Actions workflow validation
- **Framework**: act (local GitHub Actions runner)

## API Design

### Authentication
- Custom authorizer Lambda function
- Query-based API tokens (required for Feedly integration)
- Device tokens for push notifications

### Main Endpoints
- **GET /files**: Lists downloadable media files
- **POST /webhook**: Feedly webhook receiver
- **POST /device/register**: Registers iOS devices for push notifications

## Integration Points

### Third-Party Libraries
- **Vendor Wrappers**: Custom wrappers in `lib/vendor/` for external APIs
- **Validation**: Uses `validate.js` with constraints defined in `util/constraints.ts`

### iOS Companion App
- Repository: `ios-OfflineMediaDownloader`
- Uses SwiftUI and The Compostable Architecture (TCA)
- Handles offline media playback
- Receives push notifications for download completion

### Feedly Integration
- Webhook-based triggers for media downloads
- Custom authorizer supports Feedly's authentication model

### GitHub Integration
- Automated issue creation for production errors
- Requires GitHub Personal Access Token in environment variable

## Security Considerations

### Sensitive Files Management
- Secrets are managed via SOPS
- All secrets are outlined in the README and stored as `secrets.yaml`
- Never read the `secrets.yaml` file
- Use environment variables for production secrets
- The file `secrets.encrypted.yaml` is read by OpenTofu at deploy time

### Certificate Management
- APNS requires p12 certificate conversion
- Separate private key and certificate files
- Sandbox vs Production environments

## Code Style & Documentation

### 🚨 MANDATORY: Style Guides 🚨

**BEFORE WRITING ANY CODE, YOU MUST READ AND FOLLOW THE APPLICABLE STYLE GUIDE.**

This project has four comprehensive style guides that define ALL coding standards:

1. **`docs/styleGuides/lambdaStyleGuide.md`** - Lambda function patterns
   - Import organization
   - Environment variables
   - Error handling patterns
   - Logging conventions
   - AWS service wrapper usage
   - Response patterns
   - **YOU MUST FOLLOW THIS FOR ALL LAMBDA CODE**

2. **`docs/styleGuides/testStyleGuide.md`** - Testing patterns
   - Jest mocking strategies
   - Test file organization
   - Fixture management
   - Mock naming conventions
   - **YOU MUST FOLLOW THIS FOR ALL TEST CODE**

3. **`docs/styleGuides/bashStyleGuide.md`** - Bash script patterns
   - Variable naming (snake_case vs UPPER_CASE)
   - Error handling with `set -e`
   - Directory resolution
   - User output formatting
   - **YOU MUST FOLLOW THIS FOR ALL BASH SCRIPTS**

4. **`docs/styleGuides/tofuStyleGuide.md`** - OpenTofu infrastructure patterns
   - Resource naming (PascalCase)
   - File organization
   - Environment variable consistency
   - Comment usage (no removed resource explanations)
   - **YOU MUST FOLLOW THIS FOR ALL OPENTOFU CODE**

**THESE STYLE GUIDES ARE NOT SUGGESTIONS. THEY ARE REQUIREMENTS.**

### TypeScript Guidelines
- **Type Definitions**: Centralized in `types/` directory
- **Strict Typing**: Enabled for all Lambda functions
- **TSDoc**: Required for all public functions in Lambda handlers
- **Generated Documentation**: Run `npm run document-source` to update `docs/source/`

### OpenTofu Best Practices
- **Lambda Mapping**: Each Lambda in `terraform/` corresponds to a directory in `src/lambdas/`
- **Modular Resources**: Separate `.tf` files for different resource types
- **Documentation**: Use terraform-docs to generate infrastructure documentation

## Common Development Tasks

### Utility Modules Reference
When developing Lambda functions, utilize these shared utilities:
- **API Gateway**: `util/apigateway-helpers.ts` for request/response handling
- **Validation**: `util/constraints.ts` with validate.js for input validation
- **Database**: `util/dynamodb-helpers.ts` for DynamoDB operations
- **Secrets**: `util/secretsmanager-helpers.ts` for secure credential access
- **Error Handling**: `util/errors.ts` for consistent error types
- **GitHub Integration**: `util/github-helpers.ts` for issue creation
- **Data Transformation**: `util/transformers.ts` for format conversions
- **Shared Logic**: `util/shared.ts` for cross-lambda functionality

### Adding New Lambda Functions
1. Create directory structure: `src/lambdas/[function-name]/`
2. Implement handler in `src/index.ts` with TypeDoc comments
3. Write Jest tests in `test/index.test.ts`
4. Add test fixtures in `test/fixtures/`
5. Define Lambda resource in OpenTofu
6. Configure webpack entry point
7. Add appropriate IAM permissions
8. Import and use utilities from `util/` directory

### Modifying API Endpoints
1. Update API Gateway configuration in OpenTofu
2. Modify Lambda handler code
3. Update custom authorizer if needed
4. Test with `test-remote-*` scripts

### Debugging Production Issues
1. Check CloudWatch logs
2. Review automated GitHub issues
3. Use AWS X-Ray for tracing (if enabled)
4. Test with production-like data locally

## Lambda Handler Pattern

Each Lambda function in `src/lambdas/[name]/src/index.ts` follows this pattern:
1. Import utilities from `util/` directory as needed
2. Import types from `types/` directory
3. Define handler function with TypeDoc documentation
4. Use `util/constraints.ts` for input validation
5. Use `util/lambdas-helpers.ts` for response formatting and logging
6. Use `util/errors.ts` for error handling
7. Export handler for AWS Lambda runtime

Example structure:
```typescript
import { validateInput } from '../../../util/constraints';
import { prepareLambdaResponse, logError } from '../../../util/lambdas-helpers';
import { CustomError } from '../../../util/errors';

/**
 * Handler description for TypeDoc
 * @param event - AWS Lambda event
 * @param context - AWS Lambda context
 */
export const handler = async (event, context) => {
    // Implementation
};
```

## Performance Considerations

- Lambda memory allocation optimization
- S3 transfer acceleration for large files
- API Gateway caching strategies
- Cold start mitigation techniques

## Environment Variables & Configuration

## Monitoring & Observability

- CloudWatch metrics for Lambda invocations
- S3 bucket metrics for storage usage
- API Gateway request/response logging
- Error tracking via GitHub issue automation

## Convention Over Configuration Philosophy
This project follows convention over configuration principles:
- Minimal custom code, maximum AWS service utilization
- Standard project structure
- Predictable naming conventions
- Default behaviors where sensible

## Critical Dependencies
- Node.js version must match AWS Lambda runtime
- OpenTofu version compatibility
- APNS certificate validity and renewal
- AWS service quotas and limits

## Dependabot Update Resolution

When a Dependabot PR is created for a dependency update, use this automated resolution process:

1. **Identify the Update**:
   - Find and examine the open Dependabot PR
   - Extract the dependency name, current version, and target version
   - Review the changelog/release notes for breaking changes, security fixes, and new features

2. **Impact Analysis**:
   - Search the codebase for all files that import or use this dependency
   - Identify direct usage, type imports, and any dependency-specific configurations
   - Assess the scope of potential impact on the codebase

3. **Compatibility Verification**:
   - Check if the new version is compatible with our Node.js/runtime version
   - Verify TypeScript type compatibility if applicable
   - Review any peer dependency requirements

4. **Automated Testing**:
   - Run the build process (`npm run build`) to catch compilation errors
   - Execute the full test suite (`npm test`) to ensure functionality
   - Check for any failing tests or type errors

5. **Security & Quality Review**:
   - Evaluate any security fixes in the update
   - Review bug fixes that might affect our usage patterns
   - Assess performance improvements or regressions

6. **Resolution**:
   - If all checks pass: merge the PR automatically
   - If issues found: investigate and fix them, then merge
   - If breaking changes require significant work: document the migration plan and notify me

7. **Documentation**:
   - Briefly summarize what was updated and any notable changes
   - Report the final status (merged, needs attention, etc.)

Execute this process autonomously and only notify me if manual intervention is required for breaking changes or complex migration scenarios.

## Support & Maintenance
- **CI/CD**: GitHub Actions workflows with tests in `pipeline/` directory
- **Local CI Testing**: Use `act` to run GitHub Actions locally
- **Documentation**: Generated via TSDoc from Lambda source files
- **Infrastructure Docs**: Generated with terraform-docs
- **Automated Testing**: Jest tests for regression prevention
- **Error Tracking**: Automated GitHub issue creation for production errors

## Remote Testing Workflow

This section outlines a common workflow for remotely testing the media download process.

### 1. Trigger the File Coordinator

To initiate the process, invoke the `FileCoordinator` Lambda function. This function scans for files that need to be downloaded and starts the process.

```bash
aws lambda invoke \
  --function-name FileCoordinator \
  --region us-west-2 \
  --payload '{}' \
  /dev/null
```

This command invokes the `FileCoordinator` function with an empty JSON payload. The response from the lambda is discarded by redirecting it to `/dev/null`.

### 2. Monitor the StartFileUpload Logs

After triggering the `FileCoordinator`, you can monitor the logs of the `StartFileUpload` Lambda to observe the file upload process.

```bash
aws logs tail /aws/lambda/StartFileUpload --region us-west-2 --follow --format short
```

This command will stream the logs from the `/aws/lambda/StartFileUpload` log group, allowing you to see real-time updates. The `--follow` flag keeps the connection open and continues to display new log entries.

### 3. Testing The StartFileUpload Lambda with Error Filtering

The following command invokes the `FileCoordinator` lambda, waits for 5 seconds, and then filters the logs of the `StartFileUpload` lambda for "ERROR" messages in the last 5 minutes.

```bash
aws lambda invoke \
  --function-name FileCoordinator \
  --region us-west-2 \
  --payload '{}' \
  /dev/null && \
  sleep 5 && \
  aws logs filter-log-events \
  --log-group-name /aws/lambda/StartFileUpload \
  --region us-west-2 \
  --start-time $(date -v-5M +%s000) \
  --filter-pattern "ERROR"
```

### 4. Known Issue: YouTube Authentication

A known issue with video downloads is a `yt-dlp` error related to YouTube authentication. The error message is:

```
ERROR: [youtube] <video-id>: Sign in to confirm you're not a bot. Use --cookies-from-browser or --cookies for the authentication.
```

This error occurs because YouTube is blocking requests from AWS Lambda datacenter IPs. This is resolved by implementing cookie-based authentication.
