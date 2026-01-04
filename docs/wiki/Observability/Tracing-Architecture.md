# Tracing Architecture

## Overview

This project uses **AWS X-Ray** for distributed tracing via **OpenTelemetry** and the **AWS Distro for OpenTelemetry (ADOT)** Lambda layer. The architecture provides automatic instrumentation of AWS SDK calls plus manual instrumentation for business logic.

## Architecture Components

### Infrastructure Layer

| Component | Configuration | Location |
|-----------|---------------|----------|
| ADOT Lambda Layer | ARM64/x86_64 | `terraform/main.tf:35-38` |
| X-Ray Active Tracing | All 17 Lambdas | Per-Lambda `.tf` files |
| X-Ray IAM Policy | CommonLambdaXRay | `terraform/main.tf:90-104` |
| API Gateway Tracing | Production stage | `terraform/api_gateway.tf:50` |
| OTEL Collector Config | Custom | `config/otel-collector.yaml` |

### Application Layer

| Component | Purpose | Location |
|-----------|---------|----------|
| OpenTelemetry Wrapper | Span management API | `src/lib/vendor/OpenTelemetry/index.ts` |
| Drizzle Instrumentation | DB query tracing | `src/lib/vendor/Drizzle/instrumentation.ts` |

## Trace Propagation Flows

### API Gateway to Lambda
```
Client -> API Gateway -> Lambda
           (X-Ray)      (ADOT)
```
X-Ray context is propagated automatically via `X-Amzn-Trace-Id` header.

### Lambda to SQS to Lambda
```
Lambda1 -> SQS -> Lambda2
  (ADOT)  (auto)  (ADOT)
```
ADOT auto-propagates trace context via SQS message attributes.

### Lambda to EventBridge to SQS to Lambda
```
WebhookFeedly -> EventBridge -> DownloadQueue -> StartFileUpload
    (ADOT)        (auto)          (auto)           (ADOT)
```
EventBridge preserves trace context through the event routing.

### Lambda to S3 (Event Trigger)
```
StartFileUpload -> S3 -> S3ObjectCreated
     (ADOT)      (event)    (ADOT)
```
**Note**: S3 events do not propagate X-Ray context. We use custom `correlationId` via S3 object metadata for logical correlation.

## OpenTelemetry API

### Import
```typescript
import {addAnnotation, addMetadata, endSpan, startSpan} from '#lib/vendor/OpenTelemetry'
```

### Creating Spans
```typescript
const span = startSpan('operation-name')
addAnnotation(span, 'key', 'value')  // Indexed in X-Ray
addMetadata(span, 'details', data)   // Not indexed

try {
  const result = await doOperation()
  endSpan(span)
  return result
} catch (error) {
  endSpan(span, error as Error)  // Records error
  throw error
}
```

### Tracing Enablement
Tracing is automatically disabled when:
- `ENABLE_XRAY=false` environment variable is set
- `USE_LOCALSTACK=true` (LocalStack doesn't support X-Ray)

## Instrumented Lambdas

### With Manual Instrumentation

| Lambda | Spans | Annotations |
|--------|-------|-------------|
| StartFileUpload | `yt-dlp-fetch-info`, `yt-dlp-download-to-s3` | videoId, s3Bucket, s3Key |
| WebhookFeedly | `webhook-process` | fileId, correlationId |
| S3ObjectCreated | `s3-event-process` | s3Key, fileId, correlationId |
| SendPushNotification | `send-push` | userId, notificationType |

### Auto-Instrumentation Only (ADOT)

All other Lambdas rely on ADOT for automatic AWS SDK call tracing:
- ApiGatewayAuthorizer
- CleanupExpiredRecords
- DeviceEvent
- ListFiles
- LoginUser
- MigrateDSQL
- PruneDevices
- RefreshToken
- RegisterDevice
- RegisterUser
- UserDelete
- UserSubscribe

### CloudfrontMiddleware

**No tracing** - Lambda@Edge has strict size limits (~1MB) and cannot use layers. The ADOT layer would add too much to the bundle size.

## Database Query Tracing

All Drizzle ORM queries are instrumented via `withQueryMetrics()`:

```typescript
const user = await withQueryMetrics('Users.get', async () => {
  return db.select().from(users).where(eq(users.id, userId))
})
```

This creates:
- X-Ray span: `db:Users.get`
- CloudWatch metric: `QueryDuration` with dimensions

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `ENABLE_XRAY` | Enable/disable tracing | `true` |
| `OTEL_SERVICE_NAME` | Lambda service name | `AWS_LAMBDA_FUNCTION_NAME` |
| `OPENTELEMETRY_EXTENSION_LOG_LEVEL` | ADOT log verbosity | `warn` |
| `OPENTELEMETRY_COLLECTOR_CONFIG_URI` | Custom collector config | `/var/task/collector.yaml` |

## Viewing Traces

1. Open AWS Console -> CloudWatch -> X-Ray traces
2. Filter by service name or trace ID
3. View trace timeline with spans
4. Annotations are searchable (filter expressions)
5. Metadata is visible in span details

## Best Practices

1. **Use annotations for searchable data**: fileId, userId, correlationId
2. **Use metadata for debugging**: request/response details, counts
3. **Always use try/catch with endSpan**: Ensure spans close on errors
4. **Keep span names short and descriptive**: `webhook-process`, `db:Users.get`
5. **Propagate correlationId**: For cross-service correlation outside X-Ray context
