# Integration Testing

## Quick Reference
- **When to use**: Testing AWS service interactions
- **Enforcement**: Required for AWS changes
- **Impact if violated**: HIGH - Production issues

## LocalStack Setup

```bash
# Start LocalStack
npm run localstack:start

# Run integration tests
npm run test:integration

# Full suite with lifecycle
npm run test:integration:full
```

## Test Pattern

```typescript
// test/integration/dynamodb.test.ts
import {beforeAll, afterAll, test} from '@jest/globals'
import {setupLocalStack, teardownLocalStack} from '../helpers'

beforeAll(async () => {
  process.env.UseLocalstack = 'true'
  await setupLocalStack()
})

afterAll(async () => {
  await teardownLocalStack()
})

test('DynamoDB operations', async () => {
  const result = await queryItems({userId: 'test'})
  expect(result).toBeDefined()
})
```

## Service Testing

### DynamoDB
```typescript
const items = await Files.query.byUser({userId}).go()
```

### S3
```typescript
await createS3Upload('bucket', 'key', Buffer.from('data'))
```

### Lambda
```typescript
const result = await lambda.invoke({
  FunctionName: 'ProcessFile',
  Payload: JSON.stringify({fileId: 'test'})
})
```

## Docker Compose

```yaml
services:
  localstack:
    image: localstack/localstack:latest
    ports:
      - "4566:4566"
    environment:
      - SERVICES=s3,dynamodb,lambda,sns,sqs
```

## Best Practices

✅ Use vendor wrappers (auto-detect LocalStack)
✅ Clean state between tests
✅ Mock external APIs
✅ Test error cases
✅ Verify AWS operations

## Common Issues

| Issue | Fix |
|-------|-----|
| Connection refused | Start LocalStack |
| Service unavailable | Check SERVICES env |
| State pollution | Clean between tests |

## Related Patterns

- [LocalStack Testing](../Integration/LocalStack-Testing.md)
- [Jest ESM Mocking](Jest-ESM-Mocking-Strategy.md)

---

*Test AWS integrations locally with LocalStack. Vendor wrappers auto-detect environment.*