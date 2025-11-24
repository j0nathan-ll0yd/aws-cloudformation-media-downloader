# CloudWatch Logging

## Quick Reference
- **When to use**: All Lambda functions and application logging
- **Enforcement**: Required - consistent structured logging
- **Impact if violated**: MEDIUM - Difficult debugging, poor observability

## Overview

Use structured JSON logging for CloudWatch to enable efficient log queries, filtering, and analysis. Always include relevant context with log entries.

## The Rules

### 1. Use Structured JSON Logging

Log as JSON objects, not plain strings, for searchable fields.

### 2. Include Context in Every Log

Add request ID, user ID, trace ID, and other relevant context.

### 3. Use Appropriate Log Levels

debug, info, warn, error - use the right level for each message.

### 4. Never Log Sensitive Data

No passwords, tokens, credit cards, or PII in logs.

## Examples

### ✅ Correct - Structured Logging

```typescript
// util/lambda-helpers.ts

export function logInfo(message: string, context: Record<string, any> = {}) {
  console.log(JSON.stringify({
    level: 'INFO',
    message,
    timestamp: Date.now(),
    ...context
  }))
}

export function logError(error: Error, context: Record<string, any> = {}) {
  console.error(JSON.stringify({
    level: 'ERROR',
    message: error.message,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    timestamp: Date.now(),
    ...context
  }))
}

export function logDebug(message: string, context: Record<string, any> = {}) {
  if (process.env.LOG_LEVEL === 'debug') {
    console.log(JSON.stringify({
      level: 'DEBUG',
      message,
      timestamp: Date.now(),
      ...context
    }))
  }
}

export function logWarn(message: string, context: Record<string, any> = {}) {
  console.warn(JSON.stringify({
    level: 'WARN',
    message,
    timestamp: Date.now(),
    ...context
  }))
}
```

### ✅ Correct - Lambda Handler Logging

```typescript
// src/lambdas/ProcessFile/src/index.ts

import {withXRay} from '../../../lib/vendor/AWS/XRay'
import {logInfo, logError, logWarn} from '../../../util/lambda-helpers'

export const handler = withXRay(async (event, context, {traceId}) => {
  const fileId = event.fileId
  
  logInfo('Processing file', {
    context: 'handler',
    traceId,
    fileId,
    userId: event.userId
  })
  
  try {
    const result = await processFile(fileId)
    
    logInfo('File processed successfully', {
      context: 'handler',
      traceId,
      fileId,
      duration: result.duration
    })
    
    return {statusCode: 200, body: result}
  } catch (error) {
    logError(error, {
      context: 'handler',
      traceId,
      fileId,
      operation: 'processFile'
    })
    
    return {statusCode: 500, body: {error: 'Processing failed'}}
  }
})
```

### ✅ Correct - Operation Logging

```typescript
// src/services/download-service.ts

import {logInfo, logWarn, logDebug} from '../../util/lambda-helpers'

export async function downloadFile(url: string, destination: string) {
  logInfo('Starting download', {
    context: 'download-service',
    url,
    destination
  })
  
  try {
    const response = await fetch(url)
    
    if (!response.ok) {
      logWarn('Download returned non-OK status', {
        context: 'download-service',
        url,
        status: response.status,
        statusText: response.statusText
      })
    }
    
    const size = response.headers.get('content-length')
    logDebug('Download response received', {
      context: 'download-service',
      url,
      contentLength: size,
      contentType: response.headers.get('content-type')
    })
    
    // Download logic
    
    logInfo('Download completed', {
      context: 'download-service',
      url,
      destination,
      size
    })
  } catch (error) {
    logError(error, {
      context: 'download-service',
      url,
      destination
    })
    throw error
  }
}
```

### ❌ Incorrect - String Logging

```typescript
// ❌ WRONG - Plain string logs
console.log('Processing file')
console.log('File ID: ' + fileId)
console.error('Error: ' + error.message)

// Cannot search by fileId in CloudWatch Insights
// No structured context
```

### ❌ Incorrect - Missing Context

```typescript
// ❌ WRONG - No context
console.log(JSON.stringify({
  level: 'INFO',
  message: 'Processing file'
}))

// What file? Which user? Which request?
// Missing critical debugging information
```

### ❌ Incorrect - Logging Sensitive Data

```typescript
// ❌ WRONG - Logging sensitive information
logInfo('User authentication', {
  userId: user.id,
  password: user.password,  // NEVER!
  email: user.email,
  apiToken: user.token      // NEVER!
})

// ❌ WRONG - Logging PII
logInfo('Processing payment', {
  creditCard: card.number,  // NEVER!
  ssn: user.ssn            // NEVER!
})
```

## CloudWatch Insights Queries

With structured logging, you can use CloudWatch Insights for powerful queries:

### Query Examples

```
# Find all errors in last hour
fields @timestamp, message, error.message, fileId, userId
| filter level = "ERROR"
| sort @timestamp desc
| limit 100

# Count errors by type
fields error.name
| filter level = "ERROR"
| stats count() by error.name

# Find slow operations
fields @timestamp, message, duration, fileId
| filter duration > 5000
| sort duration desc

# Find logs for specific user
fields @timestamp, message, operation, fileId
| filter userId = "user-123"
| sort @timestamp desc

# Find failed downloads
fields @timestamp, message, url, status
| filter context = "download-service" and status >= 400
| sort @timestamp desc

# Calculate average duration
fields duration
| filter message = "File processed successfully"
| stats avg(duration), max(duration), min(duration)
```

## Log Levels

### DEBUG

Detailed diagnostic information for development.

```typescript
logDebug('Entering function', {
  context: 'video-processor',
  params: {url, format, quality}
})
```

### INFO

General informational messages about application flow.

```typescript
logInfo('Video download started', {
  context: 'video-processor',
  videoId,
  url
})
```

### WARN

Potentially harmful situations that should be investigated.

```typescript
logWarn('Retry attempt after failure', {
  context: 'video-processor',
  attempt: 2,
  maxAttempts: 3,
  error: error.message
})
```

### ERROR

Error events that might still allow the application to continue.

```typescript
logError(error, {
  context: 'video-processor',
  videoId,
  operation: 'download'
})
```

## Context Fields

### Standard Context Fields

Include these in most log entries:

```typescript
{
  context: string,      // Component/function name
  traceId: string,      // X-Ray trace ID
  requestId: string,    // API Gateway request ID
  userId: string,       // User performing action
  operation: string,    // What operation is being performed
  timestamp: number     // Milliseconds since epoch
}
```

### Operation-Specific Fields

Add relevant fields for the operation:

```typescript
// File operations
{
  fileId: string,
  fileName: string,
  fileSize: number,
  mimeType: string
}

// Network operations
{
  url: string,
  method: string,
  status: number,
  duration: number
}

// Database operations
{
  tableName: string,
  operation: string,
  itemCount: number
}
```

## Performance Considerations

### Avoid Excessive Logging

```typescript
// ❌ WRONG - Logging in tight loops
for (const item of items) {
  logDebug('Processing item', {item})  // Too verbose
  process(item)
}

// ✅ CORRECT - Log summary
logInfo('Processing items', {
  context: 'batch-processor',
  itemCount: items.length
})

for (const item of items) {
  process(item)
}

logInfo('Items processed', {
  context: 'batch-processor',
  processedCount: items.length
})
```

### Log Large Objects Carefully

```typescript
// ❌ WRONG - Logging entire large object
logInfo('Received event', {
  event: largeEvent  // Could be megabytes
})

// ✅ CORRECT - Log relevant fields
logInfo('Received event', {
  eventType: event.type,
  recordCount: event.Records?.length,
  source: event.source
})
```

## Log Sampling for High-Volume Operations

```typescript
// Sample 10% of debug logs for high-volume operations
function logDebugSampled(message: string, context: Record<string, any>) {
  if (Math.random() < 0.1) {  // 10% sampling
    logDebug(message, {
      ...context,
      sampled: true
    })
  }
}

// Use in high-frequency code
for (const record of records) {
  logDebugSampled('Processing record', {
    context: 'batch-processor',
    recordId: record.id
  })
  processRecord(record)
}
```

## Error Logging Best Practices

### Include Error Context

```typescript
try {
  await uploadToS3(bucket, key, data)
} catch (error) {
  // ✅ Include operation context
  logError(error, {
    context: 's3-uploader',
    operation: 'upload',
    bucket,
    key,
    dataSize: data.length
  })
  throw error
}
```

### Log Error Chain

```typescript
try {
  await complexOperation()
} catch (error) {
  // ✅ Log and re-throw with context
  logError(error, {
    context: 'handler',
    operation: 'complexOperation'
  })
  
  // Wrap with more context
  throw new Error(`Complex operation failed: ${error.message}`)
}
```

## Rationale

### Structured Logging Benefits

1. **Searchable** - Query by any field in CloudWatch Insights
2. **Filterable** - Easy to filter by user, operation, error type
3. **Aggregatable** - Calculate stats, count occurrences
4. **Parseable** - Automated log processing and alerting
5. **Consistent** - Same format across all logs

### Context Benefits

1. **Debugging** - Trace issues through distributed system
2. **Correlation** - Connect related log entries
3. **Analysis** - Understand patterns and trends
4. **Alerting** - Create targeted alarms
5. **Audit** - Track user actions

## Enforcement

### Code Review Checklist

- [ ] All logs use JSON format
- [ ] Logs include relevant context (traceId, userId, etc.)
- [ ] Appropriate log level used
- [ ] No sensitive data in logs
- [ ] Error logs include error details and context
- [ ] High-volume operations use sampling

### ESLint Rule

```javascript
// eslint.config.mjs
export default [
  {
    rules: {
      'no-console': ['error', {
        allow: ['log', 'error', 'warn']  // Only allowed via helpers
      }]
    }
  }
]
```

## CloudWatch Configuration

### Log Retention

```hcl
# terraform/CloudWatchLogs.tf

resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/${var.function_name}"
  retention_in_days = 30  # Adjust based on requirements
  
  tags = {
    Environment = var.environment
    Function    = var.function_name
  }
}
```

### Log Metric Filters

```hcl
# terraform/CloudWatchMetrics.tf

# Count errors
resource "aws_cloudwatch_log_metric_filter" "error_count" {
  name           = "ErrorCount"
  log_group_name = aws_cloudwatch_log_group.lambda_logs.name
  pattern        = "{ $.level = \"ERROR\" }"
  
  metric_transformation {
    name      = "ErrorCount"
    namespace = "MediaDownloader"
    value     = "1"
  }
}

# Track slow operations
resource "aws_cloudwatch_log_metric_filter" "slow_operations" {
  name           = "SlowOperations"
  log_group_name = aws_cloudwatch_log_group.lambda_logs.name
  pattern        = "{ $.duration > 5000 }"
  
  metric_transformation {
    name      = "SlowOperationCount"
    namespace = "MediaDownloader"
    value     = "1"
  }
}
```

## Testing Logs

```typescript
// test/lambdas/ProcessFile/index.test.ts

describe('ProcessFile handler', () => {
  let consoleLogSpy: jest.SpyInstance
  let consoleErrorSpy: jest.SpyInstance
  
  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
  })
  
  afterEach(() => {
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })
  
  it('logs structured info messages', async () => {
    await handler(event, context)
    
    expect(consoleLogSpy).toHaveBeenCalled()
    
    const logCall = consoleLogSpy.mock.calls[0][0]
    const logEntry = JSON.parse(logCall)
    
    expect(logEntry).toMatchObject({
      level: 'INFO',
      message: expect.any(String),
      context: 'handler',
      fileId: event.fileId
    })
  })
  
  it('logs errors with context', async () => {
    mockOperation.mockRejectedValue(new Error('Test error'))
    
    await handler(event, context)
    
    expect(consoleErrorSpy).toHaveBeenCalled()
    
    const errorCall = consoleErrorSpy.mock.calls[0][0]
    const errorEntry = JSON.parse(errorCall)
    
    expect(errorEntry).toMatchObject({
      level: 'ERROR',
      message: 'Test error',
      context: 'handler',
      fileId: event.fileId
    })
  })
})
```

## Related Patterns

- [X-Ray Integration](X-Ray-Integration.md) - Distributed tracing with trace IDs
- [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) - Handler logging
- [Error Handling](../TypeScript/Error-Handling.md) - Error logging patterns

---

*Use structured JSON logging with relevant context for searchable, filterable CloudWatch logs. Never log sensitive data.*
