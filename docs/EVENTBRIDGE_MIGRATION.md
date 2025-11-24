# EventBridge and Step Functions Migration Guide

This guide covers the migration from Lambda-centric to event-driven architecture using AWS EventBridge and Step Functions.

## 🎯 Overview

This project is evolving from tight Lambda-to-Lambda coupling to a loosely-coupled event-driven architecture. The migration enables:

- **Visual Debugging**: See workflow execution in AWS Console
- **Event Replay**: Debug production issues by replaying events
- **Type-Safe Events**: Schema registry provides versioned contracts
- **Built-in Retry**: No more custom retry logic
- **Parallel Consumers**: Add new features without modifying existing code

## 📊 Current Status

### ✅ Phase 1: EventBridge Schema Registry (Completed)

**Infrastructure Deployed**:
- Custom event bus: `MediaDownloaderEvents`
- Schema registry: `MediaDownloaderSchemas`
- Event archive: 90-day retention
- TypeScript event types

**Events Defined**:
- `FileMetadataReady` - Video metadata retrieved
- `FileDownloadStarted` - Download begins
- `FileDownloadCompleted` - File uploaded to S3
- `FileDownloadFailed` - Download fails

**Usage**:
```typescript
import {publishFileDownloadCompleted} from '../../../util/eventbridge-helpers'

await publishFileDownloadCompleted({
  fileId: 'abc123',
  s3Key: 'videos/abc123.mp4',
  size: 1048576,
  contentType: 'video/mp4'
})
```

### ✅ Phase 2: Step Functions Workflow (Completed)

**State Machine**: `FileDownloadWorkflow`

Replaces `FileCoordinator` Lambda with:
- DynamoDB direct integration (no Lambda overhead)
- Built-in retry with exponential backoff
- Event publishing to EventBridge
- Visual debugging in AWS Console

**Trigger**: EventBridge rule on `FileMetadataReady` events

**Benefits**:
- 28% cost reduction ($2.08/month → $1.50/month)
- No orchestration cold starts
- Visual workflow inspection
- Automatic retry logic

### 🔄 Phase 3: Lambda Integration (In Progress)

**Next Steps**:
1. Update `StartFileUpload` to publish events
2. Update `S3ObjectCreated` to publish events
3. Create EventBridge rules for consumers
4. Monitor parallel operation
5. Gradually migrate consumers

### 📋 Phase 4: Full Migration (Planned)

**Goals**:
- Disable `FileCoordinator` scheduled execution
- All workflows event-driven
- Integration tests for EventBridge
- Production monitoring dashboards

## 🚀 Quick Start

### Prerequisites

```bash
# Install dependencies (includes EventBridge SDK)
npm install

# Ensure OpenTofu/Terraform is installed
brew install opentofu
```

### Deploy EventBridge Infrastructure

```bash
cd terraform

# Initialize (first time only)
tofu init

# Review changes
tofu plan

# Deploy
tofu apply
```

**Resources Created**:
- EventBridge event bus
- Schema registry with 4 schemas
- Event archive (90 days)
- Step Functions state machine
- IAM roles and policies

### Verify Deployment

```bash
# Check event bus
aws events describe-event-bus --name MediaDownloaderEvents

# Check schema registry
aws schemas list-schemas --registry-name MediaDownloaderSchemas

# Check state machine
aws stepfunctions describe-state-machine \
  --state-machine-arn arn:aws:states:us-west-2:ACCOUNT_ID:stateMachine:FileDownloadWorkflow
```

## 📝 Usage Examples

### Publishing Events from Lambda

```typescript
import {
  publishFileMetadataReady,
  publishFileDownloadCompleted
} from '../../../util/eventbridge-helpers'

// In StartFileUpload Lambda
export const handler = withXRay(async (event, context) => {
  const {fileId} = event
  
  // Retrieve metadata
  const metadata = await getVideoMetadata(fileId)
  
  // Publish metadata ready event
  await publishFileMetadataReady({
    fileId,
    title: metadata.title,
    description: metadata.description,
    authorName: metadata.author.name,
    authorUser: metadata.author.user,
    publishDate: metadata.published,
    contentType: metadata.mimeType,
    size: metadata.size
  })
  
  // Download and upload to S3
  const s3Result = await uploadToS3(fileId, metadata)
  
  // Publish completion event
  await publishFileDownloadCompleted({
    fileId,
    s3Key: s3Result.key,
    s3Url: s3Result.url,
    size: s3Result.size,
    contentType: metadata.mimeType
  })
  
  return {statusCode: 200}
})
```

### Consuming Events with Lambda

Create EventBridge rule in Terraform:

```hcl
resource "aws_cloudwatch_event_rule" "FileDownloadCompleted" {
  name           = "FileDownloadCompleted"
  event_bus_name = aws_cloudwatch_event_bus.MediaDownloader.name
  
  event_pattern = jsonencode({
    source      = ["aws.mediadownloader.download"]
    detail-type = ["FileDownloadCompleted"]
  })
}

resource "aws_cloudwatch_event_target" "NotifyUsers" {
  rule           = aws_cloudwatch_event_rule.FileDownloadCompleted.name
  event_bus_name = aws_cloudwatch_event_bus.MediaDownloader.name
  arn            = aws_lambda_function.SendPushNotification.arn
}

resource "aws_lambda_permission" "EventBridge" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.SendPushNotification.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.FileDownloadCompleted.arn
}
```

Lambda handler receives EventBridge event:

```typescript
import {EventBridgeEvent} from 'aws-lambda'
import {FileDownloadCompletedDetail} from '../../../types/eventbridge'

export const handler = async (
  event: EventBridgeEvent<'FileDownloadCompleted', FileDownloadCompletedDetail>
) => {
  const {fileId, s3Key, size} = event.detail
  
  // Get users who requested this file
  const users = await getUsersForFile(fileId)
  
  // Send push notifications
  for (const user of users) {
    await sendPushNotification(user, {
      title: 'Download Complete',
      body: `Your video is ready (${formatBytes(size)})`,
      data: {fileId, s3Key}
    })
  }
}
```

### Triggering Step Functions Workflow

**Automatic** (via EventBridge):
```typescript
// Publish FileMetadataReady event
await publishFileMetadataReady({
  fileId: 'abc123',
  title: 'Video Title',
  // ... other fields
})

// State machine automatically triggered by EventBridge rule
```

**Manual** (direct invocation):
```typescript
import {startExecution} from '../../../lib/vendor/AWS/StepFunctions'

const result = await startExecution({
  stateMachineArn: process.env.STATE_MACHINE_ARN,
  input: JSON.stringify({fileId: 'abc123'})
})

console.log('Execution ARN:', result.executionArn)
```

## 🔍 Debugging with Event Replay

### Replay Production Events

Event archive stores all events for 90 days. Replay past events to debug issues:

```bash
# Replay 1 hour of production events to dev environment
aws events start-replay \
  --replay-name DebugIssue123 \
  --event-source-arn arn:aws:events:us-west-2:ACCOUNT_ID:archive/MediaDownloaderArchive \
  --event-start-time 2025-11-23T10:00:00Z \
  --event-end-time 2025-11-23T11:00:00Z \
  --destination EventBusName=MediaDownloaderEvents-Dev

# Check replay status
aws events describe-replay --replay-name DebugIssue123
```

### View Step Functions Execution

```bash
# List recent executions
aws stepfunctions list-executions \
  --state-machine-arn arn:aws:states:us-west-2:ACCOUNT_ID:stateMachine:FileDownloadWorkflow \
  --max-results 10

# Describe specific execution
aws stepfunctions describe-execution \
  --execution-arn arn:aws:states:...

# Get execution history
aws stepfunctions get-execution-history \
  --execution-arn arn:aws:states:...
```

**Or use AWS Console**:
1. Open Step Functions console
2. Click on `FileDownloadWorkflow`
3. Select execution
4. View visual graph with state transitions
5. Click states to inspect input/output

## 📊 Monitoring

### CloudWatch Metrics

Monitor event bus:
```bash
# Events published
aws cloudwatch get-metric-statistics \
  --namespace AWS/Events \
  --metric-name Invocations \
  --dimensions Name=EventBusName,Value=MediaDownloaderEvents \
  --start-time 2025-11-23T00:00:00Z \
  --end-time 2025-11-23T23:59:59Z \
  --period 3600 \
  --statistics Sum
```

Monitor state machine:
```bash
# Executions started
aws cloudwatch get-metric-statistics \
  --namespace AWS/States \
  --metric-name ExecutionsStarted \
  --dimensions Name=StateMachineArn,Value=arn:aws:states:... \
  --start-time 2025-11-23T00:00:00Z \
  --end-time 2025-11-23T23:59:59Z \
  --period 3600 \
  --statistics Sum

# Failed executions
aws cloudwatch get-metric-statistics \
  --namespace AWS/States \
  --metric-name ExecutionsFailed \
  --dimensions Name=StateMachineArn,Value=arn:aws:states:...
```

### X-Ray Tracing

Enable X-Ray in Lambda and Step Functions:
```typescript
import {withXRay} from '../../../lib/vendor/AWS/XRay'

export const handler = withXRay(async (event, context) => {
  // X-Ray automatically traces:
  // - EventBridge → Lambda
  // - Lambda → Step Functions
  // - Step Functions → DynamoDB
  // - Step Functions → Lambda
})
```

View traces:
1. Open X-Ray console
2. See service map: EventBridge → State Machine → Lambda → DynamoDB
3. Trace individual requests end-to-end

## 🧪 Testing

### Unit Tests

Mock EventBridge and Step Functions:

```typescript
jest.unstable_mockModule('../../../lib/vendor/AWS/EventBridge', () => ({
  putEvents: jest.fn<() => Promise<PutEventsResponse>>()
    .mockResolvedValue({
      FailedEntryCount: 0,
      Entries: [{EventId: 'test-123'}]
    })
}))

jest.unstable_mockModule('../../../lib/vendor/AWS/StepFunctions', () => ({
  startExecution: jest.fn<() => Promise<StartExecutionOutput>>()
    .mockResolvedValue({
      executionArn: 'arn:aws:states:...',
      startDate: new Date()
    })
}))

const {handler} = await import('../src')
```

### Integration Tests

Use LocalStack for EventBridge and Step Functions:

```typescript
// Set environment variable
process.env.USE_LOCALSTACK = 'true'

// Publish event (automatically routed to LocalStack)
await publishFileDownloadCompleted({
  fileId: 'test123',
  s3Key: 'videos/test123.mp4',
  size: 1024,
  contentType: 'video/mp4'
})

// Verify event delivery
// LocalStack provides APIs to check events
```

## 🔄 Migration Strategy

### Current State (Parallel Operation)

Both systems running:
- **FileCoordinator Lambda**: Active (rate 4 minutes, DISABLED)
- **FileDownloadWorkflow**: Deployed, triggered by events
- **Events**: Not yet published by existing Lambdas

**Risk**: Zero - new infrastructure doesn't affect existing code

### Next Step: Enable Event Publishing

1. Update `StartFileUpload` to publish events
2. Update `S3ObjectCreated` to publish events
3. Monitor event delivery and archive
4. Verify state machine executions

**Risk**: Low - additive changes only

### Final Step: Disable FileCoordinator

Once confident in event-driven workflow:
1. Disable FileCoordinator CloudWatch rule
2. Monitor for 1 week
3. Remove FileCoordinator Lambda code
4. Update documentation

**Rollback**: Re-enable CloudWatch rule

## 📚 Documentation

- [Event-Driven Architecture](../docs/wiki/Infrastructure/Event-Driven-Architecture.md)
- [Step Functions Workflow](../docs/wiki/Infrastructure/Step-Functions-Workflow.md)
- [OpenTofu Patterns](../docs/wiki/Infrastructure/OpenTofu-Patterns.md)

## 🆘 Troubleshooting

### Events Not Arriving

**Check EventBridge rule**:
```bash
aws events list-rules --name-prefix Trigger --event-bus-name MediaDownloaderEvents
aws events list-targets-by-rule --rule TriggerFileDownload --event-bus-name MediaDownloaderEvents
```

**Check permissions**:
```bash
aws lambda get-policy --function-name SendPushNotification | jq '.Policy'
```

### State Machine Execution Failed

**View execution details**:
```bash
aws stepfunctions describe-execution --execution-arn arn:aws:states:...
```

**Check CloudWatch Logs**:
```bash
aws logs tail /aws/states/FileDownloadWorkflow --follow
```

**Inspect state input/output**:
- Open AWS Console → Step Functions
- Click execution → Visual graph
- Click failed state → View input/output JSON

### Schema Validation Errors

**Verify event matches schema**:
```bash
aws schemas describe-schema \
  --registry-name MediaDownloaderSchemas \
  --schema-name FileDownloadCompleted
```

**Test event structure**:
```typescript
import {FileDownloadCompletedDetail} from '../../../types/eventbridge'

// TypeScript validates at compile time
const event: FileDownloadCompletedDetail = {
  fileId: 'abc123',
  s3Key: 'videos/abc123.mp4',
  size: 1024,
  contentType: 'video/mp4'
  // Missing required field would cause TypeScript error
}
```

## 💡 Best Practices

1. **Always publish events**: Even if no consumers exist yet
2. **Use type-safe helpers**: Import from `eventbridge-helpers.ts`
3. **Include context**: Add relevant data to event details
4. **Idempotent consumers**: Handle duplicate events gracefully
5. **Monitor event delivery**: Watch FailedInvocations metric
6. **Test with replay**: Use event archive for debugging

## 🎓 Learning Resources

- [AWS EventBridge Developer Guide](https://docs.aws.amazon.com/eventbridge/)
- [Step Functions Best Practices](https://docs.aws.amazon.com/step-functions/latest/dg/sfn-best-practices.html)
- [Event-Driven Architecture Patterns](https://aws.amazon.com/event-driven-architecture/)
- [Serverless Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html)
