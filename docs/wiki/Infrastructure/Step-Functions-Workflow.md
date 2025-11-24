# Step Functions File Download Workflow

This document describes the Step Functions state machine that orchestrates file downloads, replacing the FileCoordinator Lambda with visual, retryable workflow orchestration.

## Overview

The `FileDownloadWorkflow` state machine provides:

- **Visual Debugging**: See workflow execution in AWS Console graph
- **Built-in Retry**: Exponential backoff without custom code
- **DynamoDB Integration**: Direct queries without Lambda wrapper
- **Event Publishing**: Emit events to EventBridge for consumers
- **Error Handling**: Structured error paths with automatic fallbacks
- **X-Ray Tracing**: Full distributed tracing visibility

## State Machine Flow

```
┌─────────────────────┐
│  CheckFileStatus    │ (DynamoDB GetItem)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│    FileExists?      │ (Choice)
└──────┬──────┬───────┘
       │      │
  No   │      │ Yes
       │      │
       ▼      ▼
┌──────────┐ ┌─────────────────────┐
│  Create  │ │ CheckDownloadStatus │ (Choice)
│  Record  │ └──────┬──────┬───────┘
└────┬─────┘        │      │
     │         Already    Pending
     │         Downloaded Download
     │              │      │
     └──────────────┼──────┘
                    │
                    ▼
           ┌──────────────────┐
           │  StartDownload   │ (Lambda with retry)
           └────────┬─────────┘
                    │
                    ▼
           ┌──────────────────┐
           │ Publish Event    │ (EventBridge)
           └────────┬─────────┘
                    │
                    ▼
           ┌──────────────────┐
           │    Success       │
           └──────────────────┘
```

## States Explained

### 1. CheckFileStatus

**Type**: Task (DynamoDB GetItem)  
**Purpose**: Check if file record exists in DynamoDB

```json
{
  "Type": "Task",
  "Resource": "arn:aws:states:::dynamodb:getItem",
  "Parameters": {
    "TableName": "MediaDownloader",
    "Key": {
      "PK": {"S.$": "States.Format('FILE#{}', $.fileId)"},
      "SK": {"S": "FILE"}
    }
  }
}
```

**Outcome**:
- If file exists → `FileExists` choice
- If error → `HandleError`

### 2. FileExists

**Type**: Choice  
**Purpose**: Branch based on file existence

**Choices**:
- File exists → `CheckDownloadStatus`
- File doesn't exist → `CreateFileRecord`

### 3. CreateFileRecord

**Type**: Task (DynamoDB PutItem)  
**Purpose**: Create initial file record with PendingMetadata status

**Outcome**:
- Success → `StartDownload`
- Error → `HandleError`

### 4. CheckDownloadStatus

**Type**: Choice  
**Purpose**: Branch based on file download status

**Choices**:
- Status = "Downloaded" → `AlreadyDownloaded`
- Otherwise → `CheckAvailability`

### 5. CheckAvailability

**Type**: Choice  
**Purpose**: Check if file is available for download (availableAt <= now)

**Choices**:
- Available → `StartDownload`
- Not yet available → `NotYetAvailable` (Success)

### 6. AlreadyDownloaded

**Type**: Task (EventBridge PutEvents)  
**Purpose**: Publish event indicating file already downloaded

**Event Published**:
```json
{
  "Source": "aws.mediadownloader.workflow",
  "DetailType": "FileAlreadyDownloaded",
  "Detail": {
    "fileId": "abc123"
  }
}
```

**Outcome**: → `AlreadyDownloadedSuccess`

### 7. StartDownload

**Type**: Task (Lambda Invoke)  
**Purpose**: Invoke StartFileUpload Lambda with built-in retry

**Retry Configuration**:
```json
{
  "Retry": [{
    "ErrorEquals": [
      "States.TaskFailed",
      "Lambda.ServiceException",
      "Lambda.TooManyRequestsException"
    ],
    "IntervalSeconds": 2,
    "MaxAttempts": 3,
    "BackoffRate": 2.0
  }]
}
```

**Retry Schedule**:
- Attempt 1: Immediate
- Attempt 2: Wait 2 seconds
- Attempt 3: Wait 4 seconds
- Attempt 4: Wait 8 seconds (final)

**Outcome**:
- Success → `PublishDownloadStarted`
- All retries failed → `DownloadFailed`

### 8. PublishDownloadStarted

**Type**: Task (EventBridge PutEvents)  
**Purpose**: Publish FileDownloadStarted event

**Event Published**:
```json
{
  "Source": "aws.mediadownloader.download",
  "DetailType": "FileDownloadStarted",
  "Detail": {
    "fileId": "abc123",
    "timestamp": 1700000000000
  }
}
```

**Outcome**: → `DownloadSuccess`

### 9. DownloadFailed

**Type**: Task (EventBridge PutEvents)  
**Purpose**: Publish FileDownloadFailed event

**Event Published**:
```json
{
  "Source": "aws.mediadownloader.download",
  "DetailType": "FileDownloadFailed",
  "Detail": {
    "fileId": "abc123",
    "error": "Lambda.ServiceException",
    "timestamp": 1700000000000
  }
}
```

**Outcome**: → `DownloadFailure` (Fail state)

## Triggering the Workflow

### Via EventBridge Rule

The workflow is automatically triggered by EventBridge when a `FileMetadataReady` event is published:

```hcl
resource "aws_cloudwatch_event_rule" "TriggerFileDownload" {
  name           = "TriggerFileDownload"
  event_bus_name = "MediaDownloaderEvents"
  
  event_pattern = jsonencode({
    source      = ["aws.mediadownloader.metadata"]
    detail-type = ["FileMetadataReady"]
  })
}
```

**Input Transformation**:
```json
{
  "fileId": "<fileId from event>"
}
```

### Manual Invocation

Start execution manually via AWS CLI:

```bash
aws stepfunctions start-execution \
  --state-machine-arn arn:aws:states:us-west-2:123456789:stateMachine:FileDownloadWorkflow \
  --input '{"fileId": "abc123"}'
```

### From Lambda

Invoke from Lambda using vendor wrapper:

```typescript
import {startExecution} from '../../../lib/vendor/AWS/StepFunctions'

await startExecution({
  stateMachineArn: process.env.STATE_MACHINE_ARN,
  input: JSON.stringify({fileId: 'abc123'})
})
```

## Benefits Over FileCoordinator Lambda

### Visual Debugging

**Lambda** (FileCoordinator):
- Orchestration logic buried in code
- Debugging requires CloudWatch log analysis
- Difficult to visualize execution flow

**Step Functions**:
- Visual graph in AWS Console
- Click any state to see input/output
- Execution history with timestamps
- Exactly where execution failed

### Built-in Retry

**Lambda**:
```typescript
// Custom retry logic required
let attempts = 0
while (attempts < 3) {
  try {
    await startDownload(fileId)
    break
  } catch (error) {
    attempts++
    if (attempts >= 3) throw error
    await sleep(2 ** attempts * 1000)
  }
}
```

**Step Functions**:
```json
{
  "Retry": [{
    "ErrorEquals": ["States.TaskFailed"],
    "IntervalSeconds": 2,
    "MaxAttempts": 3,
    "BackoffRate": 2.0
  }]
}
```

### DynamoDB Direct Integration

**Lambda**:
```typescript
// Requires Lambda invocation overhead
const file = await Files.get({fileId}).go()
if (file.status === 'Downloaded') {
  return {status: 'already-downloaded'}
}
```

**Step Functions**:
```json
{
  "Type": "Task",
  "Resource": "arn:aws:states:::dynamodb:getItem",
  "Parameters": {
    "TableName": "MediaDownloader",
    "Key": {...}
  }
}
```

No Lambda cold start, no execution cost for status checks.

### Cost Comparison

**FileCoordinator Lambda** (10,000 executions/month):
- Lambda invocations: 10,000 × $0.20 per million = $0.002
- Duration (128MB, 500ms avg): 10,000 × $0.0000002083 = $2.08
- **Total**: ~$2.08/month

**FileDownloadWorkflow State Machine** (10,000 executions/month):
- State transitions (avg 6 per execution): 60,000 × $0.025 per 1,000 = $1.50
- DynamoDB queries: Covered by existing provisioned capacity
- **Total**: ~$1.50/month

**Savings**: $0.58/month (28%)

**But**: Massive operational benefits (visual debugging, retry, tracing) worth far more than $0.58/month.

## Monitoring

### CloudWatch Metrics

Monitor state machine execution:

```bash
# Execution count
aws cloudwatch get-metric-statistics \
  --namespace AWS/States \
  --metric-name ExecutionsStarted \
  --dimensions Name=StateMachineArn,Value=<arn> \
  --start-time 2025-01-01T00:00:00Z \
  --end-time 2025-01-01T23:59:59Z \
  --period 3600 \
  --statistics Sum

# Failed executions
aws cloudwatch get-metric-statistics \
  --namespace AWS/States \
  --metric-name ExecutionsFailed \
  --dimensions Name=StateMachineArn,Value=<arn>
```

### X-Ray Tracing

Step Functions integrates with X-Ray:

1. Enable tracing in state machine configuration
2. View service map showing workflow → Lambda → DynamoDB
3. Trace full request path from EventBridge → State Machine → Lambda

### Execution History

View execution details in AWS Console:

1. Open Step Functions console
2. Select `FileDownloadWorkflow`
3. Click on execution ID
4. See visual graph with state transitions
5. Click any state to view input/output JSON

### CloudWatch Logs

Execution logs in `/aws/states/FileDownloadWorkflow`:

```json
{
  "execution_arn": "arn:aws:states:...",
  "type": "ExecutionStarted",
  "details": {
    "input": "{\"fileId\":\"abc123\"}",
    "roleArn": "arn:aws:iam::..."
  }
}
```

## Error Handling

### Automatic Retries

Transient failures automatically retried:
- Lambda service exceptions
- Lambda throttling
- Network timeouts

### Catch Blocks

Errors caught and routed to failure handlers:
- Publish failure events to EventBridge
- Update DynamoDB status to Failed
- Create GitHub issue for investigation

### Dead Letter Queue

Failed executions can optionally send to SQS DLQ:

```hcl
resource "aws_sqs_queue" "StepFunctionsDLQ" {
  name = "FileDownloadWorkflow-DLQ"
}

# Configure in state machine (not shown in current implementation)
```

## Testing

### Local Testing

Test state machine definition with AWS SAM:

```bash
# Install AWS SAM CLI
brew install aws-sam-cli

# Validate state machine definition
sam validate --template terraform/step_functions.tf

# Local testing (requires SAM template conversion)
sam local start-api
```

### Integration Testing

Use LocalStack for end-to-end testing:

```typescript
// LocalStack supports Step Functions
process.env.USE_LOCALSTACK = 'true'

// Create state machine
await createStateMachine({...})

// Start execution
const execution = await startExecution({
  stateMachineArn: 'arn:aws:states:...',
  input: JSON.stringify({fileId: 'test123'})
})

// Wait for completion
await waitForCompletion(execution.executionArn)

// Assert results
expect(execution.status).toBe('SUCCEEDED')
```

### Debugging Failed Executions

1. **View Execution Graph**: See exactly which state failed
2. **Inspect State Input/Output**: View JSON at failure point
3. **Check CloudWatch Logs**: Full execution trace
4. **Replay with EventBridge**: Replay exact event that caused failure

## Migration Path

### Phase 1: Parallel Operation (Current)

- FileCoordinator Lambda: Active (scheduled every 4 minutes)
- FileDownloadWorkflow: Deployed but triggered only by events
- Both can coexist safely

### Phase 2: Event-Based Trigger

- Update WebhookFeedly to publish FileMetadataReady events
- State machine automatically triggered by events
- FileCoordinator continues as backup (disabled schedule)

### Phase 3: Monitoring Period

- Monitor state machine success rate
- Compare latency to FileCoordinator
- Verify event delivery reliability
- Run for 1-2 weeks

### Phase 4: Full Cutover

- Disable FileCoordinator CloudWatch rule
- Remove FileCoordinator Lambda (keep code for rollback)
- State machine as primary orchestration
- EventBridge as event backbone

### Rollback Plan

If issues arise:

1. Re-enable FileCoordinator CloudWatch rule
2. Disable EventBridge rule for state machine
3. Monitor for stability
4. Debug state machine issues
5. Re-attempt migration when ready

## References

- [AWS Step Functions Developer Guide](https://docs.aws.amazon.com/step-functions/)
- [State Machine Best Practices](https://docs.aws.amazon.com/step-functions/latest/dg/sfn-best-practices.html)
- [DynamoDB Service Integration](https://docs.aws.amazon.com/step-functions/latest/dg/connect-ddb.html)
- [EventBridge Integration](https://docs.aws.amazon.com/step-functions/latest/dg/connect-eventbridge.html)
- [Error Handling in Step Functions](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-error-handling.html)
