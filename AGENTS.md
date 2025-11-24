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
│   ├── wiki/              # Centralized convention documentation
│   ├── styleGuides/       # Language-specific guides
│   └── conventions-tracking.md  # Project-specific conventions
└── build/graph.json       # Code graph (ts-morph) - READ THIS
```

## Critical Project-Specific Rules

1. **Read build/graph.json** for file relationships and dependencies
2. **Feedly webhook** uses query-based authentication (custom authorizer)
3. **APNS certificates** required for iOS push notifications (p12 format)
4. **YouTube downloads** require cookie authentication due to bot detection
5. **LocalStack integration** for local AWS testing via vendor wrappers
6. **Webpack externals** must be updated when adding AWS SDK packages

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

### Language-Specific Patterns
- **Lambda**: [docs/wiki/TypeScript/Lambda-Function-Patterns.md](docs/wiki/TypeScript/Lambda-Function-Patterns.md)
- **Testing**: [docs/wiki/Testing/Jest-ESM-Mocking-Strategy.md](docs/wiki/Testing/Jest-ESM-Mocking-Strategy.md)
- **AWS SDK**: [docs/wiki/AWS/SDK-Encapsulation-Policy.md](docs/wiki/AWS/SDK-Encapsulation-Policy.md) - ZERO tolerance
- **Bash**: [docs/wiki/Bash/Variable-Naming.md](docs/wiki/Bash/Variable-Naming.md)
- **OpenTofu**: [docs/wiki/Infrastructure/Resource-Naming.md](docs/wiki/Infrastructure/Resource-Naming.md)

### Quick Reference Style Guides
- Lambda code: `docs/styleGuides/lambdaStyleGuide.md`
- Test code: `docs/styleGuides/testStyleGuide.md`
- Bash scripts: `docs/styleGuides/bashStyleGuide.md`
- OpenTofu: `docs/styleGuides/tofuStyleGuide.md`

## Development Workflow

### Essential Commands
```bash
npm run build          # Build Lambda functions with webpack
npm run test           # Run unit tests
npm run deploy         # Deploy infrastructure with OpenTofu
npm run format         # Auto-format with Prettier (250 char lines)

# Integration testing
npm run localstack:start        # Start LocalStack
npm run test:integration        # Run integration tests
npm run test:integration:full   # Full suite with lifecycle

# Remote testing
npm run test-remote-list        # Test file listing
npm run test-remote-hook        # Test Feedly webhook
npm run test-remote-registerDevice  # Test device registration

# Documentation
npm run document-source         # Generate TSDoc documentation
```

### Pre-Commit Checklist
1. Run `npm run format` - Auto-format code
2. Run `npm run build` - Verify TypeScript compilation
3. Run `npm test` - Ensure all tests pass
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