# Convention Over Configuration

## Quick Reference
- **When to use**: All development decisions and architectural choices
- **Enforcement**: Philosophy, code reviews, established patterns
- **Impact if violated**: LOW - Increased complexity, inconsistency, maintenance burden

## Overview

Prefer established patterns with sensible defaults over flexible configuration. This principle reduces decision fatigue, improves consistency, speeds development, and makes the codebase more predictable.

## The Rules

1. **Use Project Defaults** - Don't configure what already has a sensible default
2. **Follow Established Patterns** - Use existing patterns before creating new ones
3. **Minimize Configuration Files** - Avoid proliferation of config files when conventions suffice
4. **Document Exceptions** - When configuration is necessary, document why the convention doesn't work

## Examples

### ✅ Correct - Using Convention for Lambda Handlers

```typescript
// src/lambdas/ListFiles/src/index.ts

// Standard Lambda pattern - no configuration needed
import {lambdaErrorResponse, response, logInfo, getUserDetailsFromEvent} from '../../../util/lambda-helpers'
import {withXRay} from '../../../lib/vendor/AWS/XRay'
import {Files} from '../../../entities/Files'

export const handler = withXRay(async (event, context, {traceId}) => {
  logInfo('event <=', event)  // Standard logging pattern

  try {
    const {userId, userStatus} = getUserDetailsFromEvent(event)
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

Problems: Configuration duplicates what conventions provide, custom patterns when standard ones work.

### ❌ Incorrect - Configuration Files for Standard Behavior

```json
// ❌ lambda-config.json (unnecessary)
{
  "handlers": {
    "ProcessFile": {
      "path": "src/lambdas/ProcessFile/src/index.ts",
      "handler": "handler",
      "runtime": "nodejs22.x"
    }
  }
}
```

Instead: Use convention that all Lambdas follow the same structure.

## Real Project Examples

### Lambda Conventions

```typescript
// Convention: All API Gateway Lambdas return responses
// No need to configure response vs throw behavior
if (isApiGatewayLambda) {
  return response(context, statusCode, body)
} else {
  throw error  // Event-driven Lambdas throw for retry
}
```

### Testing Conventions

```typescript
// Convention: Test files mirror source files
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

## Implementation Guidelines

1. **Establish Conventions Early** - Define patterns at project start
2. **Document Conventions** - Create wiki pages for each convention
3. **Enforce Through Code Review** - Check that code follows established patterns
4. **Automate Where Possible** - ESLint rules for project conventions

## Related Patterns

- [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) - Standard Lambda conventions
- [Naming Conventions](../Conventions/Naming-Conventions.md) - Consistent naming patterns
- [Testing Patterns](../Testing/Jest-ESM-Mocking-Strategy.md) - Test conventions

---

*Choose convention over configuration. Make the easy path the right path.*
