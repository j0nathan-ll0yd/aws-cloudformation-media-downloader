# Phase 2: Integration Tests Migration Plan

## Overview

Phase 2 completes the fixture automation initiative by migrating from AWS SDK mock fixtures to LocalStack integration tests. This eliminates 60-70% of hand-crafted fixtures and increases test confidence by testing against real AWS service behavior.

## Current State

**Completed (Phase 1)**:
- ✅ Fixture logging functions (`logIncomingFixture`, `logOutgoingFixture`)
- ✅ CloudWatch extraction scripts with deduplication and sanitization
- ✅ GitHub Actions workflow for weekly automated extraction
- ✅ Documentation and runbooks

**Incomplete**:
- ❌ Integration tests for AWS SDK interactions
- ❌ Migration of unit tests to integration tests
- ❌ Deletion of obsolete AWS SDK mock fixtures

## Goals

### Quantified Targets
- **67% fewer fixture files**: ~45 fixtures → ~15 fixtures
- **71% fewer lines of fixture JSON**: ~3,500 lines → ~1,000 lines
- **87% less maintenance time**: ~2 hours/month → ~15 minutes/month
- **100% elimination of manual fixture updates** for AWS SDK responses
- **≥80% coverage of data access patterns** via integration tests

### Qualitative Benefits
- ✅ Integration tests catch AWS SDK breaking changes
- ✅ Higher confidence in AWS service interactions
- ✅ No fixture staleness for AWS SDK responses
- ✅ Better test failure diagnostics (real vs. mock behavior)

## Implementation Plan

### Step 1: Inventory Current AWS SDK Fixtures

Identify all hand-crafted AWS SDK response fixtures to be replaced:

```bash
# Find all AWS SDK mock fixtures
find src/lambdas -name "*.json" -path "*/test/fixtures/*" | \
  xargs grep -l "Items\|Count\|ResponseMetadata" | \
  sort
```

Expected fixtures to replace (examples):
- `batchGet-200-OK.json` - DynamoDB BatchGetItem
- `query-200-OK.json` - DynamoDB Query
- `query-200-Empty.json` - DynamoDB Query empty
- `updateItem-202-Accepted.json` - DynamoDB UpdateItem
- `scan-200-OK.json` - DynamoDB Scan
- `createPlatformEndpoint-200-OK.json` - SNS CreatePlatformEndpoint
- `publish-200-OK.json` - SNS Publish
- `sendMessage-200-OK.json` - SQS SendMessage

### Step 2: Create Integration Test Framework

Location: `test/integration/workflows/*.workflow.integration.test.ts`

**Base Test Structure**:
```typescript
import {describe, test, expect, beforeAll, afterAll} from '@jest/globals'
import {DynamoDBClient, CreateTableCommand} from '@aws-sdk/client-dynamodb'
import {S3Client} from '@aws-sdk/client-s3'

describe('WebhookFeedly Workflow Integration', () => {
  let dynamoClient: DynamoDBClient
  let s3Client: S3Client

  beforeAll(async () => {
    // Setup LocalStack clients
    dynamoClient = new DynamoDBClient({
      endpoint: 'http://localhost:4566',
      region: 'us-west-2'
    })

    // Create test tables
    await dynamoClient.send(new CreateTableCommand({
      TableName: 'Files',
      KeySchema: [{AttributeName: 'fileId', KeyType: 'HASH'}],
      AttributeDefinitions: [{AttributeName: 'fileId', AttributeType: 'S'}],
      BillingMode: 'PAY_PER_REQUEST'
    }))
  })

  afterAll(async () => {
    // Cleanup
    dynamoClient.destroy()
  })

  test('should handle new file webhook request', async () => {
    // Insert test data into LocalStack DynamoDB
    // Call handler with real event
    // Assert response and verify DynamoDB state changes
  })
})
```

### Step 3: Implement Workflow-Based Integration Tests

**Priority Order**:

1. **High Priority** (Multi-service workflows):
   - `webhookFeedly.workflow.integration.test.ts` - Webhook → DynamoDB → SQS → Lambda
   - `fileCoordinator.workflow.integration.test.ts` - Scheduled → DynamoDB Query → Lambda fan-out
   - `startFileUpload.workflow.integration.test.ts` - Download → S3 Upload → DynamoDB Update

2. **Medium Priority** (Single service + logic):
   - `listFiles.workflow.integration.test.ts` - DynamoDB Query with filtering/pagination
   - `registerDevice.workflow.integration.test.ts` - DynamoDB + SNS conditional creates

3. **Low Priority** (Simple CRUD):
   - Skip pure CRUD operations without orchestration logic

### Step 4: Migrate Unit Tests

For each Lambda with integration tests:

1. Review existing unit tests
2. Identify tests that mock AWS SDK responses
3. Either:
   - **Delete** if covered by integration test
   - **Keep** if testing edge cases/error handling not in integration tests
4. Update remaining unit tests to focus on business logic

Example migration:

**Before (Unit Test)**:
```typescript
const queryMock = jest.fn().mockResolvedValue(queryFixture)
jest.unstable_mockModule('../../../lib/vendor/AWS/DynamoDB', () => ({
  query: queryMock
}))

test('lists files when user has files', async () => {
  const response = await handler(event, context)
  expect(response.statusCode).toBe(200)
})
```

**After (Integration Test)**:
```typescript
test('lists files when user has files', async () => {
  // Insert real data into LocalStack DynamoDB
  await dynamoClient.send(new PutItemCommand({
    TableName: 'Files',
    Item: {fileId: {S: 'test123'}, status: {S: 'Downloaded'}}
  }))

  // Call handler (hits real LocalStack)
  const response = await handler(event, context)

  // Assert response
  expect(response.statusCode).toBe(200)
  const body = JSON.parse(response.body)
  expect(body.body.files).toHaveLength(1)
  expect(body.body.files[0].fileId).toBe('test123')
})
```

### Step 5: Delete Obsolete Fixtures

After integration tests pass:

```bash
# Delete AWS SDK response fixtures
rm src/lambdas/*/test/fixtures/batchGet-*.json
rm src/lambdas/*/test/fixtures/query-*.json
rm src/lambdas/*/test/fixtures/scan-*.json
rm src/lambdas/*/test/fixtures/updateItem-*.json
rm src/lambdas/*/test/fixtures/createPlatformEndpoint-*.json
rm src/lambdas/*/test/fixtures/publish-*.json
rm src/lambdas/*/test/fixtures/sendMessage-*.json
```

Verify with:
```bash
npm test  # All tests should still pass
```

### Step 6: Update Documentation

1. Update `testStyleGuide.md`:
   - Document integration test patterns
   - Explain when to use unit vs integration tests
   - Add examples of LocalStack setup

2. Update `README.md`:
   - Document LocalStack requirement
   - Add integration test running instructions
   - Update fixture count metrics

3. Update `FIXTURE_EXTRACTION_RUNBOOK.md`:
   - Note that AWS SDK fixtures are auto-generated via integration tests
   - Only external API fixtures need extraction

## Success Criteria

- [ ] ≥80% of AWS SDK interactions covered by integration tests
- [ ] AWS SDK mock fixtures deleted (50-60 files)
- [ ] All tests pass (unit + integration)
- [ ] Documentation updated
- [ ] CI/CD updated to run integration tests with LocalStack
- [ ] Fixture count reduced by ≥60%

## Timeline Estimate

- **Setup integration test framework**: 2-3 hours
- **Write high-priority workflow tests**: 6-8 hours
- **Migrate/delete unit tests**: 3-4 hours
- **Update documentation**: 1-2 hours
- **Total**: 12-17 hours

## Dependencies

- LocalStack running locally or in CI
- Docker for LocalStack
- Updated test scripts to start/stop LocalStack

## Risks & Mitigation

| Risk | Mitigation |
|------|------------|
| LocalStack behavior differs from AWS | Use LocalStack Pro or AWS-certified images; validate critical workflows in staging |
| Integration tests slow | Run unit tests first, integration tests on PR only; parallelize where possible |
| Flaky tests due to async operations | Add proper waits/polling; use LocalStack readiness checks |
| CI/CD complexity | Document LocalStack setup; provide docker-compose configuration |

## Future Enhancements

- Generate AWS SDK fixtures FROM integration tests (record mode)
- Snapshot testing for complex responses
- Performance benchmarking for LocalStack vs real AWS
- Chaos testing with LocalStack failures

## References

- LocalStack documentation: https://docs.localstack.cloud/
- Jest integration testing: https://jestjs.io/docs/testing-frameworks
- AWS SDK v3 testing: https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/testing.html
