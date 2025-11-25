# Convention Over Configuration

## Quick Reference
- **When to use**: All development decisions and architectural choices
- **Enforcement**: Philosophy, code reviews, established patterns
- **Impact if violated**: LOW - Increased complexity, inconsistency, maintenance burden

## Overview

Prefer established patterns with sensible defaults over flexible configuration. This principle reduces decision fatigue, improves consistency, speeds development, and makes the codebase more predictable and maintainable.

## The Rules

### 1. Use Project Defaults

Don't configure what already has a sensible default.

### 2. Follow Established Patterns

Use existing patterns before creating new ones.

### 3. Minimize Configuration Files

Avoid proliferation of config files when conventions suffice.

### 4. Document Exceptions

When configuration is necessary, document why the convention doesn't work.

## Examples

### ✅ Correct - Using Convention for Lambda Handlers

```typescript
// src/lambdas/ListFiles/src/index.ts

// Standard Lambda pattern - no configuration needed
import {lambdaErrorResponse, response, logInfo, getUserDetailsFromEvent} from '../../../util/lambda-helpers'
import {withXRay} from '../../../lib/vendor/AWS/XRay'
import {Files} from '../../../entities/Files'
import {UserFiles} from '../../../entities/UserFiles'

export const handler = withXRay(async (event, context, {traceId: _traceId}) => {
  logInfo('event <=', event)  // Standard logging pattern

  try {
    // Standard user extraction from event
    const {userId, userStatus} = getUserDetailsFromEvent(event)

    // Business logic using ElectroDB entities
    const files = await getFilesByUser(userId)

    // Standard success response
    return response(context, 200, {contents: files, keyCount: files.length})
  } catch (error) {
    // Standard error handling for API Gateway
    return lambdaErrorResponse(context, error)
  }
})
```

### ✅ Correct - Standard File Structure

```
src/lambdas/FunctionName/
├── src/index.ts       # Convention: handler always here
├── test/index.test.ts # Convention: test mirrors source
└── fixtures/          # Convention: test data location
    └── event.json

terraform/LambdaFunctionName.tf  # Convention: PascalCase matches function
```

No configuration needed - the structure itself is the convention.

### ✅ Correct - Standard Test Pattern

```typescript
// src/lambdas/ListFiles/test/index.test.ts

// Convention: Use ElectroDB mock helper
import {createElectroDBEntityMock} from '../../../../test/helpers/electrodb-mock'

// Convention: Create mocks with query indexes
const userFilesMock = createElectroDBEntityMock({queryIndexes: ['byUser']})
const filesMock = createElectroDBEntityMock()

// Convention: Mock with jest.unstable_mockModule for ES modules
jest.unstable_mockModule('../../../entities/UserFiles', () => ({
  UserFiles: userFilesMock.entity
}))
jest.unstable_mockModule('../../../entities/Files', () => ({
  Files: filesMock.entity
}))

// Convention: Import handler after mocks
const {handler} = await import('./../src')

// Convention: Import fixtures from JSON
const {default: eventMock} = await import('./fixtures/APIGatewayEvent.json', {assert: {type: 'json'}})

// Convention: Standard test structure
describe('#ListFiles', () => {
  const context = testContext

  beforeEach(() => {
    event = JSON.parse(JSON.stringify(eventMock))
  })

  test('should return empty list when user has no files', async () => {
    userFilesMock.mocks.query.byUser!.go.mockResolvedValue({data: []})
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(200)
  })
})
```

### ❌ Incorrect - Over-Configuration

```typescript
// ❌ Custom configuration for standard behavior
const lambdaConfig = {
  errorHandler: customErrorHandler,
  responseFormatter: customResponseFormatter,
  loggingLevel: 'custom',
  timeout: 30,
  retryPolicy: customRetryPolicy
}

export const handler = createCustomHandler(lambdaConfig, async (event) => {
  // Now we need to maintain this custom configuration
})
```

Problems:
- Configuration that duplicates what conventions provide
- Custom patterns when standard ones work
- Maintenance burden of config files

### ❌ Incorrect - Configuration Files for Standard Behavior

```json
// ❌ lambda-config.json (unnecessary)
{
  "handlers": {
    "ProcessFile": {
      "path": "src/lambdas/ProcessFile/src/index.ts",
      "handler": "handler",
      "runtime": "nodejs22.x",
      "timeout": 30
    }
  }
}
```

Instead: Use convention that all Lambdas follow the same structure.

### ❌ Incorrect - Flexible but Complex

```typescript
// ❌ Making everything configurable
class LambdaBuilder {
  setErrorHandler(handler: ErrorHandler)
  setLogger(logger: Logger)
  setValidator(validator: Validator)
  setResponseFormatter(formatter: Formatter)
  setMiddleware(middleware: Middleware[])
  // ... 10 more configuration methods
}

// Now every Lambda needs complex setup
const handler = new LambdaBuilder()
  .setErrorHandler(customErrorHandler)
  .setLogger(customLogger)
  .setValidator(customValidator)
  // ... etc
  .build()
```

## Real Project Examples

### Lambda Conventions

```typescript
// Convention: All API Gateway Lambdas return responses
// No need to configure response vs throw behavior
if (isApiGatewayLambda) {
  return prepareLambdaResponse({statusCode, body})
} else {
  throw error  // Event-driven Lambdas throw for retry
}
```

### Testing Conventions

```typescript
// Convention: Test files mirror source files
// No test configuration needed
src/lambdas/ProcessFile/src/index.ts
src/lambdas/ProcessFile/test/index.test.ts

// Convention: Fixtures in standard location
src/lambdas/ProcessFile/test/fixtures/event.json
```

### Infrastructure Conventions

```hcl
# Convention: Resource names match TypeScript names
resource "aws_lambda_function" "ProcessFile" {
  function_name = "ProcessFile"  # No configuration mapping needed
}
```

## When Configuration IS Appropriate

### Environment-Specific Settings

```typescript
// ✅ Configuration for environment differences
const config = {
  apiUrl: process.env.API_URL,  // Varies by environment
  region: process.env.AWS_REGION || 'us-west-2'
}
```

### Security and Secrets

```typescript
// ✅ Configuration for sensitive data
const config = {
  apiKey: process.env.API_KEY,  // Can't be hardcoded
  certificatePath: process.env.CERT_PATH
}
```

### External Service Integration

```typescript
// ✅ Configuration for third-party services
const stripeConfig = {
  apiKey: process.env.STRIPE_KEY,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
}
```

## Benefits

### Reduced Cognitive Load

- Developers don't need to make decisions already made
- New team members learn one way of doing things
- Less documentation needed

### Faster Development

- No time spent on configuration
- Copy existing patterns
- Focus on business logic

### Better Consistency

- All code follows same patterns
- Predictable structure
- Easier code reviews

### Easier Maintenance

- Changes to conventions affect all code
- No configuration drift
- Less surface area for bugs

## Implementation Guidelines

### 1. Establish Conventions Early

Define patterns at project start:
- File structure
- Naming patterns
- Error handling
- Testing approach

### 2. Document Conventions

Create wiki pages for each convention:
- [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md)
- [Naming Conventions](../Conventions/Naming-Conventions.md)
- [Testing Strategy](../Testing/Jest-ESM-Mocking-Strategy.md)

### 3. Enforce Through Code Review

Checklist items:
- [ ] Follows established patterns?
- [ ] Adds configuration only when necessary?
- [ ] Documents any exceptions?

### 4. Automate Where Possible

```json
// ESLint rule enforcing file structure
{
  "rules": {
    "project/lambda-structure": "error"
  }
}
```

## Anti-Patterns

### Configuration Proliferation

```
❌ config/
   ├── lambda-config.json
   ├── test-config.json
   ├── build-config.json
   ├── deploy-config.json
   └── ... (10 more configs)
```

### Premature Flexibility

Making things configurable "just in case" before you need it.

### Convention Exceptions

Breaking conventions for personal preference rather than necessity.

## Related Patterns

- [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) - Standard Lambda conventions
- [Naming Conventions](../Conventions/Naming-Conventions.md) - Consistent naming patterns
- [Project Structure](../Infrastructure/File-Organization.md) - Standard file organization
- [Testing Patterns](../Testing/Jest-ESM-Mocking-Strategy.md) - Test conventions

## Enforcement

- **Code Reviews**: Check for unnecessary configuration
- **Templates**: Provide standard templates for new components
- **Generators**: Use code generators that follow conventions
- **Linters**: Custom ESLint rules for project conventions

---

*Choose convention over configuration. Make the easy path the right path.*