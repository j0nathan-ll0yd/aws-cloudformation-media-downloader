# Integration Tests

This directory contains integration tests that verify AWS service interactions using LocalStack.

## Overview

Integration tests validate that our vendor wrappers (`src/lib/vendor/AWS/*`) work correctly with real AWS SDK clients in a LocalStack environment. Unlike unit tests which mock AWS services, integration tests execute actual AWS operations against LocalStack.

## Running Integration Tests

### Prerequisites

1. **Docker**: Required to run LocalStack container
2. **docker-compose**: Used to manage LocalStack lifecycle
3. **jq**: Optional, for pretty-printing health check results

### Quick Start

```bash
# Start LocalStack
npm run localstack:start

# Wait for LocalStack to be ready
npm run localstack:health

# Run integration tests
npm run test:integration

# View LocalStack logs (if needed)
npm run localstack:logs

# Stop LocalStack when done
npm run localstack:stop
```

### Commands

- `npm run localstack:start` - Start LocalStack container in detached mode
- `npm run localstack:stop` - Stop and remove LocalStack container
- `npm run localstack:logs` - Stream LocalStack logs
- `npm run localstack:health` - Check LocalStack service health
- `npm run test:integration` - Run all integration tests

## Test Organization

Tests are organized by AWS service:

```
test/integration/
├── setup.ts              # Global test setup (health checks, env vars)
├── README.md             # This file
├── s3/                   # S3 integration tests
├── dynamodb/             # DynamoDB integration tests
├── lambda/               # Lambda integration tests
├── sns/                  # SNS integration tests
├── sqs/                  # SQS integration tests
├── cloudwatch/           # CloudWatch integration tests
└── apigateway/           # API Gateway integration tests
```

## Writing Integration Tests

Integration tests should:

1. **Use vendor wrappers**, not AWS SDK directly:
   ```typescript
   // ✅ Correct - uses vendor wrapper
   import {headObject, createS3Upload} from '../../../src/lib/vendor/AWS/S3'

   // ❌ Wrong - violates AWS SDK Encapsulation Policy
   import {S3Client, HeadObjectCommand} from '@aws-sdk/client-s3'
   ```

2. **Test real AWS operations**:
   ```typescript
   test('should upload and retrieve object from S3', async () => {
     const bucket = 'test-bucket'
     const key = 'test-key'
     const content = Buffer.from('test data')

     // Create upload
     const upload = createS3Upload(bucket, key, content)
     await upload.done()

     // Verify upload
     const metadata = await headObject(bucket, key)
     expect(metadata.ContentLength).toBe(content.length)
   })
   ```

3. **Clean up resources** after each test:
   ```typescript
   afterEach(async () => {
     // Delete test objects, tables, etc.
   })
   ```

4. **Follow naming convention**: `*.integration.test.ts`

## Environment Variables

Integration tests automatically set:

- `USE_LOCALSTACK=true` - Triggers vendor wrappers to use LocalStack clients
- `AWS_REGION=us-east-1` - LocalStack default region

These are configured in `test/integration/setup.ts`.

## LocalStack Configuration

LocalStack is configured via `docker-compose.localstack.yml`:

- **Endpoint**: http://localhost:4566
- **Services**: S3, DynamoDB, SNS, SQS, Lambda, CloudWatch, API Gateway
- **Persistence**: Enabled (data persists between container restarts)
- **Debug Mode**: Enabled for troubleshooting

## Troubleshooting

### LocalStack not responding

```bash
# Check if LocalStack is running
docker ps | grep localstack

# View logs for errors
npm run localstack:logs

# Restart LocalStack
npm run localstack:stop
npm run localstack:start
```

### Tests timing out

Integration tests have a 30-second timeout. If tests are timing out:

1. Check LocalStack logs for errors
2. Verify LocalStack health: `npm run localstack:health`
3. Ensure LocalStack has sufficient resources (increase Docker memory if needed)

### Port conflicts

If port 4566 is already in use:

```bash
# Find process using port 4566
lsof -i :4566

# Kill the process or stop conflicting service
```

## CI/CD Integration

GitHub Actions workflow automatically:

1. Starts LocalStack before running tests
2. Runs integration tests with `npm run test:integration`
3. Uploads test results and coverage
4. Stops LocalStack after tests complete

See `.github/workflows/integration-tests.yml` for CI/CD configuration.
