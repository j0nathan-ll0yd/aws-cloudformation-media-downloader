# Capture Test Fixtures

Generate test fixtures from CloudWatch logs for realistic test data.

## Quick Start

```bash
# Usage: /capture-fixtures <lambda-name> [--production]
# Example: /capture-fixtures ListFiles
# Example: /capture-fixtures WebhookFeedly --production
```

## Workflow

### Step 1: Query CloudWatch Logs

```bash
# Get recent invocations
aws logs filter-log-events \
  --log-group-name "/aws/lambda/${LAMBDA_NAME}" \
  --start-time $(date -v-1H +%s000) \
  --filter-pattern "{ $.type = \"REQUEST\" }" \
  --limit 10
```

### Step 2: Extract Request/Response Pairs

Parse CloudWatch logs for:
- Incoming event payload
- Handler response
- Duration and memory usage

### Step 3: Sanitize Sensitive Data

Remove or mask:
- User IDs (replace with `test-user-id`)
- Tokens (replace with `test-token`)
- Email addresses (replace with `test@example.com`)
- Timestamps (normalize to fixed values)

### Step 4: Generate Fixture Files

Create fixture in `test/fixtures/`:

```typescript
// test/fixtures/listfiles-success.ts
export const listFilesSuccessFixture = {
  event: {
    httpMethod: 'GET',
    path: '/files',
    headers: {
      Authorization: 'Bearer test-token',
    },
    queryStringParameters: {
      limit: '10',
    },
    requestContext: {
      authorizer: {
        userId: 'test-user-id',
      },
    },
  },
  expectedResponse: {
    statusCode: 200,
    body: {
      files: [
        {
          fileId: 'file-123',
          fileName: 'test-video.mp4',
          status: 'Downloaded',
          size: 1024000,
        },
      ],
      nextToken: null,
    },
  },
};
```

### Step 5: Create Test Stub

Generate test case using fixture:

```typescript
import { listFilesSuccessFixture } from '@test/fixtures/listfiles-success';

it('should list files successfully', async () => {
  // Arrange
  const { event, expectedResponse } = listFilesSuccessFixture;
  setupMocksForScenario(expectedResponse);

  // Act
  const result = await handler(event, mockContext);

  // Assert
  expect(result.statusCode).toBe(expectedResponse.statusCode);
  expect(JSON.parse(result.body)).toEqual(expectedResponse.body);
});
```

---

## Output Format

```markdown
## Fixture Capture Report

### Lambda: ListFiles

### Captured Scenarios

| Scenario | Source | Fixtures Created |
|----------|--------|------------------|
| Success with files | Production | listfiles-success.ts |
| Empty result | Production | listfiles-empty.ts |
| Pagination | Production | listfiles-pagination.ts |
| Invalid token | Production | listfiles-auth-error.ts |

### Files Created

1. `test/fixtures/listfiles-success.ts`
2. `test/fixtures/listfiles-empty.ts`
3. `test/fixtures/listfiles-pagination.ts`
4. `test/fixtures/listfiles-auth-error.ts`

### Sanitization Applied

| Field | Original Pattern | Replacement |
|-------|------------------|-------------|
| userId | uuid | test-user-id |
| Authorization | Bearer xxx | Bearer test-token |
| email | *@*.com | test@example.com |
| timestamp | ISO date | 2025-01-01T00:00:00Z |

### Test Stubs Generated

Added to `src/lambdas/ListFiles/test/index.test.ts`:
- `describe('production scenarios')` block
- 4 new test cases from fixtures

### Human Review Required

- [ ] Verify sanitization is complete
- [ ] Check no PII remains in fixtures
- [ ] Review test assertions
- [ ] Commit fixtures to git
```

---

## Human Checkpoints

1. **Review captured data** - Ensure no sensitive data included
2. **Approve sanitization** - Verify all PII masked
3. **Review fixtures before commit** - Check data quality

---

## Sanitization Rules

| Data Type | Detection Pattern | Replacement |
|-----------|-------------------|-------------|
| UUID | `/[0-9a-f]{8}-[0-9a-f]{4}-/` | test-uuid-{n} |
| Email | `/@.*\./` | test@example.com |
| Token | `/^Bearer /` | Bearer test-token |
| Device Token | `/[A-Fa-f0-9]{64}/` | test-device-token |
| Timestamp | ISO 8601 | 2025-01-01T00:00:00Z |
| IP Address | `/\d+\.\d+\.\d+\.\d+/` | 127.0.0.1 |

---

## Fixture Patterns

### API Gateway Event

```typescript
export const createApiGatewayFixture = (overrides = {}) => ({
  httpMethod: 'GET',
  path: '/files',
  headers: {
    Authorization: 'Bearer test-token',
    'Content-Type': 'application/json',
  },
  queryStringParameters: null,
  pathParameters: null,
  body: null,
  isBase64Encoded: false,
  requestContext: {
    authorizer: { userId: 'test-user-id' },
  },
  ...overrides,
});
```

### SQS Event

```typescript
export const createSqsFixture = (body: object) => ({
  Records: [{
    messageId: 'test-message-id',
    body: JSON.stringify(body),
    attributes: {},
    messageAttributes: {},
  }],
});
```

### S3 Event

```typescript
export const createS3Fixture = (bucket: string, key: string) => ({
  Records: [{
    s3: {
      bucket: { name: bucket },
      object: { key },
    },
  }],
});
```

---

## Production Flag

When using `--production`:

1. Uses production CloudWatch logs
2. Applies stricter sanitization
3. Requires additional confirmation
4. Logs capture audit trail

```bash
/capture-fixtures WebhookFeedly --production
```

**CHECKPOINT**: Confirm production capture is authorized.

---

## Notes

- Run regularly to keep fixtures current
- Always sanitize before committing
- Use fixtures for integration tests
- Document fixture sources in comments
