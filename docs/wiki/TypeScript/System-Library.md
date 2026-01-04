# System Library

This document covers the shared system utilities in `src/lib/system/`.

## Overview

The system library provides foundational utilities used across Lambda handlers:

```
src/lib/system/
├── circuit-breaker.ts   # Resilience pattern for external services
├── retry.ts             # Retry with exponential backoff
├── errors.ts            # Custom error types with HTTP status codes
├── env.ts               # Environment variable utilities
├── observability.ts     # Tracing and metrics helpers
├── logging.ts           # Structured logging functions
├── query-wrapper.ts     # Query logging wrapper utilities
├── batch.ts             # Promise.allSettled result processing
└── time.ts              # Time constants and date helpers
```

## Circuit Breaker

Prevents cascading failures when external services (YouTube, APNS) are degraded.

### Basic Usage

```typescript
import {CircuitBreaker} from '#lib/system/circuit-breaker'

const breaker = new CircuitBreaker({
  name: 'youtube',
  failureThreshold: 3,    // Open after 3 failures
  resetTimeout: 300000,   // Try again after 5 minutes
  successThreshold: 2     // Close after 2 successes in half-open
})

async function downloadVideo(url: string) {
  return breaker.execute(async () => {
    return await ytdlp.download(url)
  })
}
```

### Pre-configured Breakers

```typescript
import {youtubeCircuitBreaker} from '#lib/system/circuit-breaker'

// YouTube-specific configuration
const result = await youtubeCircuitBreaker.execute(async () => {
  return await downloadFromYouTube(url)
})
```

### Circuit States

| State | Description | Behavior |
|-------|-------------|----------|
| CLOSED | Normal operation | Requests pass through |
| OPEN | Service unhealthy | Requests rejected immediately |
| HALF_OPEN | Testing recovery | Limited requests allowed |

### Handling Open Circuit

```typescript
import {CircuitBreakerOpenError} from '#lib/system/circuit-breaker'

try {
  await breaker.execute(operation)
} catch (error) {
  if (error instanceof CircuitBreakerOpenError) {
    // Circuit is open, service is degraded
    // error.retryAfterMs tells when to retry
    return fallbackResponse()
  }
  throw error
}
```

---

## Retry Utilities

Exponential backoff with jitter for handling transient failures.

### Retry Batch Operations

```typescript
import {retryUnprocessed} from '#lib/system/retry'

// Retry DynamoDB batch operations that return unprocessed items
const result = await retryUnprocessed(async () => {
  const response = await batchGetItems(keys)
  return {
    data: response.items,
    unprocessed: response.unprocessedKeys
  }
}, {
  maxRetries: 3,
  initialDelayMs: 100,
  multiplier: 2,
  maxDelayMs: 20000
})
```

### Retry Delete Operations

```typescript
import {retryUnprocessedDelete} from '#lib/system/retry'

await retryUnprocessedDelete(async () => {
  const response = await batchDeleteItems(keys)
  return {unprocessed: response.unprocessedKeys}
})
```

### Delay Utilities

```typescript
import {sleep, calculateDelayWithJitter} from '#lib/system/retry'

// Simple delay
await sleep(1000)  // Wait 1 second

// Calculate backoff delay (with jitter to prevent thundering herd)
const delay = calculateDelayWithJitter(100, 2, 2, 20000)
// Result: ~400ms + random jitter (0-1000ms)
```

---

## Error Types

Custom error classes with HTTP status codes for consistent API responses.

### Available Error Types

| Error Class | Status Code | Use Case |
|-------------|-------------|----------|
| `ValidationError` | 400 | Invalid request data |
| `UnauthorizedError` | 401 | Missing or invalid auth |
| `ForbiddenError` | 403 | Authenticated but not allowed |
| `NotFoundError` | 404 | Resource doesn't exist |
| `UnexpectedError` | 500 | Catchall for unexpected errors |
| `ServiceUnavailableError` | 503 | Service not configured/available |
| `CookieExpirationError` | 403 | YouTube cookie expired |

### Usage Examples

```typescript
import {ValidationError, NotFoundError, UnauthorizedError} from '#lib/system/errors'

// Validation error with details
throw new ValidationError('Invalid input', {
  email: 'Must be a valid email'
}, 400)

// Not found
throw new NotFoundError('User not found')

// With cause chaining
try {
  await externalService()
} catch (err) {
  throw new UnauthorizedError('Token invalid', 401, err as Error)
}
```

### Error Properties

All custom errors extend `CustomLambdaError` with:

```typescript
interface CustomLambdaError extends Error {
  statusCode?: number   // HTTP status code
  code?: string         // Machine-readable error code
  errors?: object       // Validation details
  cause?: Error         // Original error
}
```

---

## Environment Utilities

Safe environment variable access with validation.

### Required Environment Variables

```typescript
import {getRequiredEnv} from '#util/env-validation'

// Throws if not set - use inside functions, not at module level
async function handler() {
  const bucketName = getRequiredEnv('BUCKET_NAME')
}
```

### Optional Environment Variables

```typescript
import {getOptionalEnv, getOptionalEnvNumber} from '#util/env-validation'

// String with default
const host = getOptionalEnv('APNS_HOST', 'api.sandbox.push.apple.com')

// Number with default
const batchSize = getOptionalEnvNumber('BATCH_SIZE', 5)
```

### Important: Lazy Evaluation

Always read environment variables inside functions:

```typescript
// ✅ CORRECT - Read inside function
async function processFile() {
  const bucketName = getRequiredEnv('BUCKET_NAME')
}

// ❌ WRONG - Module-level breaks test mocking
const BUCKET_NAME = getRequiredEnv('BUCKET_NAME')
```

---

## Observability

Helpers for tracing and observation.

### Logging Observation

```typescript
import {observeResult} from '#lib/system/observability'

const user = await observeResult('getUser', async () => {
  return await getUser(userId)
})
// Logs: "getUser completed in 45ms"
```

### Request Context

The observability module works with AWS Powertools for:
- Correlation ID propagation
- X-Ray trace segments
- Structured log enrichment

---

## Logging

Structured JSON logging with PII protection.

### Log Functions

```typescript
import {logDebug, logInfo, logWarn, logError} from '#lib/system/logging'

// Debug (only in non-production)
logDebug('Processing file', {fileId, size})

// Info
logInfo('File uploaded', {fileId, bucket})

// Warning
logWarn('Retry attempt', {attempt: 2, maxAttempts: 3})

// Error
logError('Upload failed', {fileId, error: err.message})
```

### PII Protection

The logging system automatically redacts sensitive data:

```typescript
// Emails and names are redacted
logInfo('User created', {
  userId: 'abc123',
  email: 'user@example.com',  // Logged as [REDACTED]
  name: 'John Doe'            // Logged as [REDACTED]
})
```

See [PII Protection](PII-Protection.md) for configuration details.

### Log Levels

| Level | Environment | Use Case |
|-------|-------------|----------|
| DEBUG | Development only | Detailed debugging info |
| INFO | All | Normal operations |
| WARN | All | Recoverable issues |
| ERROR | All | Failures requiring attention |

---

## Query Wrapper

Higher-order functions that wrap async operations with automatic debug logging.

### Basic Usage

```typescript
import {withQueryLogging} from '#lib/system/query-wrapper'
import {getFilesForUser} from '#entities/queries'

// Wrap a query function with automatic logging
const getFiles = withQueryLogging(
  (userId: string) => getFilesForUser(userId),
  'getFilesByUser'
)

// When called, automatically logs:
// DEBUG: getFilesByUser <= "user123"
// DEBUG: getFilesByUser => [{fileId: "abc"}, ...]
const files = await getFiles('user123')
```

### Sync Wrapper

For synchronous operations:

```typescript
import {withSyncLogging} from '#lib/system/query-wrapper'

const parseConfig = withSyncLogging(
  (json: string) => JSON.parse(json),
  'parseConfig'
)
```

### Why Use This

Eliminates repetitive logging boilerplate like:

```typescript
// ❌ Before - repeated in 30+ handlers
async function getFilesByUser(userId: string): Promise<File[]> {
  logDebug('getFilesByUser <=', userId)
  const files = await getFilesForUser(userId)
  logDebug('getFilesByUser =>', files)
  return files
}

// ✅ After - one-liner
const getFilesByUser = withQueryLogging(getFilesForUser, 'getFilesByUser')
```

---

## Batch Processing

Utilities for processing `Promise.allSettled` results.

### Separating Results

```typescript
import {separateBatchResults} from '#lib/system/batch'

const results = await Promise.allSettled(operations)
const {succeeded, failed} = separateBatchResults(results)

// succeeded: T[] - values from fulfilled promises
// failed: Error[] - Error objects from rejected promises
```

### Counting Results

```typescript
import {countBatchResults} from '#lib/system/batch'

const results = await Promise.allSettled(operations)
const {successCount, failureCount} = countBatchResults(results)

metrics.addMetric('OperationsSucceeded', MetricUnit.Count, successCount)
metrics.addMetric('OperationsFailed', MetricUnit.Count, failureCount)
```

### Getting Failure Messages

```typescript
import {getFailureMessages} from '#lib/system/batch'

const results = await Promise.allSettled(operations)
const errorMessages = getFailureMessages(results)
// Returns string[] of error messages from rejected promises
```

### Convenience Checks

```typescript
import {allSucceeded, anyFailed} from '#lib/system/batch'

const results = await Promise.allSettled(operations)

if (allSucceeded(results)) {
  logInfo('All operations completed successfully')
}

if (anyFailed(results)) {
  logWarn('Some operations failed', {failures: getFailureMessages(results)})
}
```

---

## Time Constants

Common time durations and date manipulation utilities.

### Time Constants

```typescript
import {TIME} from '#lib/system/time'

// Seconds
TIME.MINUTE_SEC  // 60
TIME.HOUR_SEC    // 3600
TIME.DAY_SEC     // 86400
TIME.WEEK_SEC    // 604800
TIME.MONTH_SEC   // 2592000 (30 days)

// Milliseconds
TIME.MINUTE_MS   // 60000
TIME.HOUR_MS     // 3600000
TIME.DAY_MS      // 86400000
TIME.WEEK_MS     // 604800000
TIME.MONTH_MS    // 2592000000
```

### Date Helpers

```typescript
import {secondsAgo, secondsFromNow, millisecondsAgo, millisecondsFromNow} from '#lib/system/time'

// Get a Date 24 hours ago
const cutoff = secondsAgo(TIME.DAY_SEC)

// Get a Date 1 hour from now
const expiration = secondsFromNow(TIME.HOUR_SEC)

// Millisecond precision
const recentlyActive = millisecondsAgo(5000) // 5 seconds ago
```

### Timestamp Conversion

```typescript
import {unixToISOString, unixToDate, msToISOString, nowISO} from '#lib/system/time'

// Unix timestamp (seconds) to ISO string
const iso = unixToISOString(1718452800)  // "2024-06-15T12:00:00.000Z"

// Unix timestamp to Date
const date = unixToDate(1718452800)

// Milliseconds to ISO string
const isoMs = msToISOString(Date.now())

// Current time as ISO string
const now = nowISO()
```

### Date Checks

```typescript
import {isPast, isFuture, isExpired} from '#lib/system/time'

// Check if a Date is in the past
if (isPast(session.expiresAt)) {
  throw new UnauthorizedError('Session expired')
}

// Check if a Date is in the future
if (isFuture(subscription.startDate)) {
  throw new ValidationError('Subscription not yet active')
}

// Check if Unix timestamp (seconds) is expired
if (isExpired(tokenExpSec)) {
  throw new UnauthorizedError('Token expired')
}
```

---

## Integration with Lambda Handlers

### Typical Handler Pattern

```typescript
import {withPowertools} from '#lib/lambda/middleware/powertools'
import {wrapApiHandler} from '#lib/lambda/middleware/api'
import {getRequiredEnv} from '#util/env-validation'
import {logInfo} from '#lib/system/logging'
import {ValidationError} from '#lib/system/errors'
import {youtubeCircuitBreaker} from '#lib/system/circuit-breaker'

export const handler = withPowertools(wrapApiHandler(async ({event, context}) => {
  const bucketName = getRequiredEnv('BUCKET_NAME')

  if (!event.body) {
    throw new ValidationError('Request body required')
  }

  const result = await youtubeCircuitBreaker.execute(async () => {
    return await downloadVideo(event.body.url)
  })

  logInfo('Download complete', {fileId: result.fileId})

  return response(context, 200, result)
}))
```

---

## Testing

### Mocking System Utilities

```typescript
import {sleep, calculateDelayWithJitter} from '#lib/system/retry'
import {logInfo} from '#lib/system/logging'

vi.mock('#lib/system/retry', () => ({
  sleep: vi.fn().mockResolvedValue(undefined),
  calculateDelayWithJitter: vi.fn().mockReturnValue(0)
}))

vi.mock('#lib/system/logging', () => ({
  logInfo: vi.fn(),
  logDebug: vi.fn(),
  logError: vi.fn()
}))
```

### Testing Circuit Breaker

```typescript
import {CircuitBreaker} from '#lib/system/circuit-breaker'

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker

  beforeEach(() => {
    breaker = new CircuitBreaker({name: 'test', failureThreshold: 2})
  })

  afterEach(() => {
    breaker.reset()  // Reset state between tests
  })

  it('opens after threshold failures', async () => {
    const failing = vi.fn().mockRejectedValue(new Error('fail'))

    await expect(breaker.execute(failing)).rejects.toThrow()
    await expect(breaker.execute(failing)).rejects.toThrow()

    expect(breaker.getState()).toBe('OPEN')
  })
})
```

---

## Best Practices

1. **Use circuit breakers for external services** - YouTube, APNS, GitHub
2. **Always use typed errors** - Never throw plain `Error` in handlers
3. **Read env vars inside functions** - Enables proper test mocking
4. **Use structured logging** - Include context objects, not string concatenation
5. **Protect PII in logs** - Never log raw emails, names, or tokens
6. **Add jitter to retries** - Prevents thundering herd problems
7. **Use TIME constants** - Avoid magic numbers like `24 * 60 * 60`
8. **Use batch utilities** - Consistent Promise.allSettled result handling
9. **Wrap queries with logging** - Use `withQueryLogging` for debug tracing

## Related Documentation

- [Lambda Function Patterns](Lambda-Function-Patterns.md) - Handler patterns
- [TypeScript Error Handling](TypeScript-Error-Handling.md) - Error strategies
- [PII Protection](PII-Protection.md) - Data protection
- [Resilience Patterns](Resilience-Patterns.md) - Circuit breaker details
