# Integration Test Plan: Workflow-Based Testing Strategy

## Philosophy

**Integration tests should test YOUR orchestration logic, not AWS SDK behavior.**

Current shallow tests (testing library behavior):
- ❌ "Can I upload to S3?" → Testing AWS SDK
- ❌ "Does multipart upload work?" → Testing AWS SDK
- ❌ "Can I query DynamoDB?" → Testing AWS SDK

Valuable integration tests (testing business logic):
- ✅ "Does the complete download workflow succeed?" → Testing YOUR code
- ✅ "When DynamoDB query returns files, does Lambda fan-out work?" → Testing YOUR orchestration
- ✅ "After S3 upload, is DynamoDB updated with correct status?" → Testing YOUR state management

## Lambda Function Complexity Analysis

### High Complexity (Multi-Service Workflows) - **PRIORITY FOR INTEGRATION TESTING**

#### 1. StartFileUpload ⭐⭐⭐⭐⭐ HIGHEST
**Services Used**: 4 (DynamoDB × 3, S3, CloudWatch, + External: yt-dlp, GitHub)

**Workflow**:
```
1. Fetch video info from YouTube (yt-dlp)
2. Insert pending file record (DynamoDB updateItem)
3. Stream video to S3 (S3 multipart upload)
4. Update file record to "downloaded" (DynamoDB updateItem)
5. Publish CloudWatch metric
6. On error: Update file to "failed" + Create GitHub issue
```

**What Makes This Complex:**
- **State management across services**: DynamoDB status transitions (pending → downloading → downloaded/failed)
- **Streaming orchestration**: yt-dlp stdout → S3 multipart upload coordination
- **Error handling**: Rollback DynamoDB on S3 failure, GitHub issue creation
- **External dependency**: yt-dlp binary execution

**Integration Test Value**: ⭐⭐⭐⭐⭐
- Tests real file upload workflow end-to-end
- Tests DynamoDB state transitions
- Tests error rollback logic
- Tests S3 multipart upload with real streaming

---

#### 2. FileCoordinator ⭐⭐⭐⭐
**Services Used**: 2 (DynamoDB, Lambda)

**Workflow**:
```
1. Scan DynamoDB for files in "pending" state
2. For each file → Invoke StartFileUpload Lambda asynchronously
3. Wait for all invocations to complete
```

**What Makes This Complex:**
- **Fan-out pattern**: One Lambda invoking multiple instances of another Lambda
- **Concurrency**: Parallel Lambda invocations via Promise.all()
- **Query correctness**: DynamoDB scan with filter expressions

**Integration Test Value**: ⭐⭐⭐⭐
- Tests Lambda-to-Lambda orchestration
- Tests concurrent async invocations
- Tests DynamoDB scan filtering (indexes, conditions)

---

#### 3. WebhookFeedly ⭐⭐⭐
**Services Used**: 2 (DynamoDB, SQS)

**Workflow**:
```
1. Receive webhook from Feedly with video URL
2. Query DynamoDB to check if file already exists
3. If new: Insert file record with "pending" status
4. Send SQS message to trigger processing queue
```

**What Makes This Complex:**
- **Idempotency**: Must handle duplicate webhooks gracefully
- **Multi-step transaction**: Query → conditional insert → SQS publish
- **State initialization**: Creates initial file record that FileCoordinator will find

**Integration Test Value**: ⭐⭐⭐⭐
- Tests webhook → database → queue workflow
- Tests duplicate detection logic
- Tests SQS message publishing

---

#### 4. SendPushNotification ⭐⭐⭐
**Services Used**: 2 (DynamoDB, SNS)

**Workflow**:
```
1. Query DynamoDB for user devices subscribed to topic
2. For each device → Publish SNS notification with video metadata
```

**What Makes This Complex:**
- **Query + broadcast pattern**: Query → fan-out to SNS endpoints
- **SNS endpoint management**: Handling invalid/expired device tokens

**Integration Test Value**: ⭐⭐⭐
- Tests DynamoDB query → SNS publish workflow
- Tests handling of SNS delivery failures

---

### Medium Complexity (Single-Service + Logic)

#### 5. ListFiles ⭐⭐
**Services Used**: 2 (DynamoDB, S3)

**Workflow**:
```
1. Query DynamoDB for files with status="downloaded"
2. Generate presigned S3 URLs for each file
3. Return file list with download URLs
```

**Integration Test Value**: ⭐⭐
- Tests DynamoDB query with filters
- Tests S3 presigned URL generation
- Low complexity, but useful for query correctness

---

#### 6. RegisterDevice ⭐⭐
**Services Used**: 2 (DynamoDB, SNS)

**Workflow**:
```
1. Create SNS platform endpoint for device token
2. Store endpoint ARN in DynamoDB
```

**Integration Test Value**: ⭐⭐
- Tests SNS endpoint creation
- Tests DynamoDB item creation

---

### Low Complexity (Single Service or Pure Logic)

#### 7. S3ObjectCreated ⭐
**Services Used**: 2 (DynamoDB, SQS)
**Integration Test Value**: ⭐ - Simple scan + SQS send

#### 8. UserDelete ⭐
**Services Used**: 1 (DynamoDB)
**Integration Test Value**: ⭐ - CRUD operations only

#### 9. ApiGatewayAuthorizer
**Services Used**: 1 (API Gateway)
**Integration Test Value**: N/A - Pure JWT validation logic, no workflow

---

## Recommended Integration Test Suite

### Priority 1: Critical Multi-Service Workflows

#### Test Suite: `startFileUpload.workflow.integration.test.ts`

**Tests:**
1. **Complete Happy Path Workflow**
   ```typescript
   test('should download video and update DynamoDB through complete lifecycle', async () => {
     // Arrange: Mock yt-dlp to return fake video stream
     const mockVideoStream = createMockVideoStream(5 * 1024 * 1024) // 5MB
     mockYtDlp.fetchVideoInfo.mockResolvedValue(mockVideoInfo)
     mockYtDlp.streamVideo.mockReturnValue(mockVideoStream)

     // Act: Invoke StartFileUpload
     await handler({fileId: 'test-video-123'}, mockContext)

     // Assert: Verify complete workflow
     // 1. DynamoDB: File status = "PendingDownload"
     const pendingFile = await getDynamoDBFile('test-video-123')
     expect(pendingFile.status).toBe('PendingDownload')

     // 2. S3: File uploaded successfully
     const s3Object = await headObject(bucket, 'test-video-123.mp4')
     expect(s3Object.ContentLength).toBe(5 * 1024 * 1024)

     // 3. DynamoDB: File status = "Downloaded"
     const completedFile = await getDynamoDBFile('test-video-123')
     expect(completedFile.status).toBe('Downloaded')
     expect(completedFile.size).toBe(5 * 1024 * 1024)
   })
   ```

2. **S3 Upload Failure Rollback**
   ```typescript
   test('should update DynamoDB to failed when S3 upload fails', async () => {
     // Arrange: Force S3 upload to fail
     mockS3UploadFailure()

     // Act: Invoke StartFileUpload
     await handler({fileId: 'fail-video'}, mockContext)

     // Assert: DynamoDB shows failed status
     const failedFile = await getDynamoDBFile('fail-video')
     expect(failedFile.status).toBe('Failed')
   })
   ```

3. **Concurrent Uploads Don't Conflict**
   ```typescript
   test('should handle concurrent uploads of different videos without conflict', async () => {
     // Act: Start 3 concurrent uploads
     await Promise.all([
       handler({fileId: 'video-1'}, mockContext),
       handler({fileId: 'video-2'}, mockContext),
       handler({fileId: 'video-3'}, mockContext)
     ])

     // Assert: All 3 videos in DynamoDB with correct status
     const files = await scanDynamoDBFiles()
     expect(files).toHaveLength(3)
     expect(files.every(f => f.status === 'Downloaded')).toBe(true)
   })
   ```

4. **Large File Multipart Upload**
   ```typescript
   test('should handle large file upload using multipart', async () => {
     // Arrange: Mock 50MB video
     const largeStream = createMockVideoStream(50 * 1024 * 1024)

     // Act: Upload large file
     await handler({fileId: 'large-video'}, mockContext)

     // Assert: S3 object exists with correct size
     const s3Object = await headObject(bucket, 'large-video.mp4')
     expect(s3Object.ContentLength).toBe(50 * 1024 * 1024)
   })
   ```

**Why These Tests Matter:**
- Test YOUR orchestration logic (DynamoDB state management)
- Test YOUR error handling (rollback on failure)
- Test YOUR streaming implementation (yt-dlp → S3)
- NOT testing "does S3 upload work" (that's AWS's problem)

---

#### Test Suite: `fileCoordinator.workflow.integration.test.ts`

**Tests:**
1. **Fan-out Pattern: Multiple Pending Files**
   ```typescript
   test('should invoke StartFileUpload for all pending files', async () => {
     // Arrange: Insert 5 pending files in DynamoDB
     await insertPendingFiles(['video-1', 'video-2', 'video-3', 'video-4', 'video-5'])

     // Spy on Lambda invocations
     const invokeSpy = jest.spyOn(Lambda, 'invoke')

     // Act: Trigger FileCoordinator
     await handler(mockScheduledEvent, mockContext)

     // Assert: Verify all 5 Lambda invocations
     expect(invokeSpy).toHaveBeenCalledTimes(5)
     expect(invokeSpy).toHaveBeenCalledWith('StartFileUpload', {fileId: 'video-1'})
     // ... verify all 5
   })
   ```

2. **Query Filtering: Only Pending Files**
   ```typescript
   test('should only process files with status=pending, not downloaded or failed', async () => {
     // Arrange: Insert files with mixed statuses
     await insertFile({fileId: 'pending-1', status: 'Pending'})
     await insertFile({fileId: 'downloaded-1', status: 'Downloaded'})
     await insertFile({fileId: 'failed-1', status: 'Failed'})
     await insertFile({fileId: 'pending-2', status: 'Pending'})

     // Act: Trigger FileCoordinator
     await handler(mockScheduledEvent, mockContext)

     // Assert: Only 2 invocations (pending files only)
     const invokeSpy = jest.spyOn(Lambda, 'invoke')
     expect(invokeSpy).toHaveBeenCalledTimes(2)
   })
   ```

3. **Empty Queue Handling**
   ```typescript
   test('should complete successfully when no pending files exist', async () => {
     // Arrange: DynamoDB has no pending files

     // Act: Trigger FileCoordinator
     const result = await handler(mockScheduledEvent, mockContext)

     // Assert: Returns success, no invocations
     expect(result.statusCode).toBe(200)
     const invokeSpy = jest.spyOn(Lambda, 'invoke')
     expect(invokeSpy).not.toHaveBeenCalled()
   })
   ```

**Why These Tests Matter:**
- Test YOUR DynamoDB scan filter logic
- Test YOUR Lambda fan-out pattern
- Test YOUR concurrency handling

---

#### Test Suite: `webhookFeedly.workflow.integration.test.ts`

**Tests:**
1. **New Video: Creates Pending File + Sends SQS**
   ```typescript
   test('should create pending file and send SQS message for new video', async () => {
     // Arrange: Feedly webhook payload
     const webhookPayload = {videoUrl: 'https://youtube.com/watch?v=newvideo'}

     // Act: Process webhook
     await handler(webhookPayload, mockContext)

     // Assert: DynamoDB has pending file
     const file = await getDynamoDBFile('newvideo')
     expect(file.status).toBe('Pending')

     // Assert: SQS message sent
     const messages = await getSQSMessages(queueUrl)
     expect(messages).toHaveLength(1)
     expect(messages[0].body).toContain('newvideo')
   })
   ```

2. **Duplicate Video: Idempotent (No Duplicate)**
   ```typescript
   test('should not create duplicate file for repeated webhook', async () => {
     // Arrange: Video already exists
     await insertFile({fileId: 'existing', status: 'Downloaded'})

     // Act: Receive webhook for same video
     await handler({videoUrl: 'https://youtube.com/watch?v=existing'}, mockContext)

     // Assert: No new file created, no SQS message
     const files = await scanDynamoDBFiles()
     expect(files.filter(f => f.fileId === 'existing')).toHaveLength(1)

     const messages = await getSQSMessages(queueUrl)
     expect(messages).toHaveLength(0)
   })
   ```

**Why These Tests Matter:**
- Test YOUR idempotency logic
- Test YOUR multi-step transaction (query → insert → SQS)

---

### Priority 2: Medium Complexity Workflows

#### Test Suite: `listFiles.integration.test.ts`

**Test:**
```typescript
test('should return only downloaded files with valid presigned URLs', async () => {
  // Arrange: Mixed file statuses
  await insertFile({fileId: 'downloaded-1', status: 'Downloaded', key: 'video1.mp4'})
  await insertFile({fileId: 'pending-1', status: 'Pending'})
  await insertFile({fileId: 'downloaded-2', status: 'Downloaded', key: 'video2.mp4'})

  // Act: List files
  const result = await handler({}, mockContext)

  // Assert: Only downloaded files with presigned URLs
  const files = JSON.parse(result.body)
  expect(files).toHaveLength(2)
  expect(files[0].downloadUrl).toMatch(/^https:\/\/.*\.amazonaws\.com\/.*\?X-Amz-/)

  // Verify presigned URL actually works
  const response = await fetch(files[0].downloadUrl, {method: 'HEAD'})
  expect(response.ok).toBe(true)
})
```

---

### Priority 3: Coverage Gaps Only

#### Test Suite: `vendorWrappers.coverage.integration.test.ts`

**Purpose**: Fill coverage gaps for vendor wrappers not exercised by workflow tests

**Tests**:
```typescript
// Only test vendor wrapper functions NOT covered by workflow tests
test('SNS publishSnsEvent error handling', async () => {
  // Test error path for SNS publish that doesn't occur in workflows
})

test('DynamoDB pagination for large result sets', async () => {
  // Test pagination logic if not covered by workflows
})
```

---

## Test Organization Structure

```
test/integration/
├── README.md                                    # This plan
├── setup.ts                                     # LocalStack setup
├── helpers/                                     # Test utilities
│   ├── dynamodb-helpers.ts                      # Insert/query test data
│   ├── s3-helpers.ts                            # S3 test utilities
│   ├── lambda-helpers.ts                        # Lambda invocation helpers
│   ├── sqs-helpers.ts                           # SQS test utilities
│   └── mock-yt-dlp.ts                           # Mock yt-dlp for tests
└── workflows/                                   # ⬅️ NEW: Workflow-based tests
    ├── startFileUpload.workflow.integration.test.ts
    ├── fileCoordinator.workflow.integration.test.ts
    ├── webhookFeedly.workflow.integration.test.ts
    ├── sendPushNotification.workflow.integration.test.ts
    └── listFiles.workflow.integration.test.ts
```

**Delete these (low value):**
```
test/integration/
├── s3/s3.integration.test.ts                    # ❌ DELETE: Tests AWS SDK, not your code
├── dynamodb/dynamodb.integration.test.ts        # ❌ DELETE: Tests AWS SDK
├── sns/sns.integration.test.ts                  # ❌ DELETE: Tests AWS SDK
```

---

## Coverage Analysis

### Before: Shallow Library Tests
- `src/lib/vendor/AWS/S3.ts` → 70% (from shallow S3 tests)
- `src/lambdas/StartFileUpload/src/index.ts` → 0% (mocked in unit tests)
- **Problem**: Testing AWS SDK, not application logic

### After: Workflow Tests
- `src/lib/vendor/AWS/S3.ts` → 95% (from StartFileUpload workflow)
- `src/lib/vendor/AWS/DynamoDB.ts` → 90% (from multiple workflows)
- `src/lambdas/StartFileUpload/src/index.ts` → 85% (from workflow tests)
- `src/util/shared.ts` → 80% (from FileCoordinator workflow)
- **Result**: Testing YOUR orchestration logic, vendor wrappers covered as side effect

---

## Implementation Phases

### Phase 1: Delete Shallow Tests (1 hour)
- Remove `test/integration/{s3,dynamodb,sns}/*.test.ts`
- Keep only `test/integration/setup.ts` and structure

### Phase 2: Create Test Helpers (2 hours)
- `helpers/dynamodb-helpers.ts` - Insert/query test data
- `helpers/mock-yt-dlp.ts` - Mock yt-dlp streams
- `helpers/lambda-helpers.ts` - Invoke Lambda with LocalStack

### Phase 3: Implement Priority 1 Workflows (1 day)
- StartFileUpload workflow tests (4 hours)
- FileCoordinator workflow tests (2 hours)
- WebhookFeedly workflow tests (2 hours)

### Phase 4: Implement Priority 2 Workflows (4 hours)
- ListFiles integration test
- SendPushNotification integration test

### Phase 5: Measure Coverage Improvement (1 hour)
- Run `npm run test:all`
- Compare coverage before/after
- Document coverage improvements in PR

---

## Success Metrics

**Before LocalStack Integration:**
- Vendor wrapper coverage: 0% (mocked in unit tests)
- Workflow coverage: 0% (no integration tests)
- Multi-service orchestration tested: No

**After Workflow-Based Integration Tests:**
- Vendor wrapper coverage: >85% (side effect of workflow tests)
- Workflow coverage: >80% (critical paths tested)
- Multi-service orchestration tested: Yes
- False positive test value: Eliminated (no longer testing AWS SDK)

**Key Metric**: Coverage of YOUR CODE, not library code
