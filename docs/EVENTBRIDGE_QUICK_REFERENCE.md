# EventBridge Quick Reference

Quick reference for using EventBridge and Step Functions in the Media Downloader project.

## 🚀 Quick Commands

### Event Replay

```bash
# List all event archives
npm run eventbridge:list-archives

# List all replays (active and completed)
npm run eventbridge:list-replays

# Replay last hour of events
npm run eventbridge:replay -- --start "$(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ)" --end "$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Replay specific time period
npm run eventbridge:replay -- --start 2025-11-23T10:00:00Z --end 2025-11-23T11:00:00Z

# Check replay status
./bin/eventbridge-replay.sh check-replay MyReplay

# Stop running replay
./bin/eventbridge-replay.sh stop-replay MyReplay
```

### State Machine Operations

```bash
# List state machine executions
aws stepfunctions list-executions \
  --state-machine-arn arn:aws:states:us-west-2:ACCOUNT_ID:stateMachine:FileDownloadWorkflow

# Describe specific execution
aws stepfunctions describe-execution \
  --execution-arn arn:aws:states:...

# View execution history
aws stepfunctions get-execution-history \
  --execution-arn arn:aws:states:...
```

## 📝 Code Snippets

### Publishing Events

```typescript
import {
  publishFileMetadataReady,
  publishFileDownloadCompleted,
  publishFileDownloadFailed
} from '../../../util/eventbridge-helpers'

// Publish metadata ready
await publishFileMetadataReady({
  fileId: 'abc123',
  title: 'Video Title',
  description: 'Description',
  authorName: 'Author',
  authorUser: 'author_user',
  publishDate: '2025-01-01T00:00:00Z',
  contentType: 'video/mp4',
  size: 1048576
})

// Publish download completed
await publishFileDownloadCompleted({
  fileId: 'abc123',
  s3Key: 'videos/abc123.mp4',
  size: 1048576,
  contentType: 'video/mp4'
})

// Publish download failed
await publishFileDownloadFailed({
  fileId: 'abc123',
  error: 'Download timeout',
  errorCode: 'TIMEOUT',
  timestamp: Date.now()
})
```

### Consuming Events

```typescript
import {EventBridgeEvent} from 'aws-lambda'
import {FileDownloadCompletedDetail} from '../../../types/eventbridge'

export const handler = async (
  event: EventBridgeEvent<'FileDownloadCompleted', FileDownloadCompletedDetail>
) => {
  const {fileId, s3Key, size} = event.detail
  
  // Handle event
  console.log(`File ${fileId} completed: ${s3Key} (${size} bytes)`)
}
```

### Triggering Step Functions

```typescript
import {startExecution} from '../../../lib/vendor/AWS/StepFunctions'

const result = await startExecution({
  stateMachineArn: process.env.STATE_MACHINE_ARN,
  input: JSON.stringify({fileId: 'abc123'})
})

console.log('Execution ARN:', result.executionArn)
```

## 🧪 Testing

### Unit Test Mocks

```typescript
// Mock EventBridge
jest.unstable_mockModule('../../../lib/vendor/AWS/EventBridge', () => ({
  putEvents: jest.fn<() => Promise<PutEventsResponse>>()
    .mockResolvedValue({
      FailedEntryCount: 0,
      Entries: [{EventId: 'test-123'}]
    })
}))

// Mock Step Functions
jest.unstable_mockModule('../../../lib/vendor/AWS/StepFunctions', () => ({
  startExecution: jest.fn<() => Promise<StartExecutionOutput>>()
    .mockResolvedValue({
      executionArn: 'arn:aws:states:...',
      startDate: new Date()
    })
}))
```

### LocalStack Integration

```typescript
// Set environment variable
process.env.USE_LOCALSTACK = 'true'

// Publish event (automatically routes to LocalStack)
await publishFileDownloadCompleted({
  fileId: 'test123',
  s3Key: 'videos/test123.mp4',
  size: 1024,
  contentType: 'video/mp4'
})
```

## 📊 Monitoring

### CloudWatch Metrics

```bash
# EventBridge invocations
aws cloudwatch get-metric-statistics \
  --namespace AWS/Events \
  --metric-name Invocations \
  --dimensions Name=EventBusName,Value=MediaDownloaderEvents \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 \
  --statistics Sum

# Step Functions executions
aws cloudwatch get-metric-statistics \
  --namespace AWS/States \
  --metric-name ExecutionsStarted \
  --dimensions Name=StateMachineArn,Value=arn:aws:states:... \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 \
  --statistics Sum
```

### CloudWatch Logs

```bash
# EventBridge events
aws logs tail /aws/events/MediaDownloaderEvents --follow

# Step Functions execution logs
aws logs tail /aws/states/FileDownloadWorkflow --follow
```

## 🔧 Infrastructure

### Deploy EventBridge

```bash
cd terraform
tofu init
tofu plan
tofu apply
```

### Verify Deployment

```bash
# Check event bus
aws events describe-event-bus --name MediaDownloaderEvents

# Check schema registry
aws schemas list-schemas --registry-name MediaDownloaderSchemas

# Check state machine
aws stepfunctions list-state-machines | jq '.stateMachines[] | select(.name == "FileDownloadWorkflow")'

# Check event archive
aws events describe-archive --archive-name MediaDownloaderArchive
```

## 📖 Event Schemas

### FileMetadataReady

**Source**: `aws.mediadownloader.metadata`  
**Detail Type**: `FileMetadataReady`

```typescript
{
  fileId: string          // YouTube video ID
  title: string           // Video title
  description: string     // Video description
  authorName: string      // Channel author name
  authorUser: string      // Channel author username
  publishDate: string     // ISO 8601 date-time
  contentType: string     // MIME type
  size: number           // File size in bytes
}
```

### FileDownloadStarted

**Source**: `aws.mediadownloader.download`  
**Detail Type**: `FileDownloadStarted`

```typescript
{
  fileId: string          // YouTube video ID
  timestamp: number       // Unix timestamp (ms)
}
```

### FileDownloadCompleted

**Source**: `aws.mediadownloader.download`  
**Detail Type**: `FileDownloadCompleted`

```typescript
{
  fileId: string          // YouTube video ID
  s3Key: string          // S3 object key
  s3Url?: string         // S3 object URL (optional)
  size: number           // File size in bytes
  contentType: string    // MIME type
}
```

### FileDownloadFailed

**Source**: `aws.mediadownloader.download`  
**Detail Type**: `FileDownloadFailed`

```typescript
{
  fileId: string          // YouTube video ID
  error: string          // Error message
  errorCode?: string     // Error code (optional)
  timestamp: number      // Unix timestamp (ms)
}
```

## 🔗 Resources

- [Full Migration Guide](EVENTBRIDGE_MIGRATION.md)
- [Event-Driven Architecture](wiki/Infrastructure/Event-Driven-Architecture.md)
- [Step Functions Workflow](wiki/Infrastructure/Step-Functions-Workflow.md)
- [AWS EventBridge Docs](https://docs.aws.amazon.com/eventbridge/)
- [AWS Step Functions Docs](https://docs.aws.amazon.com/step-functions/)

## 🆘 Troubleshooting

### Events Not Arriving

1. Check EventBridge rule is enabled
2. Verify event pattern matches published events
3. Check IAM permissions for targets
4. Review CloudWatch Logs for errors

### State Machine Execution Failed

1. View execution in AWS Console (visual graph)
2. Click failed state to see input/output
3. Check CloudWatch Logs: `/aws/states/FileDownloadWorkflow`
4. Verify IAM permissions for state machine role

### Event Replay Not Working

1. Check archive retention period
2. Verify time range is within retention window
3. Check destination event bus exists
4. Review replay status: `./bin/eventbridge-replay.sh check-replay <name>`
