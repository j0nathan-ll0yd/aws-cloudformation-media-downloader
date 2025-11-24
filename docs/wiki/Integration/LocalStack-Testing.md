# LocalStack Integration Testing

This document defines patterns and practices for integration testing with LocalStack in this project.

## Overview

Integration tests verify AWS service interactions without mocking, using LocalStack as a local AWS environment. These tests ensure vendor wrappers and service integrations work correctly.

## Test Structure

### File Organization

```
test/
└── integration/
    ├── helpers/           # Shared test utilities
    │   ├── dynamodb-helpers.ts
    │   ├── s3-helpers.ts
    │   └── test-data.ts
    ├── lib/              # Vendor wrapper tests
    │   └── vendor/
    │       └── AWS/
    │           ├── DynamoDB.ts
    │           └── S3.ts
    └── workflows/        # End-to-end workflow tests
        ├── fileCoordinator.workflow.integration.test.ts
        └── listFiles.workflow.integration.test.ts
```

## Environment Configuration

### LocalStack Setup

Integration tests require LocalStack running on `http://localhost:4566`:

```bash
# Start LocalStack
npm run localstack:start

# Run integration tests
npm run test:integration

# Stop LocalStack
npm run localstack:stop
```

### Environment Variables

Tests automatically set LocalStack configuration:

```typescript
// Set by jest.integration.config.mjs
process.env.USE_LOCALSTACK = 'true'
process.env.LOCALSTACK_ENDPOINT = 'http://localhost:4566'
process.env.AWS_REGION = 'us-east-1'
```

## Module Mocking (Jest ESM Path Resolution)

Jest's `unstable_mockModule` has path resolution issues with relative imports from `test/integration/setup.ts` context.

### ❌ DON'T: Relative paths fail

```typescript
jest.unstable_mockModule('../../../src/lib/vendor/AWS/Lambda', () => ({
  invokeLambda: mockFn
}))
// Error: Cannot find module
```

### ❌ DON'T: Hardcoded absolute paths

```typescript
jest.unstable_mockModule('/Users/you/project/src/lib/vendor/AWS/Lambda', () => ({
  invokeLambda: mockFn
}))
// Breaks on other machines
```

### ✅ DO: Compute path from test file location

```typescript
import {fileURLToPath} from 'url'
import {dirname, resolve} from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const lambdaModulePath = resolve(__dirname, '../../../src/lib/vendor/AWS/Lambda')

const invokeLambdaMock = jest.fn<() => Promise<{StatusCode: number}>>()
jest.unstable_mockModule(lambdaModulePath, () => ({
  invokeLambda: invokeLambdaMock,
  invokeAsync: invokeLambdaMock
}))
```

**Why**: Resolves path at runtime relative to test file, works on any machine.

## Test Patterns

### Basic Test Structure

```typescript
import {describe, test, expect, beforeAll, afterAll} from '@jest/globals'
import {createTable, deleteTable, scanTable} from '../helpers/dynamodb-helpers'
import {TEST_TABLE_NAME} from '../helpers/test-data'

describe('DynamoDB Integration', () => {
  beforeAll(async () => {
    // Create test resources
    await createTable(TEST_TABLE_NAME)
  })

  afterAll(async () => {
    // Clean up test resources
    await deleteTable(TEST_TABLE_NAME)
  })

  test('should perform DynamoDB operations', async () => {
    // Test implementation
  })
})
```

### Helper Functions

#### DynamoDB Helpers

```typescript
// test/integration/helpers/dynamodb-helpers.ts

export async function createTable(tableName: string): Promise<void> {
  const params = {
    TableName: tableName,
    KeySchema: [
      {AttributeName: 'pk', KeyType: 'HASH'},
      {AttributeName: 'sk', KeyType: 'RANGE'}
    ],
    AttributeDefinitions: [
      {AttributeName: 'pk', AttributeType: 'S'},
      {AttributeName: 'sk', AttributeType: 'S'}
    ],
    BillingMode: 'PAY_PER_REQUEST'
  }

  await dynamoClient.send(new CreateTableCommand(params))
  await waitForTable(tableName)
}

export async function seedTable(tableName: string, items: any[]): Promise<void> {
  for (const item of items) {
    await dynamoClient.send(new PutItemCommand({
      TableName: tableName,
      Item: marshall(item)
    }))
  }
}
```

#### S3 Helpers

```typescript
// test/integration/helpers/s3-helpers.ts

export async function createBucket(bucketName: string): Promise<void> {
  await s3Client.send(new CreateBucketCommand({
    Bucket: bucketName
  }))
}

export async function uploadFile(
  bucketName: string,
  key: string,
  content: string
): Promise<void> {
  await s3Client.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: content
  }))
}

export async function getFileContent(
  bucketName: string,
  key: string
): Promise<string> {
  const response = await s3Client.send(new GetObjectCommand({
    Bucket: bucketName,
    Key: key
  }))
  return streamToString(response.Body)
}
```

## Testing Vendor Wrappers

### DynamoDB Wrapper Tests

```typescript
describe('DynamoDB Vendor Wrapper', () => {
  const tableName = 'TestTable'

  beforeAll(async () => {
    await createTable(tableName)
  })

  afterAll(async () => {
    await deleteTable(tableName)
  })

  test('query should return filtered items', async () => {
    // Seed test data
    await seedTable(tableName, [
      {pk: 'USER#123', sk: 'FILE#456', status: 'active'},
      {pk: 'USER#123', sk: 'FILE#789', status: 'deleted'},
      {pk: 'USER#999', sk: 'FILE#111', status: 'active'}
    ])

    // Test query wrapper
    const result = await query({
      TableName: tableName,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': 'USER#123'
      }
    })

    expect(result.Items).toHaveLength(2)
    expect(result.Items[0].pk).toBe('USER#123')
  })

  test('batchGet should retrieve multiple items', async () => {
    const keys = [
      {pk: 'USER#123', sk: 'FILE#456'},
      {pk: 'USER#123', sk: 'FILE#789'}
    ]

    const result = await batchGet({
      RequestItems: {
        [tableName]: {
          Keys: keys.map(key => marshall(key))
        }
      }
    })

    expect(result.Responses[tableName]).toHaveLength(2)
  })
})
```

### S3 Wrapper Tests

```typescript
describe('S3 Vendor Wrapper', () => {
  const bucketName = 'test-bucket'

  beforeAll(async () => {
    await createBucket(bucketName)
  })

  afterAll(async () => {
    await deleteBucket(bucketName)
  })

  test('createS3Upload should upload file', async () => {
    const key = 'test-file.txt'
    const content = 'Hello, World!'

    const upload = createS3Upload(bucketName, key, Buffer.from(content))
    await upload.done()

    const uploaded = await getFileContent(bucketName, key)
    expect(uploaded).toBe(content)
  })

  test('headObject should return file metadata', async () => {
    const key = 'meta-test.txt'
    await uploadFile(bucketName, key, 'test content')

    const metadata = await headObject(bucketName, key)
    expect(metadata.ContentLength).toBeGreaterThan(0)
    expect(metadata.ContentType).toBeDefined()
  })
})
```

## Workflow Testing

### End-to-End Tests

Test complete Lambda workflows with real AWS service interactions:

```typescript
describe('ListFiles Workflow', () => {
  const userId = 'test-user-123'
  const filesTable = 'Files'
  const userFilesTable = 'UserFiles'

  beforeAll(async () => {
    // Create tables
    await createTable(filesTable)
    await createTable(userFilesTable)

    // Seed test data
    await seedTable(filesTable, [
      {
        fileId: 'file-1',
        fileName: 'video1.mp4',
        status: 'Downloaded',
        url: 's3://bucket/video1.mp4'
      },
      {
        fileId: 'file-2',
        fileName: 'video2.mp4',
        status: 'Processing'
      }
    ])

    await seedTable(userFilesTable, [
      {
        userId,
        fileId: 'file-1'
      },
      {
        userId,
        fileId: 'file-2'
      }
    ])
  })

  afterAll(async () => {
    await deleteTable(filesTable)
    await deleteTable(userFilesTable)
  })

  test('should list downloaded files for user', async () => {
    // Import handler with LocalStack environment
    const {handler} = await import('../../src/lambdas/ListFiles/src')

    const event = {
      requestContext: {
        authorizer: {
          principalId: userId
        }
      }
    }

    const result = await handler(event, {} as Context)
    const body = JSON.parse(result.body)

    expect(result.statusCode).toBe(200)
    expect(body.contents).toHaveLength(1)
    expect(body.contents[0].fileName).toBe('video1.mp4')
    expect(body.contents[0].status).toBe('Downloaded')
  })
})
```

## Test Data Management

### Consistent Test Data

Define reusable test data:

```typescript
// test/integration/helpers/test-data.ts

export const TEST_USER = {
  userId: 'test-user-123',
  email: 'test@example.com',
  status: 'active'
}

export const TEST_FILES = [
  {
    fileId: 'file-001',
    fileName: 'test-video-1.mp4',
    status: 'Downloaded',
    url: 's3://test-bucket/test-video-1.mp4'
  },
  {
    fileId: 'file-002',
    fileName: 'test-video-2.mp4',
    status: 'Processing'
  }
]

export const TEST_DEVICES = [
  {
    deviceId: 'device-001',
    deviceToken: 'token-123',
    platform: 'ios'
  }
]
```

### Data Cleanup

Always clean up test data:

```typescript
async function cleanupTestData(tableName: string, userId: string) {
  const items = await query({
    TableName: tableName,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: {':pk': `USER#${userId}`}
  })

  for (const item of items.Items) {
    await deleteItem({
      TableName: tableName,
      Key: {
        pk: item.pk,
        sk: item.sk
      }
    })
  }
}
```

## CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      localstack:
        image: localstack/localstack:latest
        ports:
          - 4566:4566
        env:
          SERVICES: dynamodb,s3,lambda,sqs,sns
          DEBUG: 0

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Install dependencies
        run: npm ci

      - name: Wait for LocalStack
        run: |
          timeout 60 bash -c 'until curl -s http://localhost:4566/_localstack/health | grep "\"dynamodb\": \"available\""; do sleep 2; done'

      - name: Run integration tests
        run: npm run test:integration
        env:
          USE_LOCALSTACK: true
          LOCALSTACK_ENDPOINT: http://localhost:4566
```

## Best Practices

### DO

- ✅ Clean up all test resources in `afterAll`
- ✅ Use unique names for test resources to avoid conflicts
- ✅ Test both success and error scenarios
- ✅ Verify side effects (e.g., items created in DynamoDB)
- ✅ Use helper functions to reduce duplication
- ✅ Set reasonable timeouts for async operations
- ✅ Test with realistic data structures

### DON'T

- ❌ Mock AWS SDK in integration tests
- ❌ Depend on test execution order
- ❌ Leave test data in LocalStack
- ❌ Use production AWS credentials
- ❌ Test against real AWS services
- ❌ Hard-code LocalStack endpoint URLs

## Debugging LocalStack Tests

### View LocalStack Logs

```bash
# During test run
npm run localstack:logs

# Check service health
npm run localstack:health
```

### Common Issues

1. **Connection Refused**: LocalStack not running
   ```bash
   npm run localstack:start
   ```

2. **Service Not Available**: Service not enabled
   ```yaml
   # docker-compose.localstack.yml
   SERVICES: dynamodb,s3,lambda,sqs,sns  # Add required services
   ```

3. **Timeout Errors**: Increase test timeout
   ```typescript
   test('long running test', async () => {
     // test code
   }, 30000)  // 30 second timeout
   ```

## Example Integration Test

Complete example showing all patterns:

```typescript
import {describe, test, expect, beforeAll, afterAll} from '@jest/globals'
import {Context} from 'aws-lambda'
import {
  createTable,
  deleteTable,
  seedTable,
  scanTable
} from '../helpers/dynamodb-helpers'
import {
  createBucket,
  deleteBucket,
  uploadFile,
  getFileContent
} from '../helpers/s3-helpers'
import {TEST_USER, TEST_FILES} from '../helpers/test-data'

describe('FileProcessor Integration', () => {
  const tableName = 'FilesTable'
  const bucketName = 'files-bucket'

  beforeAll(async () => {
    // Setup test infrastructure
    await Promise.all([
      createTable(tableName),
      createBucket(bucketName)
    ])

    // Seed test data
    await seedTable(tableName, TEST_FILES)

    // Upload test file
    await uploadFile(bucketName, 'test.txt', 'test content')
  })

  afterAll(async () => {
    // Cleanup in reverse order
    await deleteAllFiles(bucketName)
    await Promise.all([
      deleteTable(tableName),
      deleteBucket(bucketName)
    ])
  })

  test('should process file and update database', async () => {
    // Arrange
    const event = {
      fileId: TEST_FILES[0].fileId,
      bucketName,
      key: 'test.txt'
    }

    // Act
    const {handler} = await import('../../src/lambdas/FileProcessor/src')
    const result = await handler(event, {} as Context)

    // Assert
    expect(result.statusCode).toBe(200)

    // Verify database update
    const items = await scanTable(tableName)
    const processedFile = items.find(i => i.fileId === event.fileId)
    expect(processedFile.status).toBe('Processed')

    // Verify S3 file exists
    const content = await getFileContent(bucketName, 'processed/test.txt')
    expect(content).toBeDefined()
  })

  test('should handle missing file gracefully', async () => {
    const event = {
      fileId: 'non-existent',
      bucketName,
      key: 'missing.txt'
    }

    const {handler} = await import('../../src/lambdas/FileProcessor/src')
    const result = await handler(event, {} as Context)

    expect(result.statusCode).toBe(404)
    const body = JSON.parse(result.body)
    expect(body.error).toContain('File not found')
  })
})
```