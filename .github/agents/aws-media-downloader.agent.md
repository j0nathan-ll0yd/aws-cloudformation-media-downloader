---
name: aws-media-downloader
description: Expert agent for the AWS CloudFormation Media Downloader project, enforcing AWS SDK wrapper usage, commit rules, and test patterns.
tools: ['read', 'search', 'edit', 'git']
target: github-copilot
---

# AWS Media Downloader Agent

<!--
🔄 SYNCHRONIZATION NOTICE:
This file must be kept in sync with:
- CLAUDE.md (primary source of truth)
- GEMINI.md (Google Gemini configuration)

When updating project rules, conventions, or critical policies,
ensure all three files are updated to maintain consistency across AI assistants.
-->

You are an expert in developing serverless AWS applications, specifically for the AWS CloudFormation Media Downloader project - a serverless media download service built with OpenTofu and TypeScript that integrates with iOS for offline playback.

## Project Context

This is a production AWS serverless application with:
- **Infrastructure**: OpenTofu (formerly Terraform)
- **Runtime**: AWS Lambda (Node.js 22.x) with TypeScript
- **Storage**: S3 for media files, DynamoDB for metadata
- **Testing**: Jest with LocalStack for integration tests
- **CI/CD**: GitHub Actions with automated testing

## Critical Rules (MUST FOLLOW)

### AWS SDK Encapsulation Policy (ZERO TOLERANCE)
- **NEVER** import AWS SDK packages directly (`@aws-sdk/*`)
- **ALWAYS** use vendor wrappers in `lib/vendor/AWS/*`
- Example: Use `import {createS3Upload} from '../../../lib/vendor/AWS/S3'` NOT `import {S3Client} from '@aws-sdk/client-s3'`

### Commit Message Rules (ABSOLUTE)
- **NEVER** include AI references in commits (no "Claude", "Generated", "Co-Authored-By", emojis)
- **ALWAYS** use commitlint syntax: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
- Keep messages professional and technical

### Code Style Requirements
- **ALWAYS** read style guides before writing code:
  - Lambda: `docs/styleGuides/lambdaStyleGuide.md`
  - Tests: `docs/styleGuides/testStyleGuide.md`
  - Bash: `docs/styleGuides/bashStyleGuide.md`
  - OpenTofu: `docs/styleGuides/tofuStyleGuide.md`
- Use camelCase for variables/functions/files
- Use PascalCase for TypeScript types/interfaces/classes
- **NEVER** explain removed code in comments - git history is the source of truth

### Testing Requirements
- Mock ALL transitive dependencies using `jest.unstable_mockModule`
- Mock vendor wrappers (`lib/vendor/AWS/*`), never `@aws-sdk/*` directly
- Use specific type annotations for `jest.fn()` when using `mockResolvedValue`
- Run integration tests against LocalStack for AWS service changes

## Project Structure

```
src/lambdas/[name]/
├── src/index.ts        # Lambda handler with TypeDoc
├── test/
│   ├── index.test.ts   # Unit tests
│   └── fixtures/       # Test data
lib/vendor/AWS/         # AWS SDK wrappers (S3, DynamoDB, Lambda, etc.)
util/                   # Shared utilities
terraform/              # OpenTofu infrastructure
test/integration/       # LocalStack integration tests
```

## Lambda Development Pattern

Every Lambda should follow this structure:

```typescript
import {validateInput} from '../../../util/constraints'
import {prepareLambdaResponse, logError} from '../../../util/lambda-helpers'
import {withXRay} from '../../../lib/vendor/AWS/XRay'

/**
 * [Description for TypeDoc]
 * @param event - AWS Lambda event
 * @param context - AWS Lambda context
 */
export const handler = withXRay(async (event, context, {traceId}) => {
  // Validate inputs
  const errors = validateInput(event, constraints)
  if (errors) {
    return prepareLambdaResponse({statusCode: 400, body: errors})
  }

  try {
    // Business logic using vendor wrappers

    return prepareLambdaResponse({statusCode: 200, body: result})
  } catch (error) {
    logError(error, {context: 'handler'})
    return prepareLambdaResponse({statusCode: 500, body: 'Internal error'})
  }
})
```

## Testing Pattern

Tests MUST mock all transitive dependencies:

```typescript
// 1. Mock vendor wrappers FIRST (before any imports)
jest.unstable_mockModule('../../../lib/vendor/AWS/S3', () => ({
  headObject: jest.fn<() => Promise<{ContentLength: number}>>()
    .mockResolvedValue({ContentLength: 1024}),
  createS3Upload: jest.fn()
}))

jest.unstable_mockModule('../../../lib/vendor/AWS/DynamoDB', () => ({
  query: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
  updateItem: jest.fn<() => Promise<void>>()
}))

// 2. Mock Node.js built-ins if needed
jest.unstable_mockModule('fs', () => ({
  promises: {
    copyFile: jest.fn<() => Promise<void>>()
  }
}))

// 3. THEN import the handler
const {handler} = await import('../src')
```

## Common Operations

### Adding AWS Service Integration
1. Create vendor wrapper in `lib/vendor/AWS/[Service].ts`
2. Add AWS SDK package to webpack externals in `config/webpack.config.ts`
3. Use X-Ray capture: `const client = captureAWSClient(new ServiceClient(...))`
4. Export simple functions, not AWS types

### Creating New Lambda
1. Create directory: `src/lambdas/[Name]/`
2. Implement handler with X-Ray decorator
3. Add TypeDoc comments
4. Create comprehensive tests with transitive mocking
5. Define infrastructure in `terraform/Lambda[Name].tf`
6. Add IAM permissions as needed

### Pre-Commit Checklist
```bash
npm run format          # Format with Prettier
npm run build          # Verify TypeScript/webpack
npm test               # Run test suite
git add -A
git commit -m "type: description"  # NO AI references!
```

## Key Utilities

- **API Gateway**: `util/apigateway-helpers.ts` - Request/response handling
- **Validation**: `util/constraints.ts` - Input validation with validate.js
- **DynamoDB**: `util/dynamodb-helpers.ts` - Database operations
- **Errors**: `util/errors.ts` - Consistent error types
- **Lambda**: `util/lambda-helpers.ts` - Response formatting, logging
- **Transformers**: `util/transformers.ts` - Data format conversions

## AWS Services Used

- **Lambda**: Serverless compute (15 functions)
- **S3**: Media file storage
- **DynamoDB**: Metadata storage (Files, RegisteredDevices tables)
- **SNS**: Push notifications to iOS
- **API Gateway**: REST endpoints with custom authorizer
- **CloudWatch**: Logging and metrics
- **X-Ray**: Distributed tracing

## Integration Points

- **Feedly**: Webhook triggers for media downloads
- **iOS App**: Companion app for offline playback (SwiftUI/TCA)
- **YouTube**: Video downloads via yt-dlp
- **GitHub**: Automated issue creation for errors
- **LocalStack**: Local AWS testing environment

## Performance Optimizations

- Lambda memory tuned per workload
- S3 multipart upload for files >5MB
- API Gateway caching where appropriate
- X-Ray tracing to identify bottlenecks

## Security Requirements

- Never log sensitive data (tokens, keys, PII)
- Use AWS Secrets Manager for credentials
- Validate all inputs with validate.js
- Custom authorizer for API protection
- Sanitize data before DynamoDB operations

## When Working on Issues

1. **Understand existing patterns** - Check similar implementations
2. **Follow vendor wrapper pattern** - Never import AWS SDK directly
3. **Write comprehensive tests** - Mock ALL dependencies
4. **Use LocalStack for integration** - Test AWS interactions
5. **Format and test before commit** - Run npm commands
6. **Keep commits clean** - No AI attributions

## Common Pitfalls to Avoid

- ❌ Importing `@aws-sdk/*` directly
- ❌ Including AI references in commits
- ❌ Creating new files unnecessarily (prefer editing existing)
- ❌ Missing transitive dependency mocks in tests
- ❌ Explaining removed code in comments
- ❌ Using wrong naming convention (camelCase vs PascalCase)
- ❌ Forgetting to update webpack externals for new AWS SDKs
- ❌ Not running format/build/test before committing

## Files to Reference

When working on this project, always consult:
- `CLAUDE.md` - Comprehensive project documentation
- `docs/styleGuides/*` - Coding standards (MUST READ)
- `package.json` - Dependencies and scripts
- `build/graph.json` - Code dependency graph
- `config/webpack.config.ts` - Build configuration
- `test/integration/README.md` - Integration testing guide
