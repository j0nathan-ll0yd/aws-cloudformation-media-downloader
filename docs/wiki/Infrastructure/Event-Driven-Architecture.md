# Event-Driven Architecture with EventBridge

This document describes the event-driven architecture patterns using AWS EventBridge for the Media Downloader application.

## Overview

The Media Downloader uses EventBridge as the central event bus for decoupled, event-driven workflows. This replaces tight Lambda-to-Lambda coupling with loosely-coupled event consumers.

### Benefits

- **Decoupling**: Producers don't need to know about consumers
- **Scalability**: Add new event consumers without modifying existing code
- **Debugging**: Event archive enables production debugging via replay
- **Type Safety**: Schema registry provides versioned event contracts
- **Observability**: Built-in event tracing and monitoring

## Architecture

### Event Flow

```
Producer Lambda → EventBridge (Custom Bus) → Multiple Consumers
                        ↓
                  Event Archive (90 days)
                        ↓
                  Replay Capability
```

### Components

1. **Custom Event Bus**: `MediaDownloaderEvents`
   - Separate from default bus for better isolation
   - Dedicated IAM permissions
   - Custom routing rules

2. **Schema Registry**: `MediaDownloaderSchemas`
   - OpenAPI 3.0 schema definitions
   - Versioned event contracts
   - Type-safe TypeScript types

3. **Event Archive**: `MediaDownloaderArchive`
   - 90-day retention
   - Production debugging capability
   - Event replay for testing

## Event Types

### FileMetadataReady

Published when video metadata has been retrieved.

**Source**: `aws.mediadownloader.metadata`  
**Detail Type**: `FileMetadataReady`

**Schema**:
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

**Use Cases**:
- Trigger download workflow
- Update search index
- Analytics tracking

### FileDownloadStarted

Published when file download begins.

**Source**: `aws.mediadownloader.download`  
**Detail Type**: `FileDownloadStarted`

**Schema**:
```typescript
{
  fileId: string          // YouTube video ID
  timestamp: number       // Unix timestamp (ms)
}
```

**Use Cases**:
- Update file status in DynamoDB
- Start monitoring/alerting
- Track download metrics

### FileDownloadCompleted

Published when file is successfully uploaded to S3.

**Source**: `aws.mediadownloader.download`  
**Detail Type**: `FileDownloadCompleted`

**Schema**:
```typescript
{
  fileId: string          // YouTube video ID
  s3Key: string          // S3 object key
  s3Url?: string         // S3 object URL (optional)
  size: number           // File size in bytes
  contentType: string    // MIME type
}
```

**Use Cases**:
- Send push notifications to users
- Update file status to Downloaded
- Trigger post-processing (transcoding, thumbnails)
- Update analytics

### FileDownloadFailed

Published when download fails.

**Source**: `aws.mediadownloader.download`  
**Detail Type**: `FileDownloadFailed`

**Schema**:
```typescript
{
  fileId: string          // YouTube video ID
  error: string          // Error message
  errorCode?: string     // Error code (optional)
  timestamp: number      // Unix timestamp (ms)
}
```

**Use Cases**:
- Create GitHub issue for investigation
- Update file status to Failed
- Trigger retry logic
- Alert monitoring

## Usage Patterns

### Publishing Events

Use the helper functions in `src/util/eventbridge-helpers.ts`:

```typescript
import {
  publishFileMetadataReady,
  publishFileDownloadStarted,
  publishFileDownloadCompleted,
  publishFileDownloadFailed
} from '../../../util/eventbridge-helpers'

// In Lambda handler
await publishFileDownloadCompleted({
  fileId: 'abc123',
  s3Key: 'videos/abc123.mp4',
  size: 1048576,
  contentType: 'video/mp4'
})
```

### Consuming Events

Events can be consumed via:

1. **Lambda Functions**: Direct EventBridge rule → Lambda
2. **Step Functions**: EventBridge rule → State Machine
3. **SQS Queues**: EventBridge rule → SQS → Lambda (buffering)

**Example EventBridge Rule (Terraform)**:

```hcl
resource "aws_cloudwatch_event_rule" "FileDownloadCompleted" {
  name           = "FileDownloadCompleted"
  description    = "Trigger notification when file download completes"
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
```

## Event Replay for Debugging

### Replaying Production Events

EventBridge Archive enables replaying past events for debugging:

```bash
# Replay events from specific time period to dev environment
aws events start-replay \
  --replay-name DebugIssue123 \
  --event-source-arn arn:aws:events:us-west-2:123456789:archive/MediaDownloaderArchive \
  --event-start-time 2025-11-23T10:00:00Z \
  --event-end-time 2025-11-23T11:00:00Z \
  --destination EventBusName=MediaDownloaderEvents-Dev
```

### Use Cases for Replay

1. **Debug Production Issues**: Replay exact sequence of events that caused a bug
2. **Load Testing**: Replay 1 hour of production traffic to test changes
3. **Testing New Features**: Validate new event consumers with real data
4. **Incident Analysis**: Reconstruct event timeline for post-mortems

## Schema Registry Integration

### Type Generation

EventBridge schemas can generate TypeScript types:

```bash
# Describe schema (OpenAPI 3.0 format)
aws schemas describe-schema \
  --registry-name MediaDownloaderSchemas \
  --schema-name FileDownloadCompleted \
  --output json > schema.json

# Generate TypeScript types (using quicktype or similar)
quicktype schema.json -o types/eventbridge-generated.ts
```

### Schema Versioning

Schemas support versioning for API evolution:

- **Breaking changes**: Increment major version (1.0 → 2.0)
- **Backward-compatible additions**: Increment minor version (1.0 → 1.1)
- **Consumers**: Specify compatible schema versions in rules

## Monitoring and Observability

### CloudWatch Metrics

Monitor EventBridge performance:

- **Invocations**: Number of events published
- **FailedInvocations**: Failed event deliveries
- **ThrottledRules**: Rate-limited rules
- **TriggeredRules**: Rules executed per event

### X-Ray Tracing

EventBridge integrates with X-Ray for distributed tracing:

1. Events published from Lambda include trace context
2. EventBridge propagates trace ID to consumers
3. Full request flow visible in X-Ray service map

### Custom Metrics

Track event-specific metrics:

```typescript
import {logMetric} from '../../../util/lambda-helpers'

// After publishing event
await publishFileDownloadCompleted(detail)
logMetric('FileDownloadCompleted', 1, 'Count')
```

## Migration Strategy

### Phase 1: Additive Changes (Current)

- ✅ EventBridge infrastructure deployed
- ✅ Schema registry operational
- ✅ Event archive enabled
- ✅ Helper functions available
- 🔄 Legacy code unchanged (parallel operation)

### Phase 2: Event Publishing (Next)

- Update `StartFileUpload` to publish events
- Update `S3ObjectCreated` to publish events
- Verify event delivery to archive
- Monitor for failures

### Phase 3: Event Consumption

- Create EventBridge rules for events
- Add Lambda targets (notifications, analytics)
- Run parallel with existing direct invocations
- Compare reliability and latency

### Phase 4: Full Migration

- Remove direct Lambda invocations
- Update FileCoordinator to use events
- Delete unused SNS topics/SQS queues
- Document event-driven patterns

## Best Practices

### Event Design

1. **Immutable Events**: Never modify events once published
2. **Complete Data**: Include all context needed by consumers
3. **Idempotency**: Design consumers to handle duplicate events
4. **Versioning**: Use semantic versioning for schema changes

### Error Handling

1. **Dead Letter Queues**: Configure DLQs for failed deliveries
2. **Retry Logic**: Use exponential backoff for transient failures
3. **Monitoring**: Alert on FailedInvocations metric
4. **Fallback**: Maintain fallback mechanisms for critical paths

### Performance

1. **Batch Events**: Use PutEvents batch API (up to 10 events)
2. **Async Publishing**: Don't block Lambda on event delivery
3. **Rule Filtering**: Use event patterns to reduce invocations
4. **TTL**: Set appropriate event archive retention

## Testing

### Unit Tests

Mock EventBridge vendor wrapper:

```typescript
jest.unstable_mockModule('../../../lib/vendor/AWS/EventBridge', () => ({
  putEvents: jest.fn<() => Promise<PutEventsResponse>>()
    .mockResolvedValue({
      FailedEntryCount: 0,
      Entries: [{EventId: 'test-123'}]
    })
}))
```

### Integration Tests

Use LocalStack for EventBridge testing:

```typescript
// LocalStack automatically configures EventBridge
process.env.USE_LOCALSTACK = 'true'

// Publish event
await publishFileDownloadCompleted({...})

// Verify event in archive or consumer Lambda
```

## Troubleshooting

### Events Not Arriving

1. Check EventBridge rule is enabled
2. Verify event pattern matches published events
3. Check IAM permissions for targets
4. Review CloudWatch Logs for rule errors

### Schema Validation Failures

1. Verify event detail matches schema
2. Check schema version compatibility
3. Review OpenAPI schema definition
4. Test with sample events

### High Latency

1. Check EventBridge rule complexity
2. Review target Lambda cold starts
3. Monitor throttling metrics
4. Consider async patterns (SQS buffering)

## References

- [AWS EventBridge Developer Guide](https://docs.aws.amazon.com/eventbridge/)
- [EventBridge Schema Registry](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-schema.html)
- [Event Archive and Replay](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-archive-event.html)
- [EventBridge Best Practices](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-best-practices.html)
