# LocalStack Testing

## Quick Reference
- **When to use**: Local AWS service testing
- **Enforcement**: Recommended for integration tests
- **Impact if violated**: LOW - Tests run against real AWS

## Setup

```bash
# Start LocalStack
npm run localstack:start

# Run integration tests
npm run test:integration

# Full test suite with lifecycle
npm run test:integration:full
```

## Configuration

### Docker Compose

```yaml
# docker-compose.yml
services:
  localstack:
    image: localstack/localstack:latest
    ports:
      - "4566:4566"
    environment:
      - SERVICES=s3,dynamodb,lambda,sns,sqs,apigateway
      - AWS_DEFAULT_REGION=us-west-2
```

### Test Environment

```typescript
// test/helpers/localstack-config.ts
export const localstackConfig = {
  endpoint: 'http://localhost:4566',
  region: 'us-west-2',
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test'
  }
}
```

## Vendor Wrapper Pattern

All AWS SDK clients use vendor wrappers that automatically detect LocalStack:

```typescript
// lib/vendor/AWS/DynamoDB.ts
function getDynamoDbClient(): DynamoDBClient {
  if (process.env.USE_LOCALSTACK === 'true') {
    return new DynamoDBClient({
      endpoint: 'http://localhost:4566',
      region: 'us-west-2'
    })
  }
  return new DynamoDBClient()
}
```

## Integration Test Pattern

```typescript
// test/integration/lambda.test.ts
import {beforeAll, afterAll, test} from '@jest/globals'
import {setupLocalStack, teardownLocalStack} from '../helpers/localstack'

beforeAll(async () => {
  await setupLocalStack()
})

afterAll(async () => {
  await teardownLocalStack()
})

test('Lambda processes file', async () => {
  // Test against LocalStack services
  const result = await lambda.invoke({
    FunctionName: 'ProcessFile',
    Payload: JSON.stringify({fileId: 'test'})
  })

  expect(result.StatusCode).toBe(200)
})
```

## Service-Specific Setup

### DynamoDB
```bash
aws --endpoint-url=http://localhost:4566 dynamodb create-table \
  --table-name MediaDownloader \
  --attribute-definitions AttributeName=PK,AttributeType=S
```

### S3
```bash
aws --endpoint-url=http://localhost:4566 s3 mb s3://media-files
```

### Lambda
```bash
aws --endpoint-url=http://localhost:4566 lambda create-function \
  --function-name ProcessFile \
  --runtime nodejs22.x
```

## Common Issues

| Issue | Solution |
|-------|----------|
| Connection refused | Ensure LocalStack is running |
| Service not available | Check SERVICES env var |
| Credentials error | Use 'test' for both key and secret |
| Region mismatch | Use us-west-2 consistently |

## Best Practices

1. **Use vendor wrappers** - Automatic LocalStack detection
2. **Set UseLocalstack=true** - Enable LocalStack mode
3. **Clean state between tests** - Reset services in afterEach
4. **Mock external services** - Don't call real APIs from LocalStack

## Related Patterns

- [Vendor Wrappers](../AWS/SDK-Encapsulation-Policy.md) - AWS SDK encapsulation
- [Integration Testing](../Testing/Integration-Testing.md) - Test strategies
- [Jest ESM Mocking](../Testing/Jest-ESM-Mocking-Strategy.md) - Mocking patterns

---

*Use LocalStack for local AWS testing. Vendor wrappers automatically detect LocalStack mode.*