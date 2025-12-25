# Lambda Environment Variables

## Quick Reference
- **When to use**: Configuring Lambda functions
- **Enforcement**: Required - unit tests verify presence
- **Impact if violated**: HIGH - Runtime failures

## Naming Convention

Use **SCREAMING_CASE** for Lambda environment variable names:

```typescript
process.env.DYNAMODB_TABLE_NAME
process.env.PLATFORM_APPLICATION_ARN
process.env.PUSH_NOTIFICATION_TOPIC_ARN
process.env.SNS_QUEUE_URL
```

## Centralized Access (REQUIRED)

Always use the `getRequiredEnv()` helper instead of direct `process.env` access:

```typescript
import {getRequiredEnv, getOptionalEnv, getOptionalEnvNumber} from '#lib/system/env'

// ✅ CORRECT - Centralized access with clear error messages
const tableName = getRequiredEnv('DYNAMODB_TABLE_NAME')
const apiHost = getOptionalEnv('API_HOST', 'api.example.com')
const batchSize = getOptionalEnvNumber('BATCH_SIZE', 10)

// ❌ WRONG - Direct process.env access
const tableName = process.env.DYNAMODB_TABLE_NAME || 'default-table'
const tableName = process.env.DYNAMODB_TABLE_NAME as string
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
const tableName = process.env.DYNAMODB_TABLE_NAME || 'default-table'

// ✅ CORRECT - Use getRequiredEnv
const tableName = getRequiredEnv('DYNAMODB_TABLE_NAME')
```

## No Try-Catch for Required Variables (CRITICAL)

**Zero-tolerance rule**: NEVER wrap required environment variable access in try-catch blocks with fallback values.

```typescript
// ❌ WRONG - Silent failures hide configuration errors
try {
  const config = JSON.parse(process.env.SIGN_IN_WITH_APPLE_CONFIG)
} catch {
  return { clientId: 'fallback', teamId: 'fallback' }
}

// ✅ CORRECT - Let it fail if misconfigured
const config = JSON.parse(process.env.SIGN_IN_WITH_APPLE_CONFIG)
```

**Why**: Infrastructure tests enforce that all required environment variables are properly configured. Silent failures in production hide critical configuration errors that should fail fast and loud.

**Enforcement**: Unit tests verify all environment variables are present and valid. Production deployment validation catches missing variables before runtime.

## Unit Test Verification

```typescript
// test/setup.ts
beforeAll(() => {
  process.env.DYNAMODB_TABLE_NAME = 'test-table'
  process.env.PLATFORM_APPLICATION_ARN = 'arn:aws:sns:test'
})
```

## OpenTofu Configuration

```hcl
resource "aws_lambda_function" "ListFiles" {
  environment {
    variables = merge(local.common_lambda_env, {
      OTEL_SERVICE_NAME      = "ListFiles"
      DYNAMODB_TABLE_NAME    = aws_dynamodb_table.main.name
      ENABLE_XRAY            = var.enable_xray
    })
  }
}
```

## Common Variables

| Variable | Description |
|----------|-------------|
| `DYNAMODB_TABLE_NAME` | DynamoDB table name |
| `PLATFORM_APPLICATION_ARN` | SNS platform application ARN |
| `PUSH_NOTIFICATION_TOPIC_ARN` | SNS topic for push notifications |
| `SNS_QUEUE_URL` | SQS queue URL for async processing |
| `BUCKET` | S3 bucket name for media storage |
| `CLOUDFRONT_DOMAIN` | CloudFront distribution domain |
| `APNS_TEAM` | Apple Push Notification team ID |
| `APNS_KEY_ID` | APNS signing key ID |
| `APNS_SIGNING_KEY` | APNS signing key (P8 format) |
| `APNS_DEFAULT_TOPIC` | Default APNS topic (bundle ID) |
| `ENABLE_XRAY` | X-Ray tracing toggle |
| `USE_LOCALSTACK` | LocalStack testing toggle |

## Related Patterns

- [Infrastructure/Environment-Variables](../Infrastructure/Environment-Variables.md)
- [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md)

---

*Use SCREAMING_CASE for Lambda environment variables. Verify presence with unit tests, not defaults.*
