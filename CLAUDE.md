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
│   ├── mocha-setup.ts             # Test environment setup
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

### Workflow
- Be sure to typecheck when you’re done making a series of code changes
- Prefer running single tests, and not the whole test suite, for performance
- Don't output commands that just list files (like 'ls -l')
- Always ignore the `node_modules` directory when searching
- Always ignore the `dist` directory
- Always ignore the `package-lock.json` file when searching, unless your dealing with dependencies

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

### Testing Strategy
- **Unit Tests**: Mocha-based tests for each Lambda (`index.test.ts`)
- **Test Fixtures**: JSON mock data in `test/fixtures/` directories
- **Test Utilities**: Most `util/*.ts` files have corresponding `*.test.ts` files
- **Test Setup**: `util/mocha-setup.ts` configures the test environment
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

## Support & Maintenance
- **CI/CD**: GitHub Actions workflows with tests in `pipeline/` directory
- **Local CI Testing**: Use `act` to run GitHub Actions locally
- **Documentation**: Generated via TSDoc from Lambda source files
- **Infrastructure Docs**: Generated with terraform-docs
- **Automated Testing**: Jest tests for regression prevention
- **Error Tracking**: Automated GitHub issue creation for production errors
