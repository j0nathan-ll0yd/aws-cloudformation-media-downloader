# Project Context for AI Agents

## Convention Capture System

**CRITICAL**: This project uses an automated system to capture emergent conventions during development. This ensures institutional memory persists across sessions and projects.

### At Start of EVERY Session:
1. Read `docs/conventions-tracking.md` to understand current project conventions
2. Review universal detection patterns (see below)
3. Activate convention detection mode

### During Work - Monitor for Signals:
- 🚨 **CRITICAL**: "NEVER", "FORBIDDEN", "Zero-tolerance"
- ⚠️ **HIGH**: "MUST", "REQUIRED", "ALWAYS", corrections like "Actually, it's X not Y"
- 📋 **MEDIUM**: "Prefer X over Y", repeated decisions (2+ times)
- 💡 **LOW**: Suggestions to monitor

### Flag Convention Format:
```
🔔 **CONVENTION DETECTED**

**Name**: [Convention Name]
**Type**: [Rule/Pattern/Methodology/Convention]
**What**: [One-sentence description]
**Why**: [Brief rationale]
**Priority**: [Critical/High/Medium/Low]

Document now? [Y/N]
```

### At End of Session:
1. Generate session summary using template: `docs/templates/session-summary-template.md`
2. Save to: `docs/sessions/YYYY-MM-DD-topic.md`
3. Update `docs/conventions-tracking.md` with newly detected conventions
4. List pending documentation tasks

### Reference Implementation:
- **System Guide**: `docs/CONVENTION-CAPTURE-GUIDE.md` - Complete methodology
- **Detection Patterns**: `docs/convention-detection-patterns.md` - Signal reference
- **Templates**: `docs/templates/` - Convention & session summary templates
- **Wiki**: `docs/wiki/Meta/Convention-Capture-System.md` - Public documentation

**Key Principle**: Better to flag and dismiss than miss a convention. Zero conventions lost to conversation history.

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
- **Database**: DynamoDB with ElectroDB ORM (single-table design)
- **Monitoring**: CloudWatch, X-Ray (optional)

### Project Structure
```
.
├── terraform/             # AWS Infrastructure definitions (OpenTofu)
├── src/
│   ├── entities/          # ElectroDB entity definitions (single-table design)
│   │   ├── Collections.ts # Service combining entities for JOIN-like queries
│   │   ├── Files.ts       # File entity
│   │   ├── Users.ts       # User entity
│   │   ├── Devices.ts     # Device entity
│   │   ├── UserFiles.ts   # User-File relationships
│   │   └── UserDevices.ts # User-Device relationships
│   └── lambdas/           # Lambda functions (each subdirectory = one Lambda)
│       └── [lambda-name]/
│           ├── src/index.ts         # Lambda handler
│           └── test/index.test.ts  # Unit tests
├── lib/vendor/            # 3rd party API wrappers & AWS SDK encapsulation
│   ├── AWS/               # AWS SDK vendor wrappers
│   └── ElectroDB/         # ElectroDB configuration & service
├── test/helpers/          # Test utilities
│   └── electrodb-mock.ts  # ElectroDB mock helper for unit tests
├── types/                 # TypeScript type definitions
├── util/                  # Shared utility functions
├── docs/
│   ├── wiki/              # All documentation and style guides
│   └── conventions-tracking.md  # Project-specific conventions
└── build/graph.json       # Code graph (ts-morph) - READ THIS
```

## System Architecture

### Lambda Data Flow

```mermaid
graph TD
    %% External Triggers
    API[API Gateway] --> Authorizer[ApiGatewayAuthorizer]
    Authorizer --> ListFiles[ListFiles Lambda]
    Authorizer --> LoginUser[LoginUser Lambda]
    Authorizer --> RegisterDevice[RegisterDevice Lambda]
    Authorizer --> RegisterUser[RegisterUser Lambda]
    Authorizer --> RefreshToken[RefreshToken Lambda]
    Authorizer --> UserDelete[UserDelete Lambda]
    Authorizer --> UserSubscribe[UserSubscribe Lambda]

    Feedly[Feedly Webhook] --> WebhookFeedly[WebhookFeedly Lambda]

    %% Scheduled Tasks
    Schedule[CloudWatch Schedule] --> FileCoordinator[FileCoordinator Lambda]
    Schedule --> PruneDevices[PruneDevices Lambda]

    %% Lambda Invocations
    FileCoordinator --> StartFileUpload[StartFileUpload Lambda]

    %% S3 Triggers
    S3Upload[S3 Upload Event] --> S3ObjectCreated[S3ObjectCreated Lambda]
    S3ObjectCreated --> SQS[SQS Queue]
    SQS --> SendPushNotification[SendPushNotification Lambda]

    %% Data Stores
    ListFiles --> DDB[(DynamoDB)]
    LoginUser --> DDB
    RegisterDevice --> DDB
    RegisterUser --> DDB
    WebhookFeedly --> DDB
    FileCoordinator --> DDB
    UserDelete --> DDB
    PruneDevices --> DDB
    S3ObjectCreated --> DDB

    StartFileUpload --> S3Storage[(S3 Storage)]
    WebhookFeedly --> S3Storage

    SendPushNotification --> APNS[Apple Push Service]
```

### Entity Relationship Model

```mermaid
erDiagram
    USERS ||--o{ USER_FILES : has
    USERS ||--o{ USER_DEVICES : owns
    FILES ||--o{ USER_FILES : shared_with
    DEVICES ||--o{ USER_DEVICES : registered_to

    USERS {
        string userId PK
        string email
        string status
        timestamp createdAt
    }

    FILES {
        string fileId PK
        string fileName
        string url
        string status
        number size
        timestamp createdAt
    }

    DEVICES {
        string deviceId PK
        string deviceToken
        string platform
        timestamp lastActive
    }

    USER_FILES {
        string userId FK
        string fileId FK
        timestamp createdAt
    }

    USER_DEVICES {
        string userId FK
        string deviceId FK
        timestamp createdAt
    }
```

### Service Interaction Map

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
│    DynamoDB         │      S3       │    CloudWatch        │
│  (ElectroDB ORM)    │  (Media Files)│   (Logs/Metrics)     │
└─────────────────────┴───────────────┴──────────────────────┘
```

### Dependency Analysis with graph.json

The `build/graph.json` file contains comprehensive dependency information. Key queries:

```bash
# Get all dependencies for a Lambda function
cat build/graph.json | jq '.transitiveDependencies["src/lambdas/ListFiles/src/index.ts"]'

# Find all files that import a specific module
cat build/graph.json | jq '.graph | to_entries[] | select(.value.imports[] | contains("entities/Files")) | .key'

# List all Lambda entry points
cat build/graph.json | jq '.graph | keys[] | select(contains("src/lambdas") and contains("/src/index.ts"))'

# Find circular dependencies (if any)
cat build/graph.json | jq '.circularDependencies'

# Get import count for complexity analysis
cat build/graph.json | jq '.graph | to_entries | map({file: .key, importCount: (.value.imports | length)}) | sort_by(.importCount) | reverse[:10]'
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

### Lambda Trigger Patterns

| Lambda | Trigger Type | Source | Purpose |
|--------|-------------|--------|---------|
| ApiGatewayAuthorizer | API Gateway | All authenticated routes | Authorize API requests via Better Auth |
| CloudfrontMiddleware | CloudFront | Edge requests | Edge processing for CDN |
| FileCoordinator | CloudWatch Events | Scheduled | Orchestrate pending file downloads |
| ListFiles | API Gateway | GET /files | List user's available files |
| LogClientEvent | API Gateway | POST /events | Log client-side events |
| LoginUser | API Gateway | POST /auth/login | Authenticate user |
| PruneDevices | CloudWatch Events | Daily schedule | Clean inactive devices |
| RefreshToken | API Gateway | POST /auth/refresh | Refresh authentication token |
| RegisterDevice | API Gateway | POST /devices | Register iOS device for push |
| RegisterUser | API Gateway | POST /auth/register | Register new user |
| S3ObjectCreated | S3 Event | s3:ObjectCreated | Handle uploaded files, notify users |
| SendPushNotification | SQS | S3ObjectCreated | Send APNS notifications |
| StartFileUpload | Lambda Invoke | FileCoordinator | Initiate file download from YouTube |
| UserDelete | API Gateway | DELETE /users | Delete user and cascade |
| UserSubscribe | API Gateway | POST /subscriptions | Manage user topic subscriptions |
| WebhookFeedly | API Gateway | POST /webhooks/feedly | Process Feedly articles |

### Data Access Patterns

| Pattern | Entity | Access Method | Index Used |
|---------|--------|--------------|------------|
| User's files | UserFiles → Files | Query by userId | GSI1 |
| User's devices | UserDevices → Devices | Query by userId | GSI1 |
| File's users | UserFiles | Query by fileId | GSI2 |
| Device lookup | Devices | Get by deviceId | Primary |
| User resources | Collections.userResources | Batch query | GSI1 |

## Critical Project-Specific Rules

1. **Use build/graph.json for dependency analysis**:
   - Auto-generated before every build
   - Shows file-level imports and transitive dependencies
   - **CRITICAL for Jest tests**: Use `transitiveDependencies` to find all mocks needed
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

## ElectroDB Architecture

**CRITICAL**: This project uses ElectroDB as the DynamoDB ORM for type-safe, maintainable database operations.

### Key ElectroDB Features
- **Single-table design**: All entities in one DynamoDB table with optimized GSIs
- **Type-safe queries**: Full TypeScript type inference for all operations
- **Collections**: JOIN-like queries across entity boundaries (see `src/entities/Collections.ts`)
- **Batch operations**: Efficient bulk reads/writes with automatic chunking

### Entity Relationships
- **Users** ↔ **Files**: Many-to-many via UserFiles entity
- **Users** ↔ **Devices**: Many-to-many via UserDevices entity
- **Collections.userResources**: Query all files & devices for a user in one call
- **Collections.fileUsers**: Get all users associated with a file (for notifications)

### Testing with ElectroDB
- **ALWAYS** use `test/helpers/electrodb-mock.ts` for mocking entities
- **NEVER** create manual mocks for ElectroDB entities
- See test style guide for detailed mocking patterns

## Wiki Conventions to Follow

**BEFORE WRITING ANY CODE, READ THE APPLICABLE GUIDE:**

### Core Conventions
- **Git Workflow**: [docs/wiki/Conventions/Git-Workflow.md](docs/wiki/Conventions/Git-Workflow.md) - NO AI attribution in commits
- **Naming**: [docs/wiki/Conventions/Naming-Conventions.md](docs/wiki/Conventions/Naming-Conventions.md) - camelCase, PascalCase rules
- **Comments**: [docs/wiki/Conventions/Code-Comments.md](docs/wiki/Conventions/Code-Comments.md) - Git as source of truth

### TypeScript & Testing
- **Lambda Patterns**: [docs/wiki/TypeScript/Lambda-Function-Patterns.md](docs/wiki/TypeScript/Lambda-Function-Patterns.md)
- **Jest Mocking**: [docs/wiki/Testing/Jest-ESM-Mocking-Strategy.md](docs/wiki/Testing/Jest-ESM-Mocking-Strategy.md)
- **Mock Types**: [docs/wiki/Testing/Mock-Type-Annotations.md](docs/wiki/Testing/Mock-Type-Annotations.md)
- **Coverage Philosophy**: [docs/wiki/Testing/Coverage-Philosophy.md](docs/wiki/Testing/Coverage-Philosophy.md)
- **Integration Testing**: [docs/wiki/Integration/LocalStack-Testing.md](docs/wiki/Integration/LocalStack-Testing.md)

### AWS & Infrastructure
- **SDK Encapsulation**: [docs/wiki/AWS/SDK-Encapsulation-Policy.md](docs/wiki/AWS/SDK-Encapsulation-Policy.md) - ZERO tolerance
- **Bash Scripts**: [docs/wiki/Bash/Script-Patterns.md](docs/wiki/Bash/Script-Patterns.md)
- **OpenTofu/Terraform**: [docs/wiki/Infrastructure/OpenTofu-Patterns.md](docs/wiki/Infrastructure/OpenTofu-Patterns.md)

## Development Workflow

### Essential Commands
```bash
pnpm run build          # Build Lambda functions with webpack
pnpm run test           # Run unit tests
pnpm run deploy         # Deploy infrastructure with OpenTofu
pnpm run format         # Auto-format with Prettier (250 char lines)

# Integration testing
pnpm run localstack:start        # Start LocalStack
pnpm run test:integration        # Run integration tests
pnpm run test:integration:full   # Full suite with lifecycle

# Remote testing
pnpm run test-remote-list        # Test file listing
pnpm run test-remote-hook        # Test Feedly webhook
pnpm run test-remote-registerDevice  # Test device registration

# Documentation
pnpm run document-source         # Generate TSDoc documentation
```

### Pre-Commit Checklist
1. Run `pnpm run format` - Auto-format code
2. Run `pnpm run build` - Verify TypeScript compilation
3. Run `pnpm test` - Ensure all tests pass
4. Verify NO AI references in commit message
5. Stage changes: `git add -A`
6. Commit with clean message: `git commit -m "type: description"`
7. **NEVER push automatically** - Wait for user request

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
- **DynamoDB**: Single-table design via ElectroDB ORM for all entities
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
6. Add webpack entry point if needed
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
- DynamoDB indexes: Query optimization
- Webpack externals: Reduce bundle size

## Support Resources

- **CI/CD**: GitHub Actions with test pipeline
- **Local Testing**: act for GitHub Actions locally
- **Documentation**: TSDoc + terraform-docs
- **Error Tracking**: Automated GitHub issue creation
- **Monitoring**: CloudWatch dashboards and alarms

---

**Remember**: Use TodoWrite tool for complex tasks to track progress and ensure thoroughness.