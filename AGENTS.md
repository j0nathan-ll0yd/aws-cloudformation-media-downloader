# Project Context for AI Agents

## Convention Capture System

**CRITICAL**: This project captures emergent conventions during development. Read `docs/wiki/Meta/Conventions-Tracking.md` at session start.

### Detection Signals:
- 🚨 **CRITICAL**: "NEVER", "FORBIDDEN", "Zero-tolerance"
- ⚠️ **HIGH**: "MUST", "REQUIRED", "ALWAYS"
- 📋 **MEDIUM**: "Prefer X over Y", repeated decisions

### When Convention Detected:
1. Update `docs/wiki/Meta/Conventions-Tracking.md` with the new convention
2. Document in appropriate wiki page under `docs/wiki/`
3. Mark as documented in tracking file

### Reference:
- **Active Conventions**: `docs/wiki/Meta/Conventions-Tracking.md`
- **Documentation Guide**: `docs/wiki/Meta/Convention-Capture-System.md`

**Philosophy**: Current state documented in wiki. History lives in git/PRs. No duplicate documentation.

---

## Project Overview

AWS Serverless media downloader service built with OpenTofu and TypeScript. Downloads media content (primarily YouTube videos) and integrates with a companion iOS app for offline playback. Created as a cost-effective alternative to YouTube Premium's offline playback feature.

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
├── terraform/             # AWS Infrastructure definitions (OpenTofu)
├── src/
│   ├── entities/          # Entity query functions (Drizzle ORM with Aurora DSQL)
│   │   └── queries/       # Native Drizzle query modules
│   │       ├── userQueries.ts        # User operations (create, get, update, delete)
│   │       ├── fileQueries.ts        # File and FileDownload operations
│   │       ├── deviceQueries.ts      # Device operations
│   │       ├── sessionQueries.ts     # Session, Account, VerificationToken operations
│   │       ├── relationshipQueries.ts # UserFiles, UserDevices operations
│   │       ├── preparedQueries.ts    # Performance-critical prepared statements
│   │       ├── cascadeOperations.ts  # Transaction-wrapped multi-entity operations
│   │       └── index.ts              # Barrel export for all queries
│   ├── lambdas/           # Lambda functions (each subdirectory = one Lambda)
│   │   └── [lambda-name]/
│   │       ├── src/index.ts         # Lambda handler
│   │       └── test/index.test.ts   # Unit tests
│   ├── lib/vendor/        # 3rd party API wrappers & AWS SDK encapsulation
│   │   ├── AWS/           # AWS SDK vendor wrappers (src/lib/vendor/AWS/)
│   │   ├── BetterAuth/    # Better Auth configuration & adapter
│   │   ├── Drizzle/       # Drizzle ORM configuration & schema
│   │   └── YouTube.ts     # YouTube/yt-dlp wrapper
│   └── mcp/               # Model Context Protocol server & validation
│       ├── server.ts      # MCP server entry point
│       ├── handlers/      # Query tools (entities, lambda, infrastructure, etc.)
│       └── validation/    # AST-based convention enforcement (21 rules)
├── test/helpers/          # Test utilities
│   ├── entity-fixtures.ts # Factory functions for mock entity rows
│   └── aws-sdk-mock.ts    # AWS SDK v3 mock helpers (aws-sdk-client-mock)
├── types/                 # TypeScript type definitions
├── util/                  # Shared utility functions
├── docs/
│   └── wiki/              # All documentation and style guides
│       └── Meta/Conventions-Tracking.md  # Project-specific conventions
└── build/graph.json       # Code graph (ts-morph) - READ THIS
```

## System Architecture

See [System Diagrams](docs/wiki/Architecture/System-Diagrams.md) for visual representations:
- **Lambda Data Flow**: API Gateway → Lambdas → Aurora DSQL/S3
- **Entity Relationships**: Users ↔ Files/Devices (many-to-many), Sessions/Accounts (one-to-many)
- **Service Interaction Map**: External services, AWS layer

### Key Architecture Points

| Component | Technology | Purpose |
|-----------|------------|---------|
| Database | Aurora DSQL + Drizzle | Serverless PostgreSQL, type-safe queries |
| Auth | Better Auth | Sessions, OAuth accounts, tokens |
| Storage | S3 | Media files with transfer acceleration |
| Events | EventBridge + SQS | Async processing, notifications |

### Dependency Analysis with graph.json

The `build/graph.json` file contains comprehensive dependency information. Key queries:

```bash
# Get all transitive dependencies for a Lambda function
cat build/graph.json | jq '.transitiveDependencies["src/lambdas/ListFiles/src/index.ts"]'

# Find all files that import a specific module
cat build/graph.json | jq '.files | to_entries[] | select(.value.imports[]? | contains("entities/Files")) | .key'

# List all Lambda entry points
cat build/graph.json | jq '.files | keys[] | select(contains("src/lambdas") and contains("/src/index.ts"))'

# Get import count for complexity analysis
cat build/graph.json | jq '.files | to_entries | map({file: .key, importCount: (.value.imports | length)}) | sort_by(.importCount) | reverse[:10]'
```

### Keeping MCP & GraphRAG in Sync

The MCP server (`src/mcp/`) and GraphRAG (`graphrag/`) use shared data sources for accuracy:

| Data Source | Purpose | Auto-Updated |
|-------------|---------|--------------|
| `src/lambdas/` | Lambda discovery | ✓ Filesystem scan |
| `src/entities/` | Entity discovery | ✓ Filesystem scan |
| `build/graph.json` | Dependencies | ✓ Generated before build |
| `graphrag/metadata.json` | Semantic info | ✗ Manual updates required |

**When adding/removing Lambdas or Entities:**
1. The MCP handlers and GraphRAG auto-discover from filesystem
2. Update `graphrag/metadata.json` with trigger types and purposes
3. Run `pnpm run graphrag:extract` to regenerate the knowledge graph
4. CI will fail if `knowledge-graph.json` is out of date

**When changing Lambda invocation chains:**
1. Update `graphrag/metadata.json` `lambdaInvocations` array
2. Run `pnpm run graphrag:extract`

See [System Diagrams](docs/wiki/Architecture/System-Diagrams.md) for Lambda Trigger Patterns and Data Access Patterns tables.

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
   - If package requires install scripts, audit code first then add to `.npmrc`
3. **Feedly webhook** uses query-based authentication (custom authorizer)
4. **APNS certificates** required for iOS push notifications (p12 format)
5. **YouTube downloads** require cookie authentication due to bot detection
6. **LocalStack integration** for local AWS testing via vendor wrappers
7. **Webpack externals** must be updated when adding AWS SDK packages

## Drizzle ORM Architecture

**CRITICAL**: This project uses Drizzle ORM with Aurora DSQL for type-safe, serverless database operations.

### Key Drizzle Features
- **Serverless Aurora DSQL**: PostgreSQL-compatible with automatic scaling, no VPC required
- **IAM Authentication**: Secure connection using AWS IAM tokens (auto-refreshed)
- **Type-safe queries**: Full TypeScript type inference for all operations
- **Relational support**: Standard SQL JOINs, foreign keys (application-enforced)

### Entity Relationships
- **Users** ↔ **Files**: Many-to-many via UserFiles entity
- **Users** ↔ **Devices**: Many-to-many via UserDevices entity
- **Users** ↔ **Sessions**: One-to-many (Better Auth sessions)
- **Users** ↔ **Accounts**: One-to-many (Better Auth OAuth accounts)
- **Files** ↔ **FileDownloads**: One-to-many (download tracking)

### Testing with Drizzle
- **ALWAYS** mock `#entities/queries` with `vi.mock()` and `vi.fn()` for each query function
- **PREFER** `test/helpers/entity-fixtures.ts` for creating mock entity data
- See [Vitest Mocking Strategy](docs/wiki/Testing/Vitest-Mocking-Strategy.md) for patterns

### Testing with AWS SDK
- **PREFER** `test/helpers/aws-sdk-mock.ts` for AWS SDK v3 mocking (uses aws-sdk-client-mock)
- Mock helpers integrate with vendor wrappers via test client injection
- See [Vitest Mocking Strategy](docs/wiki/Testing/Vitest-Mocking-Strategy.md) for patterns

## Wiki Conventions to Follow

**BEFORE WRITING ANY CODE, READ THE APPLICABLE GUIDE:**

### Core Conventions
- **Git Workflow**: [docs/wiki/Conventions/Git-Workflow.md](docs/wiki/Conventions/Git-Workflow.md) - NO AI attribution in commits
- **Naming**: [docs/wiki/Conventions/Naming-Conventions.md](docs/wiki/Conventions/Naming-Conventions.md) - camelCase, PascalCase rules
- **Comments**: [docs/wiki/Conventions/Code-Comments.md](docs/wiki/Conventions/Code-Comments.md) - Git as source of truth

### TypeScript & Testing
- **Lambda Patterns**: [docs/wiki/TypeScript/Lambda-Function-Patterns.md](docs/wiki/TypeScript/Lambda-Function-Patterns.md)
- **Entity Queries**: [docs/wiki/TypeScript/Entity-Query-Patterns.md](docs/wiki/TypeScript/Entity-Query-Patterns.md) - Drizzle ORM patterns
- **System Library**: [docs/wiki/TypeScript/System-Library.md](docs/wiki/TypeScript/System-Library.md) - Circuit breaker, retry, errors
- **Vitest Mocking**: [docs/wiki/Testing/Vitest-Mocking-Strategy.md](docs/wiki/Testing/Vitest-Mocking-Strategy.md)
- **Mock Types**: [docs/wiki/Testing/Mock-Type-Annotations.md](docs/wiki/Testing/Mock-Type-Annotations.md)
- **Coverage Philosophy**: [docs/wiki/Testing/Coverage-Philosophy.md](docs/wiki/Testing/Coverage-Philosophy.md)
- **Integration Testing**: [docs/wiki/Integration/LocalStack-Testing.md](docs/wiki/Integration/LocalStack-Testing.md)

### AWS & Infrastructure
- **Vendor Encapsulation**: [docs/wiki/Conventions/Vendor-Encapsulation-Policy.md](docs/wiki/Conventions/Vendor-Encapsulation-Policy.md) - ZERO tolerance
- **Bash Scripts**: [docs/wiki/Bash/Script-Patterns.md](docs/wiki/Bash/Script-Patterns.md)
- **OpenTofu/Terraform**: [docs/wiki/Infrastructure/OpenTofu-Patterns.md](docs/wiki/Infrastructure/OpenTofu-Patterns.md)

## Anti-Patterns (Quick Reference)

| Anti-Pattern | Severity | Example | Documentation |
|--------------|----------|---------|---------------|
| Direct AWS SDK Imports | CRITICAL | `import {S3} from '@aws-sdk/client-s3'` | [Vendor Encapsulation](docs/wiki/Conventions/Vendor-Encapsulation-Policy.md) |
| Legacy Entity Mocks | CRITICAL | `vi.mock('#entities/Users')` | [Vitest Mocking](docs/wiki/Testing/Vitest-Mocking-Strategy.md) |
| Promise.all for Cascades | CRITICAL | `Promise.all([deleteUser(), deleteFiles()])` | [Lambda Patterns](docs/wiki/TypeScript/Lambda-Function-Patterns.md) |
| AI Attribution in Commits | CRITICAL | `Co-Authored-By: Claude` | [Git Workflow](docs/wiki/Conventions/Git-Workflow.md) |
| Module-Level getRequiredEnv | HIGH | `const X = getRequiredEnv('X')` at top level | [Lambda Patterns](docs/wiki/TypeScript/Lambda-Function-Patterns.md) |
| Raw Response Objects | HIGH | `return {statusCode: 200, body: ...}` | [Lambda Patterns](docs/wiki/TypeScript/Lambda-Function-Patterns.md) |
| Underscore-Prefixed Vars | HIGH | `handler(event, _context)` | [Lambda Patterns](docs/wiki/TypeScript/Lambda-Function-Patterns.md) |

**Quick fixes**: Use `#lib/vendor/AWS/*` for AWS SDK, `#entities/queries` for entity mocks, `response()` helper for Lambda returns.

## Type Naming Patterns

| Pattern | Usage | Examples |
|---------|-------|----------|
| Simple nouns | Domain entities | `User`, `File`, `Device`, `Session` |
| `*Row` | Drizzle database rows | `UserRow`, `FileRow`, `DeviceRow` |
| `*Item` | Entity row types with joins | `UserItem`, `FileItem`, `DeviceItem` |
| `*Input` | Request payloads & mutations | `UserLoginInput`, `CreateFileInput` |
| `*Response` | API response wrappers | `FileResponse`, `LoginResponse` |
| `*Error` | Error classes | `AuthorizationError`, `ValidationError` |

### File Organization (`src/types/`)

| File | Contents |
|------|----------|
| `domainModels.d.ts` | User, File, Device |
| `schemas.ts` | Zod schemas and inferred *Input types |
| `notificationTypes.d.ts` | Push notification payloads |
| `persistenceTypes.d.ts` | Relationship types (UserDevice, UserFile) |
| `infrastructureTypes.d.ts` | AWS/API Gateway types |
| `enums.ts` | FileStatus, UserStatus, ResponseStatus |

### Enum Values (PascalCase)

```typescript
// FileStatus values (aligned with iOS)
Queued | Downloading | Downloaded | Failed
```

## Development Workflow

### Essential Commands
```bash
pnpm run precheck              # Type check + lint (run before commits)
pnpm run test                  # Unit tests
pnpm run validate:conventions  # MCP rule validation
pnpm run ci:local              # Full local CI
```

### Deployment Commands
```bash
pnpm run deploy:staging        # Deploy to staging (local agents)
pnpm run deploy:production     # Deploy to production (manual, or auto via GitHub Actions)
```

**Note**: Production deployments auto-trigger on merge to master via GitHub Actions.

### Infrastructure Verification
```bash
pnpm run deploy:check:staging    # Check staging for drift
pnpm run deploy:check:production # Check production for drift
pnpm run state:verify:staging    # Verify staging state
pnpm run state:verify:production # Verify production state
pnpm run audit:aws:staging       # Audit staging resources
pnpm run audit:aws:production    # Audit production resources
pnpm run plan:staging            # Preview staging changes
pnpm run plan:production         # Preview production changes
```

### Pre-Commit Checklist
1. `pnpm run validate:conventions` - No rule violations
2. `pnpm run precheck` - TypeScript + ESLint clean
3. `pnpm run test` - All tests pass
4. Verify NO AI references in commit message
5. **NEVER push automatically** - Wait for user request

See `package.json` for complete command list (cleanup, integration tests, deployment, etc.).


## Integration Points

### External Services
- **Feedly**: Webhook-based article processing (query auth)
- **YouTube**: yt-dlp for video downloads (cookie auth required)
- **APNS**: iOS push notifications (requires certificates)
- **Sign In With Apple**: Authentication for iOS app
- **GitHub API**: Automated issue creation for errors

### AWS Services
- **Lambda**: Event-driven compute (all business logic)
- **S3**: Media storage with transfer acceleration
- **Aurora DSQL**: Serverless PostgreSQL-compatible database via Drizzle ORM for all entities
- **API Gateway**: REST endpoints with custom authorizer
- **SNS**: Push notification delivery
- **CloudWatch**: Logging and metrics
- **X-Ray**: Distributed tracing (optional)

## Common Development Tasks

### Adding New Lambda Function
1. Create `src/lambdas/[name]/` directory structure
2. Implement handler in `src/index.ts` with TypeDoc
3. Write tests in `test/index.test.ts` with fixtures
4. Mock ALL transitive dependencies (see Wiki)
5. Define Lambda resource in OpenTofu
6. Verify esbuild discovers new Lambda entry point
7. Configure appropriate IAM permissions
8. Import utilities from `util/` directory

### Debugging Production Issues
1. Check CloudWatch logs for Lambda
2. Review automated GitHub issues
3. Use AWS X-Ray for tracing (if enabled)
4. Test with production-like data locally
5. Use `test-remote-*` scripts for validation

### Updating API Endpoints
1. Modify API Gateway configuration in OpenTofu
2. Update Lambda handler code
3. Adjust custom authorizer if needed
4. Test with `test-remote-*` scripts
5. Update iOS app if contract changes

## Security & Secrets

- **SOPS**: All secrets managed via SOPS (`secrets.encrypted.yaml`)
- **Environment Variables**: Production secrets via Lambda environment
- **APNS Certificates**: P12 format, separate sandbox/production
- **API Tokens**: Query-based for Feedly compatibility
- **Never commit**: secrets.yaml, certificates, .env files

## Performance Considerations

- Lambda memory allocation: Optimize for cold starts
- S3 transfer acceleration: For large media files
- API Gateway caching: Reduce Lambda invocations
- Aurora DSQL: Serverless PostgreSQL with automatic scaling
- Webpack externals: Reduce bundle size

## Support Resources

- **CI/CD**: GitHub Actions with test pipeline
- **Local Testing**: LocalStack for AWS service emulation
- **Documentation**: TSDoc + terraform-docs
- **Error Tracking**: Automated GitHub issue creation
- **Monitoring**: CloudWatch dashboards and alarms

---

## Changelog

Track major changes to AI agent configuration.

### 2026-01-20 - Token Optimization & Subagents
- Extracted Mermaid diagrams to `docs/wiki/Architecture/System-Diagrams.md` (47% reduction)
- Consolidated Anti-Patterns section into summary table with wiki links
- Streamlined Development Workflow section (66% reduction)
- Created `.claude/agents/` directory with specialist subagents (testing, infrastructure, review)
- Updated evaluation report with AI Agent Configuration findings

### 2026-01-19 - Quick Start & Multi-Tool Support
- Added Quick Start section with TL;DR and session checklist
- Created `.cursorrules` for Cursor IDE compatibility
- Created `.github/copilot-instructions.md` for GitHub Copilot
- Added this changelog section
- Created GitHub issue templates for convention proposals and quarterly reviews
- Added wiki link validation MCP rule
- Updated Conventions-Tracking.md with review process

### Update Process

When making significant changes to AGENTS.md:
1. Add entry to this changelog with date and summary
2. Reference the PR number when merged
3. Update `.gemini/instructions.md` if critical rules changed
4. Update `.cursorrules` if patterns changed
5. Update `.github/copilot-instructions.md` if patterns changed
6. Run `pnpm run validate:conventions` to verify consistency

### Version Compatibility

| File | Synced With | Last Updated |
|------|-------------|--------------|
| `CLAUDE.md` | AGENTS.md (passthrough) | Always current |
| `.claude/agents/` | AGENTS.md (specialist subagents) | 2026-01-20 |
| `.gemini/instructions.md` | AGENTS.md (condensed) | 2026-01-19 |
| `.cursorrules` | AGENTS.md (condensed) | 2026-01-19 |
| `.github/copilot-instructions.md` | AGENTS.md (condensed) | 2026-01-19 |

---

**Remember**: Use TodoWrite tool for complex tasks to track progress and ensure thoroughness.