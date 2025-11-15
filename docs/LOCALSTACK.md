# LocalStack Integration Guide

## Overview

This project uses [LocalStack](https://localstack.cloud/) for local AWS service emulation, enabling fast, offline integration testing without incurring AWS costs or requiring internet connectivity.

## What is LocalStack?

LocalStack is a fully functional local AWS cloud stack that emulates AWS services on your local machine. It allows developers to:
- Test AWS integrations locally without internet
- Run integration tests in CI/CD without AWS credentials
- Develop offline
- Avoid AWS service costs during development
- Get instant feedback (no network latency)

**Website**: https://localstack.cloud/
**GitHub**: https://github.com/localstack/localstack

## Supported Services

The following AWS services are emulated by LocalStack for this project:

| AWS Service | Usage | LocalStack Support |
|-------------|-------|-------------------|
| **Lambda** | Business logic | ✅ Full |
| **S3** | Media file storage | ✅ Full |
| **DynamoDB** | Metadata storage | ✅ Full |
| **API Gateway** | REST endpoints | ✅ Full |
| **SNS** | Push notifications | ✅ Full |
| **SQS** | Message queues | ✅ Full |
| **CloudWatch** | Logs and metrics | ✅ Partial |

## Prerequisites

- Docker and Docker Compose
- Node.js (version specified in `.nvmrc`)
- npm

## Installation

### 1. Install Docker

If you don't have Docker installed:

```bash
# macOS
brew install --cask docker

# Or download from https://www.docker.com/products/docker-desktop
```

### 2. Verify Installation

```bash
docker --version
docker-compose --version
```

## Quick Start

### Running Integration Tests

The simplest way to run integration tests is with the provided npm script:

```bash
# This will start LocalStack, setup resources, run tests, and cleanup
npm run test:integration
```

### Manual LocalStack Management

For more control, you can manage LocalStack manually:

```bash
# Start LocalStack
npm run localstack:start

# Setup AWS resources (S3 buckets, DynamoDB tables, etc.)
npm run localstack:setup

# Run integration tests
npm run test:integration:run

# View LocalStack logs
npm run localstack:logs

# Stop LocalStack
npm run localstack:stop
```

## LocalStack Configuration

### Docker Compose Configuration

The LocalStack configuration is defined in `docker-compose.localstack.yml`:

```yaml
services:
  localstack:
    image: localstack/localstack:latest
    ports:
      - "4566:4566"      # LocalStack gateway
    environment:
      - SERVICES=s3,dynamodb,lambda,apigateway,sns,sqs,events,cloudwatch
      - DEBUG=1
      - DATA_DIR=/tmp/localstack/data
      - LAMBDA_EXECUTOR=docker-reuse
    volumes:
      - "./localstack-data:/tmp/localstack/data"
```

### Environment Variables

Set `USE_LOCALSTACK=true` to enable LocalStack mode:

```bash
export USE_LOCALSTACK=true
```

## Writing Integration Tests

### Test File Naming Convention

Integration test files should be named with the `.integration.test.ts` suffix:

```
src/lib/vendor/AWS/S3.integration.test.ts
src/lib/vendor/AWS/DynamoDB.integration.test.ts
src/lambdas/StartFileUpload/test/index.integration.test.ts
```

### Example Integration Test

```typescript
import {describe, expect, test, beforeAll} from '@jest/globals'
import {PutObjectCommand, GetObjectCommand} from '@aws-sdk/client-s3'
import {createLocalS3Client} from '../../../util/localstack-helpers.js'

describe('S3 Operations (LocalStack Integration)', () => {
  let s3Client: ReturnType<typeof createLocalS3Client>
  const testBucket = 'lifegames-media-downloader-files'

  beforeAll(() => {
    s3Client = createLocalS3Client()
  })

  test('should upload and retrieve a file from S3', async () => {
    const testKey = 'test-file.txt'
    const testContent = 'Hello from LocalStack!'

    // Upload file
    await s3Client.send(
      new PutObjectCommand({
        Bucket: testBucket,
        Key: testKey,
        Body: testContent
      })
    )

    // Retrieve file
    const getResult = await s3Client.send(
      new GetObjectCommand({
        Bucket: testBucket,
        Key: testKey
      })
    )

    const body = await getResult.Body?.transformToString()
    expect(body).toBe(testContent)
  })
})
```

### Using LocalStack Helper Utilities

The `src/util/localstack-helpers.ts` module provides helper functions for creating AWS clients:

```typescript
import {
  createLocalS3Client,
  createLocalDynamoDBClient,
  createLocalSNSClient,
  createLocalSQSClient,
  isLocalStackMode
} from '../util/localstack-helpers.js'

// Create clients configured for LocalStack
const s3 = createLocalS3Client()
const dynamodb = createLocalDynamoDBClient()
const sns = createLocalSNSClient()
const sqs = createLocalSQSClient()

// Check if running in LocalStack mode
if (isLocalStackMode()) {
  console.log('Using LocalStack for AWS services')
}
```

## CI/CD Integration

Integration tests run automatically in GitHub Actions via the `.github/workflows/integration-tests.yml` workflow.

The workflow:
1. Starts LocalStack as a service container
2. Waits for LocalStack to be ready
3. Sets up AWS resources
4. Runs integration tests
5. Uploads test results

## Troubleshooting

### LocalStack won't start

```bash
# Check if Docker is running
docker ps

# Check LocalStack logs
npm run localstack:logs

# Restart LocalStack
npm run localstack:stop
npm run localstack:start
```

### Tests fail with connection errors

```bash
# Verify LocalStack is running
curl http://localhost:4566/_localstack/health

# Check if resources are created
docker exec -it $(docker ps -qf "ancestor=localstack/localstack:latest") \
  awslocal s3 ls
```

### Port 4566 already in use

```bash
# Find process using port 4566
lsof -i :4566

# Kill the process or stop existing LocalStack
npm run localstack:stop
```

### Integration tests timeout

Increase the test timeout in `config/jest.integration.config.mjs`:

```javascript
testTimeout: 60000  // 60 seconds
```

## Known Limitations

### LocalStack vs Real AWS

| Feature | LocalStack | Real AWS | Impact |
|---------|-----------|----------|--------|
| **S3 Consistency** | Immediate | Eventually consistent | Low |
| **Lambda Cold Starts** | Minimal | Significant | Low |
| **CloudFront** | Not supported | Full CDN | Medium |
| **IAM** | Basic only | Full enforcement | Medium |

**Mitigation**: Always run final validation in real AWS before production deployment.

## Benefits

### Time Savings

**Before LocalStack:**
- Deploy to AWS: ~5-10 minutes per iteration
- Manual testing required
- Slow feedback loop

**With LocalStack:**
- Run tests locally: ~10 seconds
- Automated testing
- Fast feedback loop

### Cost Savings

- **Without LocalStack**: ~$21/year in AWS testing costs
- **With LocalStack**: $0/year
- **ROI**: 100% cost savings + 30-60x faster feedback

### Developer Experience

| Aspect | Without LocalStack | With LocalStack |
|--------|-------------------|-----------------|
| Feedback loop | 5-10 minutes | 10 seconds |
| Offline work | ❌ Impossible | ✅ Possible |
| Test isolation | ⚠️ Shared state | ✅ Clean slate |
| AWS costs | ~$21/year | $0 |

## Additional Resources

- [LocalStack Documentation](https://docs.localstack.cloud/)
- [LocalStack AWS CLI](https://docs.localstack.cloud/user-guide/integrations/aws-cli/)
- [LocalStack GitHub](https://github.com/localstack/localstack)

## Support

For issues related to:
- **LocalStack setup**: Check the [LocalStack documentation](https://docs.localstack.cloud/)
- **Integration tests**: Review existing test files in `src/lib/vendor/AWS/*.integration.test.ts`
- **Project-specific questions**: Create an issue in this repository
