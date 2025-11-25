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

## No Defaults in Code

Environment variables are required and verified by unit tests. Don't provide defaults:

```typescript
// ❌ WRONG - Don't use defaults
const tableName = process.env.DynamoDBTableName || 'default-table'

// ✅ CORRECT - Required, verified by tests
const tableName = process.env.DynamoDBTableName as string
```

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

- `DynamoDBTableName` - DynamoDB table
- `PlatformApplicationArn` - SNS platform app
- `PushNotificationTopicArn` - SNS topic
- `FeedlyQueueUrl` - SQS queue
- `EnableXRay` - X-Ray tracing
- `UseLocalstack` - LocalStack testing

## Related Patterns

- [Infrastructure/Environment-Variables](../Infrastructure/Environment-Variables.md)
- [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md)

---

*Use CamelCase for Lambda environment variables. Verify presence with unit tests, not defaults.*