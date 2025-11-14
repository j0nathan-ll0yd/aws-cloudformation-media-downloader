# LocalStack Integration Strategy

## Executive Summary

This document outlines a strategy for integrating LocalStack into our development workflow to enable fast, offline testing of AWS services without incurring costs or requiring internet connectivity.

**Status**: Planning - To be implemented after Phase 3 (yt-dlp streaming) is complete
**Estimated Effort**: 2-3 days
**Priority**: Medium (Quality of Life improvement)
**ROI**: High (faster test cycles, zero AWS costs for integration tests)

---

## What is LocalStack?

LocalStack is a fully functional local AWS cloud stack that emulates AWS services on your local machine. It allows developers to:
- Test AWS integrations locally without internet
- Run integration tests in CI/CD without AWS credentials
- Develop offline
- Avoid AWS service costs during development
- Get instant feedback (no network latency)

**Website**: https://localstack.cloud/
**GitHub**: https://github.com/localstack/localstack

---

## Current Testing Challenges

### Our Current Approach
```
Unit Tests (Mocked AWS)
   ↓
   Manual Testing in AWS
   ↓
   Discover Integration Issues
   ↓
   Fix & Redeploy (5-10 min cycle)
```

**Problems:**
- ❌ **Slow feedback loop**: Every test requires AWS deployment (~5-10 min)
- ❌ **AWS costs**: Every test invocation costs money (Lambda, S3, DynamoDB)
- ❌ **No offline development**: Requires internet + AWS credentials
- ❌ **Hard to test failure scenarios**: S3 errors, DynamoDB throttling, etc.
- ❌ **Shared state**: Tests can interfere with each other in shared AWS account
- ❌ **CI/CD bottleneck**: GitHub Actions needs AWS credentials, rate limits apply

### Our Ideal Approach (with LocalStack)
```
Unit Tests (Mocked AWS)
   ↓
   Integration Tests (LocalStack)  ← NEW!
   ↓
   Deploy to AWS (confident it works)
```

**Benefits:**
- ✅ **Fast feedback**: Integration tests run in seconds locally
- ✅ **Zero costs**: No AWS charges for development/testing
- ✅ **Offline development**: Work on planes, trains, coffee shops
- ✅ **Easy failure testing**: Simulate S3 errors, network issues, etc.
- ✅ **Clean state**: Every test gets fresh resources
- ✅ **CI/CD friendly**: No AWS credentials needed in pipeline

---

## LocalStack Service Coverage for Our Project

### Services We Use (All Supported by LocalStack)

| AWS Service | Our Usage | LocalStack Support | Testing Value |
|-------------|-----------|-------------------|---------------|
| **Lambda** | All business logic | ✅ Full | High - test handlers locally |
| **S3** | Media file storage | ✅ Full | **Critical** - test uploads/downloads |
| **DynamoDB** | Metadata storage | ✅ Full | **Critical** - test queries/updates |
| **API Gateway** | REST endpoints | ✅ Full | High - test request routing |
| **Step Functions** | Multipart workflow | ✅ Full | Medium - workflow testing |
| **SNS** | Push notifications | ✅ Full | Medium - test APNS triggers |
| **SQS** | SendPushNotification queue | ✅ Full | Medium - test queue processing |
| **CloudWatch Logs** | Logging | ✅ Partial | Low - basic log verification |
| **IAM** | Permissions | ✅ Partial | Low - mostly Terraform concern |

### Services Not Supported (Acceptable)
- **CloudFront** - Not in LocalStack (CDN testing not critical)
- **GitHub API** - External service (can mock separately)
- **APNS** - External service (can mock separately)
- **yt-dlp** - Not AWS (already mocking with child_process)

**Coverage**: ~95% of our AWS integrations can be tested locally!

---

## Implementation Roadmap

### Phase 1: Basic Setup (4-6 hours)

#### 1. Infrastructure Setup (2 hours)

**Install LocalStack:**
```bash
# Using Docker Compose (recommended)
# docker-compose.localstack.yml
version: '3.8'
services:
  localstack:
    image: localstack/localstack:latest
    ports:
      - "4566:4566"      # LocalStack gateway
      - "4510-4559:4510-4559"  # External services (optional)
    environment:
      - SERVICES=s3,dynamodb,lambda,apigateway,sns,sqs,stepfunctions
      - DEBUG=1
      - DATA_DIR=/tmp/localstack/data
      - LAMBDA_EXECUTOR=docker-reuse  # Faster Lambda execution
      - DOCKER_HOST=unix:///var/run/docker.sock
    volumes:
      - "/var/run/docker.sock:/var/run/docker.sock"
      - "./localstack-data:/tmp/localstack/data"
```

**npm Scripts:**
```json
{
  "scripts": {
    "localstack:start": "docker-compose -f docker-compose.localstack.yml up -d",
    "localstack:stop": "docker-compose -f docker-compose.localstack.yml down",
    "localstack:logs": "docker-compose -f docker-compose.localstack.yml logs -f",
    "test:integration": "npm run localstack:start && npm run test:integration:run && npm run localstack:stop",
    "test:integration:run": "jest --testMatch='**/*.integration.test.ts'"
  }
}
```

#### 2. AWS SDK Configuration (1 hour)

**Create test helper for LocalStack clients:**
```typescript
// src/util/localstack-helpers.ts

import { S3Client } from '@aws-sdk/client-s3'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { LambdaClient } from '@aws-sdk/client-lambda'
import { SNSClient } from '@aws-sdk/client-sns'

const LOCALSTACK_ENDPOINT = 'http://localhost:4566'

export const getLocalStackConfig = () => ({
  endpoint: LOCALSTACK_ENDPOINT,
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test'
  }
})

export const createLocalS3Client = () => new S3Client(getLocalStackConfig())
export const createLocalDynamoClient = () => new DynamoDBClient(getLocalStackConfig())
export const createLocalLambdaClient = () => new LambdaClient(getLocalStackConfig())
export const createLocalSNSClient = () => new SNSClient(getLocalStackConfig())

// Helper to detect if we're in LocalStack mode
export const isLocalStackMode = () => process.env.USE_LOCALSTACK === 'true'
```

**Environment-aware client factory:**
```typescript
// src/util/aws-clients.ts

import { isLocalStackMode, createLocalS3Client } from './localstack-helpers'
import { S3Client } from '@aws-sdk/client-s3'

export const getS3Client = (): S3Client => {
  if (isLocalStackMode()) {
    return createLocalS3Client()
  }
  return new S3Client({ region: process.env.AWS_REGION || 'us-west-2' })
}

// Similar for other services...
```

#### 3. Test Infrastructure Setup (2 hours)

**Setup script for LocalStack resources:**
```typescript
// test/localstack-setup.ts

import { CreateBucketCommand } from '@aws-sdk/client-s3'
import { CreateTableCommand } from '@aws-sdk/client-dynamodb'
import { createLocalS3Client, createLocalDynamoClient } from '../src/util/localstack-helpers'

export async function setupLocalStackResources() {
  const s3 = createLocalS3Client()
  const dynamo = createLocalDynamoClient()

  // Create S3 bucket
  await s3.send(new CreateBucketCommand({
    Bucket: 'lifegames-media-downloader-files'
  }))

  // Create DynamoDB tables
  await dynamo.send(new CreateTableCommand({
    TableName: 'Files',
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
    BillingMode: 'PAY_PER_REQUEST'
  }))

  // Repeat for Users, UserFiles, Devices tables...
}

export async function teardownLocalStackResources() {
  // Clean up all resources (optional - LocalStack resets on restart)
}
```

**Jest setup:**
```typescript
// jest.integration.config.js

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.integration.test.ts'],
  globalSetup: './test/localstack-global-setup.ts',
  globalTeardown: './test/localstack-global-teardown.ts',
  setupFilesAfterEnv: ['./test/localstack-jest-setup.ts'],
  testTimeout: 30000  // LocalStack can be slower than unit tests
}
```

#### 4. First Integration Test (1 hour)

**Example: S3 Upload Test**
```typescript
// src/lib/vendor/YouTube.integration.test.ts

import { streamVideoToS3 } from './YouTube'
import { createLocalS3Client } from '../../util/localstack-helpers'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { createReadStream } from 'fs'
import { spawn } from 'child_process'

describe('streamVideoToS3 (LocalStack Integration)', () => {
  let s3Client: S3Client

  beforeAll(() => {
    process.env.USE_LOCALSTACK = 'true'
    s3Client = createLocalS3Client()
  })

  it('should stream video file to LocalStack S3', async () => {
    const testVideoPath = '__fixtures__/test-video-5mb.mp4'

    // Mock yt-dlp to stream real file
    const mockYtdlpProcess = {
      stdout: createReadStream(testVideoPath),
      stderr: new PassThrough(),
      on: jest.fn()
    }
    jest.spyOn(childProcess, 'spawn').mockReturnValue(mockYtdlpProcess)

    // Stream to LocalStack S3
    const result = await streamVideoToS3(
      'mock-url',
      s3Client,
      'lifegames-media-downloader-files',
      'test-video.mp4'
    )

    // Verify file exists in LocalStack
    const { Body, ContentLength } = await s3Client.send(
      new GetObjectCommand({
        Bucket: 'lifegames-media-downloader-files',
        Key: 'test-video.mp4'
      })
    )

    expect(ContentLength).toBe(result.fileSize)

    // Verify file content integrity
    const downloadedBuffer = await streamToBuffer(Body)
    const originalBuffer = await fs.promises.readFile(testVideoPath)
    expect(downloadedBuffer.equals(originalBuffer)).toBe(true)
  })

  it('should handle S3 upload errors', async () => {
    // Simulate S3 error by using invalid bucket
    await expect(
      streamVideoToS3('url', s3Client, 'non-existent-bucket', 'key')
    ).rejects.toThrow()
  })
})
```

### Phase 2: Lambda Testing (4-6 hours)

**Challenge**: Testing Lambda functions locally requires deploying them to LocalStack

**Approach A: Direct Handler Testing (Recommended)**
```typescript
// src/lambdas/StartFileUpload/test/index.integration.test.ts

import { handler } from '../src/index'
import { createLocalS3Client, createLocalDynamoClient } from '../../../util/localstack-helpers'

describe('StartFileUpload Lambda (LocalStack Integration)', () => {
  beforeAll(() => {
    process.env.USE_LOCALSTACK = 'true'
    process.env.S3_BUCKET = 'lifegames-media-downloader-files'
  })

  it('should download video and upload to S3', async () => {
    // Mock yt-dlp
    jest.spyOn(YouTube, 'streamVideoToS3').mockResolvedValue({
      fileSize: 10485760,
      s3Url: 's3://bucket/video.mp4',
      duration: 180
    })

    // Execute handler directly
    const result = await handler({ fileId: 'dQw4w9WgXcQ' })

    // Verify DynamoDB was updated (in LocalStack)
    const dynamoClient = createLocalDynamoClient()
    const { Item } = await dynamoClient.send(
      new GetItemCommand({
        TableName: 'Files',
        Key: { id: { S: 'dQw4w9WgXcQ' } }
      })
    )

    expect(Item.status.S).toBe('completed')
    expect(Item.size.N).toBe('10485760')
  })
})
```

**Approach B: Full Lambda Deployment (Advanced)**
```bash
# Deploy Lambda to LocalStack
awslocal lambda create-function \
  --function-name StartFileUpload \
  --runtime nodejs22.x \
  --handler index.handler \
  --zip-file fileb://dist/StartFileUpload.zip \
  --role arn:aws:iam::000000000000:role/lambda-role

# Invoke via LocalStack
awslocal lambda invoke \
  --function-name StartFileUpload \
  --payload '{"fileId": "test123"}' \
  response.json
```

### Phase 3: CI/CD Integration (2-3 hours)

**GitHub Actions Workflow:**
```yaml
# .github/workflows/integration-tests.yml

name: Integration Tests (LocalStack)

on: [push, pull_request]

jobs:
  integration-tests:
    runs-on: ubuntu-latest

    services:
      localstack:
        image: localstack/localstack:latest
        ports:
          - 4566:4566
        env:
          SERVICES: s3,dynamodb,lambda,sns,sqs
          DEBUG: 1
        options: >-
          --health-cmd "awslocal s3 ls"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '22'

      - name: Install dependencies
        run: npm ci

      - name: Setup LocalStack resources
        run: npm run localstack:setup

      - name: Run integration tests
        run: npm run test:integration
        env:
          USE_LOCALSTACK: true

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

### Phase 4: Advanced Features (Optional)

**1. State Persistence**
```yaml
# docker-compose.localstack.yml
volumes:
  - "./localstack-data:/tmp/localstack/data"  # Persist between runs
```

**2. Failure Injection**
```typescript
// Test S3 throttling
await configureLocalStackFailure('s3', 'PutObject', 'Throttling')
await expect(uploadToS3()).rejects.toThrow('Throttling')
```

**3. Network Simulation**
```typescript
// Test slow S3 uploads
await configureLocalStackLatency('s3', 5000)  // 5 second delay
```

**4. LocalStack Pro Features** (Paid)
- IAM policy enforcement
- Lambda layers support
- CloudFront emulation
- Advanced monitoring

---

## Benefits Analysis

### Time Savings

**Before LocalStack:**
```
Write code (30 min)
  → Deploy to AWS (5 min)
  → Test manually (2 min)
  → Find bug
  → Fix code (10 min)
  → Deploy again (5 min)
  → Test again (2 min)
  → SUCCESS
Total: 54 minutes per feature
```

**With LocalStack:**
```
Write code (30 min)
  → Run integration tests locally (10 seconds)
  → Find bug
  → Fix code (10 min)
  → Run tests again (10 seconds)
  → SUCCESS
  → Deploy to AWS once (5 min) - confident it works
Total: 45 minutes per feature
```

**Savings**: ~15-20% faster development cycle

### Cost Savings

**Current AWS Testing Costs (estimated):**
- Lambda invocations: 100 tests/day × $0.0000002 = $0.02/day
- S3 requests: 100 tests/day × $0.0004/1000 = $0.04/day
- DynamoDB: 100 tests/day × $0.00025 = $0.025/day
- **Total**: ~$0.085/day × 250 work days = **~$21/year**

**With LocalStack:**
- **Total**: $0/year (100% savings)

While the cost savings are modest, the **time savings** and **developer experience** improvements are substantial.

### Developer Experience

| Aspect | Without LocalStack | With LocalStack | Improvement |
|--------|-------------------|-----------------|-------------|
| Feedback loop | 5-10 minutes | 10 seconds | **30-60x faster** |
| Offline work | ❌ Impossible | ✅ Possible | **Game changer** |
| Test isolation | ⚠️ Shared state | ✅ Clean slate | **Safer** |
| CI/CD speed | ~5 min (deploy + test) | ~30 sec (test only) | **10x faster** |
| AWS costs | ~$21/year | $0 | **100% savings** |
| Credential management | Complex | None needed | **Simpler** |

---

## Testing Coverage Expansion

With LocalStack, we can add integration tests for:

### 1. S3 Operations
- ✅ Streaming upload with large files
- ✅ Multipart upload edge cases
- ✅ S3 error handling (throttling, permissions)
- ✅ File integrity verification
- ✅ Concurrent uploads

### 2. DynamoDB Operations
- ✅ Complex queries with indexes
- ✅ Conditional updates
- ✅ Transaction testing
- ✅ Throttling scenarios
- ✅ Eventual consistency edge cases

### 3. Lambda Orchestration
- ✅ Lambda-to-Lambda invocation
- ✅ Asynchronous invocation
- ✅ Error handling and retries
- ✅ Timeout scenarios

### 4. Step Functions (if we keep them)
- ✅ Workflow execution
- ✅ Error states and retries
- ✅ Parallel execution
- ✅ Choice states

### 5. SNS/SQS
- ✅ Push notification triggers
- ✅ Queue processing
- ✅ Dead letter queues
- ✅ Message ordering

---

## Migration Path

### Incremental Approach (Recommended)

**Week 1: Setup**
- Day 1-2: Install LocalStack, configure Docker Compose
- Day 3: Create first S3 integration test
- Day 4: Validate test works, document learnings

**Week 2: Expand**
- Day 1: Add DynamoDB integration tests
- Day 2: Add Lambda handler tests
- Day 3: Add SNS/SQS tests

**Week 3: CI/CD**
- Day 1: Integrate with GitHub Actions
- Day 2: Add to PR validation workflow
- Day 3: Monitor and optimize

**Week 4+: Maintenance**
- Keep LocalStack version updated
- Add tests for new features
- Refine test helpers

### Success Criteria

- ✅ All AWS service integrations have LocalStack tests
- ✅ CI/CD runs integration tests on every PR
- ✅ Developers can run full test suite offline
- ✅ Test feedback loop < 1 minute
- ✅ Zero AWS costs for development testing

---

## Known Limitations

### LocalStack vs Real AWS

| Feature | LocalStack | Real AWS | Impact |
|---------|-----------|----------|--------|
| **S3 Consistency** | Immediate | Eventually consistent | Low - tests may pass in LocalStack but fail in AWS |
| **Lambda Cold Starts** | Minimal | Significant | Low - can't test cold start performance |
| **CloudFront** | Not supported | Full CDN | Medium - can't test CDN edge cases |
| **IAM** | Basic only | Full enforcement | Medium - may miss permission issues |
| **Regional Differences** | Single region | Multi-region | Low - we only use us-west-2 |
| **AWS Limits** | Not enforced | Strict | Low - can't test quota issues |

**Mitigation**: Always run final validation in real AWS before production deployment

### Performance Differences

LocalStack is generally **faster** than real AWS (no network latency), but:
- Lambda execution might be slower (Docker overhead)
- Some operations might have different timing characteristics
- Can't test real-world network conditions

**Mitigation**: Use LocalStack for functional correctness, use AWS for performance validation

---

## Cost Analysis

### LocalStack Versions

| Feature | Community (Free) | Pro ($25-50/mo) | Enterprise |
|---------|-----------------|-----------------|------------|
| Core services | ✅ Full | ✅ Full | ✅ Full |
| IAM enforcement | ❌ Basic | ✅ Full | ✅ Full |
| Lambda layers | ❌ | ✅ | ✅ |
| Cloud pods (state snapshots) | ❌ | ✅ | ✅ |
| Chaos engineering | ❌ | ✅ | ✅ |
| Team features | ❌ | ❌ | ✅ |

**Recommendation for our project**: Start with **Community Edition** (free)
- We get 95% of what we need
- Can upgrade to Pro later if needed (~$300-600/year)
- ROI is positive even with Pro ($300 cost vs >$1000 in time savings)

---

## Alternatives Considered

### 1. AWS SAM Local
**Pros**: Official AWS tool, good Lambda support
**Cons**: Limited to Lambda + API Gateway, no S3/DynamoDB/SNS
**Decision**: ❌ Too limited for our use case

### 2. Moto (Python library)
**Pros**: Lightweight, Python-native
**Cons**: Python-only, less complete than LocalStack
**Decision**: ❌ We use TypeScript/Node.js

### 3. Serverless Offline
**Pros**: Good for Serverless Framework projects
**Cons**: Limited service coverage, Serverless Framework specific
**Decision**: ❌ We use Terraform, not Serverless Framework

### 4. LocalStack
**Pros**: Comprehensive service coverage, Docker-based, language-agnostic
**Cons**: Some complexity in setup, Pro features cost money
**Decision**: ✅ **Best fit for our needs**

---

## Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **LocalStack behavior differs from AWS** | Medium | High | Always validate critical paths in real AWS |
| **Maintenance overhead** | Low | Medium | Keep LocalStack updated, monitor breaking changes |
| **Team learning curve** | Low | Low | Good documentation, gradual rollout |
| **CI/CD performance impact** | Low | Low | Run integration tests in parallel, cache Docker images |
| **LocalStack bugs** | Medium | Medium | Community is active, workarounds usually available |

---

## Recommendation

**Proceed with LocalStack integration after Phase 3 (yt-dlp streaming) is stable.**

**Priority**: Medium - Nice to have, not blocking
**Timeline**: 2-3 days of focused work
**Expected ROI**:
- 15-20% faster development cycles
- 100% cost savings on testing
- Better developer experience (offline work, faster feedback)
- Higher test coverage (can test more scenarios)

**Next Steps**:
1. Complete Phase 3 (yt-dlp streaming)
2. Validate streaming works in production
3. Open GitHub issue for LocalStack integration
4. Implement incrementally (1-2 tests per day)
5. Gradually expand coverage over 2-3 weeks

---

*Document Version: 1.0*
*Last Updated: 2025-11-13*
*Status: Planning - To be implemented post-Phase 3*
