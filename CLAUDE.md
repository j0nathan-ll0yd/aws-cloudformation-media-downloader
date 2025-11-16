# Project Context for Claude

## Project Overview
This is a serverless AWS media downloader service built with Terraform and TypeScript. It downloads media content (primarily YouTube videos) and integrates with a companion iOS app for offline playback. The project was created as a cost-effective alternative to YouTube Premium's offline playback feature.

## Architecture & Technology Stack

### Core Technologies
- **Infrastructure as Code**: Terraform
- **Runtime**: AWS Lambda (Node.js x22.0)
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
├── terraform/             # AWS Infrastructure definitions (Terraform)
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

### Code style
- Use ES modules (import/export) syntax, not CommonJS (require)
- Destructure imports when possible (eg. import { foo } from 'bar')
- Use the commitlint syntax when structuring commit messages
- NEVER add AI assistant references in commit messages, PRs, or code comments

### Workflow
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
4. Commit: `git commit -m "message"`
5. **STOP** - Wait for user to request push
6. ONLY when asked: `git push`

**Pre-Commit Verification (REQUIRED)**:
Before committing changes, ALWAYS run these commands to ensure code quality:

```bash
npm run build    # Verify TypeScript compilation and webpack build
npm test         # Run full test suite to ensure all tests pass
```

Both commands must complete successfully without errors before committing. This prevents broken builds in GitHub Actions and maintains code quality standards.

### Jest Test Mocking Strategy (CRITICAL)

**Problem Solved**: PR #91 revealed tests failing with obscure 500 errors despite code working in production. Root cause: missing mocks for transitive dependencies.

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

**AWS SDK Clients** (require full type annotations):
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

**Node.js Built-ins**:
```typescript
jest.unstable_mockModule('child_process', () => ({
  spawn: jest.fn()
}))

jest.unstable_mockModule('fs', () => ({
  promises: {
    copyFile: jest.fn<() => Promise<void>>()
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
// YouTube.ts dependencies
jest.unstable_mockModule('yt-dlp-wrap', () => ({ default: MockYTDlpWrap }))
jest.unstable_mockModule('child_process', () => ({ spawn: jest.fn() }))
jest.unstable_mockModule('fs', () => ({ promises: { copyFile: jest.fn() } }))
jest.unstable_mockModule('@aws-sdk/lib-storage', () => ({ Upload: jest.fn() }))
jest.unstable_mockModule('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(),
  HeadObjectCommand: jest.fn()
}))

// shared.ts dependencies
jest.unstable_mockModule('@aws-sdk/client-lambda', () => ({
  LambdaClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({StatusCode: 202})
  })),
  InvokeCommand: jest.fn()
}))

// THEN import the handler
const {handler} = await import('./../src')
```

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

#### Key Takeaway

**When importing ANY function from a module, you must mock ALL of that module's dependencies, not just the function you're using.**

**Reference**: See `docs/YT-DLP-MIGRATION-STRATEGY.md` section "Critical Lesson: Comprehensive Test Mocking Strategy" for full details.

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
- `npm run deploy` - Deploys infrastructure with Terraform
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

**Troubleshooting**: If Terraform shows "No changes" after code updates, check:
1. Archive hash in terraform output - should change when code changes
2. Webpack externals - missing entries cause old code to bundle
3. Build output - verify new packages are externalized, not bundled

### Testing Strategy
- **Unit Tests**: Mocha-based tests for each Lambda (`index.test.ts`)
- **Test Fixtures**: JSON mock data in `test/fixtures/` directories
- **Test Utilities**: Most `util/*.ts` files have corresponding `*.test.ts` files
- **Test Setup**: `util/jest-setup.ts` configures the test environment
- **Pipeline Tests**: GitHub Actions tests in `pipeline/` directory
- **Integration Tests**: Remote endpoint testing via npm scripts
    - `test-remote-list` - Tests file listing
    - `test-remote-hook` - Tests Feedly webhook
    - `test-remote-registerDevice` - Tests device registration

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
- The file `secrets.encrypted.yaml` is read by Terraform at deploy timee

### Certificate Management
- APNS requires p12 certificate conversion
- Separate private key and certificate files
- Sandbox vs Production environments

## Code Style & Documentation

### TypeScript Guidelines
- **Type Definitions**: Centralized in `types/` directory
- **Strict Typing**: Enabled for all Lambda functions
- **TSDoc**: Required for all public functions in Lambda handlers
- **Generated Documentation**: Run `npm run document-source` to update `docs/source/`

### Terraform Best Practices
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
3. Write Mocha tests in `test/index.test.ts`
4. Add test fixtures in `test/fixtures/`
5. Define Lambda resource in Terraform
6. Configure webpack entry point
7. Add appropriate IAM permissions
8. Import and use utilities from `util/` directory

### Modifying API Endpoints
1. Update API Gateway configuration in Terraform
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
- Terraform version compatibility
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
/opt/homebrew/bin/aws lambda invoke \
  --function-name FileCoordinator \
  --region us-west-2 \
  --payload '{}' \
  /dev/null
```

This command invokes the `FileCoordinator` function with an empty JSON payload. The response from the lambda is discarded by redirecting it to `/dev/null`.

### 2. Monitor the StartFileUpload Logs

After triggering the `FileCoordinator`, you can monitor the logs of the `StartFileUpload` Lambda to observe the file upload process.

```bash
/opt/homebrew/bin/aws logs tail /aws/lambda/StartFileUpload --region us-west-2 --follow --format short
```

This command will stream the logs from the `/aws/lambda/StartFileUpload` log group, allowing you to see real-time updates. The `--follow` flag keeps the connection open and continues to display new log entries.

### 3. Testing The StartFileUpload Lambda with Error Filtering

The following command invokes the `FileCoordinator` lambda, waits for 5 seconds, and then filters the logs of the `StartFileUpload` lambda for "ERROR" messages in the last 5 minutes.

```bash
/opt/homebrew/bin/aws lambda invoke \
  --function-name FileCoordinator \
  --region us-west-2 \
  --payload '{}' \
  /dev/null && \
  sleep 5 && \
  /opt/homebrew/bin/aws logs filter-log-events \
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

This error occurs because YouTube is blocking requests from AWS Lambda datacenter IPs. This is resolved by implementing cookie-based authentication (see Phase 2 of yt-dlp migration strategy).

---

## Current Work-in-Progress: yt-dlp Upgrade (PR #91)

**Status**: All implementation complete, waiting for CI build to pass
**Branch**: `f/yt-dlp-upgrade`
**PR**: https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/pull/91
**Related Issue**: LocalStack integration #92

### Completed Tasks

#### Phase 1: Binary Migration & Streaming Architecture ✅
- Migrated from NPM yt-dlp wrapper to native binary
- Implemented direct stdout streaming from yt-dlp to S3
- Configured Lambda to use /tmp for HLS/DASH fragment writes
- Updated webpack externals for AWS SDK packages

#### Phase 2: Cookie-Based Authentication ✅
- Deployed YouTube cookies via Terraform to Lambda layer
- Implemented cookie file copying from /opt to /tmp
- Added `CookieExpirationError` error type
- Pattern matching for bot detection errors

#### Phase 3: Automated Monitoring ✅
- Created `CookieMonitor` Lambda for hourly expiration checks
- GitHub issue automation for cookie rotation alerts
- EventBridge hourly cron trigger
- DynamoDB integration for failed file tracking

#### Phase 4: Infrastructure Cleanup ✅
- Removed deprecated multipart upload Lambdas (UploadPart, CompleteFileUpload)
- Removed Step Functions workflow
- Simplified DynamoDB schema to single-stage flow
- Deleted 200+ lines of deprecated test code

#### Phase 5: Code Quality ✅
- Fixed all linter issues (36 errors → 0)
- Fixed TypeScript build errors in test files
- Updated LocalStack strategy documentation
- Comprehensive PR description added

### Recent Commits
```
95fb276 chore: update encrypted secrets after build-dependencies
3f2b36e fix: resolve TypeScript build errors in test files
35ca3e9 docs: update LocalStack strategy for streaming architecture
a47ce38 style: fix remaining linter issues
2bc3e6f style: fix linter issues in cookie monitoring and video download code
3008228 refactor: remove deprecated multipart upload infrastructure
d42dea6 feat: add automated cookie expiration monitoring and alerting
a500abb fix: resolve HLS/DASH fragment file write errors in Lambda
7e4c21d fix: add missing AWS SDK externals to webpack config
e93c06d feat: implement streaming architecture for yt-dlp video downloads
f6193e6 feat: Used cookies parameter for yt-dlp downloading
c1d3fa3 feat: Uploaded binary, replaced NPM package, testing remotely
```

### Next Steps After Merge
1. Monitor production for any issues with streaming architecture
2. Validate cookie expiration monitoring is working correctly
3. Consider implementing LocalStack integration (Issue #92)
4. Consider automating cookie rotation process

### Important Notes
- Always run `npm run build-dependencies` after Terraform changes to regenerate types
- The `secrets.enc.yaml` file will be updated by build-dependencies and should be committed
- PATH must include `/opt/homebrew/bin` for hcl2json and sops commands
- Build-dependencies requires: hcl2json, quicktype, sops
