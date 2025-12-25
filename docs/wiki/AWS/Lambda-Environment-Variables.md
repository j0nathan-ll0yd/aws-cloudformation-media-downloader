# Lambda Environment Variables

## Quick Reference
- **When to use**: Configuring Lambda functions
- **Enforcement**: Required - unit tests verify presence
- **Impact if violated**: HIGH - Runtime failures

## Naming Convention

Use **CamelCase** for Lambda environment variable names:

```typescript
process.env.DynamoDBTableName
process.env.PlatformApplicationArn
process.env.PushNotificationTopicArn
process.env.FeedlyQueueUrl
```

## Centralized Access (REQUIRED)

Always use the `getRequiredEnv()` helper instead of direct `process.env` access:

```typescript
import {getRequiredEnv, getOptionalEnv, getOptionalEnvNumber} from '#lib/system/env'

// ✅ CORRECT - Centralized access with clear error messages
const tableName = getRequiredEnv('DynamoDBTableName')
const apiHost = getOptionalEnv('API_HOST', 'api.example.com')
const batchSize = getOptionalEnvNumber('BATCH_SIZE', 10)

// ❌ WRONG - Direct process.env access
const tableName = process.env.DynamoDBTableName || 'default-table'
const tableName = process.env.DynamoDBTableName as string
```

**Why**:
- Fail-fast at cold start with clear error messages
- Centralized validation ensures consistency
- Type-safe access (no runtime `undefined` surprises)

**Enforcement**: ESLint `local-rules/strict-env-vars` (HIGH severity)

## No Defaults in Code

Environment variables are required and verified by unit tests. Don't provide defaults:

```typescript
// ❌ WRONG - Don't use defaults
const tableName = process.env.DynamoDBTableName || 'default-table'

// ✅ CORRECT - Use getRequiredEnv
const tableName = getRequiredEnv('DynamoDBTableName')
```

## No Try-Catch for Required Variables (CRITICAL)

**Zero-tolerance rule**: NEVER wrap required environment variable access in try-catch blocks with fallback values.

```typescript
// ❌ WRONG - Silent failures hide configuration errors
try {
  const config = JSON.parse(process.env.SignInWithAppleConfig)
} catch {
  return { clientId: 'fallback', teamId: 'fallback' }
}

// ✅ CORRECT - Let it fail if misconfigured
const config = JSON.parse(process.env.SignInWithAppleConfig)
```

**Why**: Infrastructure tests enforce that all required environment variables are properly configured. Silent failures in production hide critical configuration errors that should fail fast and loud.

**Enforcement**: Unit tests verify all environment variables are present and valid. Production deployment validation catches missing variables before runtime.

## Unit Test Verification

```typescript
// test/setup.ts
beforeAll(() => {
  process.env.DynamoDBTableName = 'test-table'
  process.env.PlatformApplicationArn = 'arn:aws:sns:test'
})
```

## OpenTofu Configuration

```hcl
resource "aws_lambda_function" "ListFiles" {
  environment {
    variables = {
      DynamoDBTableName = aws_dynamodb_table.main.name
      EnableXRay        = var.enable_xray
    }
  }
}
```

## Common Variables

- `DynamoDBTableName` - DynamoDB table (set in OpenTofu)
- `PlatformApplicationArn` - SNS platform app
- `PushNotificationTopicArn` - SNS topic
- `FeedlyQueueUrl` - SQS queue
- `EnableXRay` - X-Ray tracing (read as ENABLE_XRAY in code)
- `UseLocalstack` - LocalStack testing (read as USE_LOCALSTACK in code)

## Related Patterns

- [Infrastructure/Environment-Variables](../Infrastructure/Environment-Variables.md)
- [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md)

---

*Use CamelCase for Lambda environment variables. Verify presence with unit tests, not defaults.*