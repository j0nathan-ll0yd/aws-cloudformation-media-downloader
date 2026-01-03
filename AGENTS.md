# Project Context for AI Agents

AWS Serverless media downloader service built with OpenTofu and TypeScript. Downloads YouTube videos for offline playback via a companion iOS app.

---

## TL;DR (Quick Reference)

**Stack**: TypeScript, AWS Lambda (Node.js 22.x), Aurora DSQL (Drizzle ORM), S3, API Gateway

### 5 CRITICAL Rules (Zero Tolerance)

1. **Vendor Encapsulation**: NEVER import `@aws-sdk/*` directly. Use `#lib/vendor/AWS/`
2. **Entity Mocking**: Mock `#entities/queries`, NOT legacy entity modules
3. **No AI in Commits**: NO emojis, "Claude", "AI", "Generated with" in commit messages
4. **Cascade Deletions**: Use `Promise.allSettled`, delete children before parents
5. **Environment Variables**: Use `getRequiredEnv()` inside functions, not at module level

### Essential Commands

```bash
pnpm run precheck           # TypeScript + ESLint (run before commits)
pnpm run validate:conventions  # AST-based convention checks
pnpm run test               # Unit tests
```

### Key Files

- **Conventions**: `docs/wiki/Meta/Conventions-Tracking.md`
- **Dependencies**: `build/graph.json` (use for test mocking)
- **Testing**: `test/helpers/entity-fixtures.ts`, `test/helpers/aws-sdk-mock.ts`

---

## Anti-Patterns to Avoid

The following patterns have caused issues in this project and should be avoided:

### 1. Direct Vendor Library Imports (CRITICAL)
**Wrong**: `import {DynamoDBClient} from '@aws-sdk/client-dynamodb'`
**Right**: `import {getDynamoDBClient} from '#lib/vendor/AWS/DynamoDB'`
**Why**: Breaks encapsulation, makes testing difficult, loses environment detection (LocalStack/X-Ray)
**Applies to**: AWS SDK, Drizzle, Better Auth, yt-dlp, and all third-party services

### 2. Legacy Entity Module Mocks (CRITICAL)
**Wrong**: `vi.mock('#entities/Users', () => ({...}))`
**Right**: `vi.mock('#entities/queries', () => ({getUser: vi.fn(), createUser: vi.fn()}))`
**Why**: Legacy entity module mocking is deprecated; use query function mocking with `#entities/queries`

### 3. Promise.all for Cascade Deletions (CRITICAL)
**Wrong**: `await Promise.all([deleteUser(), deleteUserFiles()])`
**Right**: `await Promise.allSettled([deleteUserFiles(), deleteUser()])`
**Why**: Partial failures leave orphaned data; children must be deleted before parents

### 4. Try-Catch for Required Environment Variables (CRITICAL)
**Wrong**: `try { config = JSON.parse(process.env.CONFIG) } catch { return fallback }`
**Right**: `const config = getRequiredEnv('CONFIG')` - let it fail fast
**Why**: Silent failures hide configuration errors that should break at cold start

### 5. Underscore-Prefixed Unused Variables (HIGH)
**Wrong**: `handler(event, _context, _callback)` to suppress warnings
**Right**: `handler({body}: APIGatewayProxyEvent)` - destructure only what you need
**Why**: Backwards-compatibility hacks obscure intent and violate project conventions

### 6. AI Attribution in Commits (CRITICAL)
**Wrong**: Commit messages with "Generated with Claude", emojis, "Co-Authored-By: AI"
**Right**: Clean commit messages following commitlint format: `feat: add new feature`
**Why**: Professional commits, code ownership clarity, industry standard

### 7. Module-Level Environment Variable Validation (HIGH)
**Wrong**: `const config = getRequiredEnv('CONFIG')` at top of module
**Right**: Call `getRequiredEnv()` inside functions (lazy evaluation)
**Why**: Module-level calls break tests that need to set up mocks before import

### 8. Raw Response Objects in Lambdas (HIGH)
**Wrong**: `return {statusCode: 200, body: JSON.stringify(data)}`
**Right**: `return response(200, data)`
**Why**: Inconsistent formatting, missing headers, no type safety

---

## Critical Project-Specific Rules

1. **Use build/graph.json for dependency analysis**:
   - Auto-generated before every build
   - Shows file-level imports and transitive dependencies
   - **CRITICAL for Vitest tests**: Use `transitiveDependencies` to find all mocks needed
   - Example: `cat build/graph.json | jq '.transitiveDependencies["src/lambdas/WebhookFeedly/src/index.ts"]'`
2. **pnpm lifecycle script protection** (security hardening):
   - All lifecycle scripts disabled by default in `.npmrc`
   - Protects against AI-targeted typosquatting and supply chain attacks
   - Scripts blocked during installation - must explicitly allowlist packages
3. **Feedly webhook** uses query-based authentication (custom authorizer)
4. **APNS certificates** required for iOS push notifications (p12 format)
5. **YouTube downloads** require cookie authentication due to bot detection
6. **LocalStack integration** for local AWS testing via vendor wrappers

---

## Convention Capture System

**CRITICAL**: This project captures emergent conventions during development. Read `docs/wiki/Meta/Conventions-Tracking.md` at session start.

### Detection Signals
- **CRITICAL**: "NEVER", "FORBIDDEN", "Zero-tolerance"
- **HIGH**: "MUST", "REQUIRED", "ALWAYS"
- **MEDIUM**: "Prefer X over Y", repeated decisions

### When Convention Detected
1. Update `docs/wiki/Meta/Conventions-Tracking.md` with the new convention
2. Document in appropriate wiki page under `docs/wiki/`
3. Mark as documented in tracking file

**Philosophy**: Current state documented in wiki. History lives in git/PRs. No duplicate documentation.

---

## Project Overview

### Architecture
- **Infrastructure**: OpenTofu (IaC)
- **Runtime**: AWS Lambda (Node.js 22.x)
- **Language**: TypeScript
- **Storage**: Amazon S3
- **API**: AWS API Gateway with custom authorizer
- **Notifications**: Apple Push Notification Service (APNS)
- **Database**: Aurora DSQL with Drizzle ORM
- **Monitoring**: CloudWatch, X-Ray (optional)

### Project Structure
```
.
├── terraform/             # AWS Infrastructure (OpenTofu)
├── src/
│   ├── entities/queries/  # Drizzle query modules
│   ├── lambdas/           # Lambda functions
│   ├── lib/vendor/        # AWS SDK & 3rd party wrappers
│   └── mcp/               # MCP server & validation rules
├── test/helpers/          # Test utilities (fixtures, mocks)
├── types/                 # TypeScript definitions
├── docs/wiki/             # All documentation
└── build/graph.json       # Dependency graph (READ THIS)
```

---

## System Architecture

### Service Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        API Gateway                          │
│                    (Custom Authorizer)                      │
└────────────┬────────────────────────────────────┬───────────┘
             │                                    │
             ▼                                    ▼
┌─────────────────────┐              ┌─────────────────────┐
│   Lambda Functions  │              │   External Services │
├─────────────────────┤              ├─────────────────────┤
│ • ListFiles         │              │ • Feedly API        │
│ • LoginUser         │              │ • YouTube (yt-dlp)  │
│ • RegisterDevice    │              │ • APNS              │
│ • StartFileUpload   │              │ • Sign In w/ Apple  │
│ • WebhookFeedly     │              │ • GitHub API        │
└──────────┬──────────┘              └─────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│                     AWS Services Layer                      │
├─────────────────────┬───────────────┬──────────────────────┤
│   Aurora DSQL       │      S3       │    CloudWatch        │
│   (Drizzle ORM)     │  (Media Files)│   (Logs/Metrics)     │
└─────────────────────┴───────────────┴──────────────────────┘
```

**Full diagrams**: [docs/wiki/Architecture/System-Diagrams.md](docs/wiki/Architecture/System-Diagrams.md) (Mermaid flowcharts, ER diagrams)

### Key Lambda Triggers

| Lambda | Trigger | Purpose |
|--------|---------|---------|
| ListFiles | API Gateway | List user's files |
| LoginUser | API Gateway | Authenticate user |
| RegisterDevice | API Gateway | Register iOS device |
| StartFileUpload | SQS | Download video to S3 |
| WebhookFeedly | API Gateway | Process Feedly articles |
| S3ObjectCreated | S3 Event | Notify users of uploads |
| PruneDevices | CloudWatch | Clean inactive devices |

---

## Drizzle ORM Architecture

**CRITICAL**: This project uses Drizzle ORM with Aurora DSQL for type-safe, serverless database operations.

### Key Features
- **Serverless Aurora DSQL**: PostgreSQL-compatible with automatic scaling, no VPC required
- **IAM Authentication**: Secure connection using AWS IAM tokens (auto-refreshed)
- **Type-safe queries**: Full TypeScript type inference for all operations

### Entity Relationships
- **Users** <-> **Files**: Many-to-many via UserFiles
- **Users** <-> **Devices**: Many-to-many via UserDevices
- **Users** <-> **Sessions**: One-to-many (Better Auth)
- **Files** <-> **FileDownloads**: One-to-many (tracking)

### Testing
- **ALWAYS** mock `#entities/queries` with `vi.mock()` and `vi.fn()`
- **PREFER** `test/helpers/entity-fixtures.ts` for mock data
- **PREFER** `test/helpers/aws-sdk-mock.ts` for AWS SDK mocking
- See [Vitest Mocking Strategy](docs/wiki/Testing/Vitest-Mocking-Strategy.md)

---

## Wiki Conventions

**BEFORE WRITING ANY CODE, READ THE APPLICABLE GUIDE:**

### Core Conventions
- **Git Workflow**: [docs/wiki/Conventions/Git-Workflow.md](docs/wiki/Conventions/Git-Workflow.md) - NO AI attribution
- **Vendor Encapsulation**: [docs/wiki/Conventions/Vendor-Encapsulation-Policy.md](docs/wiki/Conventions/Vendor-Encapsulation-Policy.md) - ZERO tolerance
- **Naming**: [docs/wiki/Conventions/Naming-Conventions.md](docs/wiki/Conventions/Naming-Conventions.md)

### TypeScript & Testing
- **Lambda Patterns**: [docs/wiki/TypeScript/Lambda-Function-Patterns.md](docs/wiki/TypeScript/Lambda-Function-Patterns.md)
- **Vitest Mocking**: [docs/wiki/Testing/Vitest-Mocking-Strategy.md](docs/wiki/Testing/Vitest-Mocking-Strategy.md)
- **Integration Testing**: [docs/wiki/Integration/LocalStack-Testing.md](docs/wiki/Integration/LocalStack-Testing.md)

---

## Development Workflow

### Essential Commands
```bash
# Build & Check
pnpm run precheck       # TypeScript + ESLint (run before commits)
pnpm run build          # Build Lambda functions
pnpm run format         # Auto-format with dprint

# Testing
pnpm run test           # Unit tests
pnpm run ci:local       # Fast CI checks (~2-3 min)

# AI Context
pnpm run pack:context   # Pack codebase for AI sessions
pnpm run index:codebase # Re-index semantic search
pnpm run validate:conventions # Check convention compliance
```

### Pre-Commit Checklist
1. `pnpm run validate:conventions` - Ensure no rule violations
2. `pnpm run precheck` - TypeScript + ESLint
3. `pnpm run format` - Auto-format
4. `pnpm run test` - All tests pass
5. **NO AI references** in commit message
6. Commit with clean message: `git commit -m "type: description"`

---

## Type Naming Patterns

| Pattern | Usage | Examples |
|---------|-------|----------|
| Simple nouns | Domain entities | `User`, `File`, `Device` |
| `*Row` | Drizzle database rows | `UserRow`, `FileRow` |
| `*Item` | Entity with joins | `UserItem`, `FileItem` |
| `*Input` | Request payloads | `UserLoginInput`, `CreateFileInput` |
| `*Response` | API responses | `FileResponse`, `LoginResponse` |

---

## AI Context Optimization

This repository is optimized for AI agents using:
- **Semantic Memory**: LanceDB for natural language code search (`pnpm run index:codebase`)
- **Repomix**: Packed codebase in `repomix-output.xml` (`pnpm run pack:context`)
- **Convention Validation**: CI/CD enforcement via `pnpm run validate:conventions`
- **Gemini Instructions**: `.gemini/instructions.md`

### Context Files

| File | Purpose | Generation |
|------|---------|------------|
| `docs/llms.txt` | External AI crawler index | Manual |
| `repomix-output.xml` | Full codebase context | `pnpm run pack:context` |

---

## Quick Reference

### Integration Points
- **Feedly**: Webhook article processing (query auth)
- **YouTube**: yt-dlp downloads (cookie auth)
- **APNS**: iOS push notifications (p12 certs)
- **Sign In With Apple**: iOS authentication

### AWS Services
- **Lambda**: All business logic
- **S3**: Media storage (transfer acceleration)
- **Aurora DSQL**: Drizzle ORM database
- **API Gateway**: REST endpoints
- **CloudWatch**: Logs and metrics

### Common Tasks
- **Add Lambda**: See [docs/wiki/TypeScript/Lambda-Function-Patterns.md](docs/wiki/TypeScript/Lambda-Function-Patterns.md)
- **Debug Production**: CloudWatch logs, X-Ray tracing
- **Update API**: OpenTofu config + Lambda handler

---

**Remember**: Use TodoWrite tool for complex tasks to track progress and ensure thoroughness.
