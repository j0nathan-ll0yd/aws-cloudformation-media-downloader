# Error Handling Patterns

This document describes the error handling and debugging capabilities across the AWS Lambda media downloader service.

## Overview

The service provides comprehensive error handling through:
- **Custom Error Hierarchy**: Typed errors with HTTP status codes
- **Error Classification**: Domain-specific error categorization with retry strategies
- **Context Enrichment**: Request context attached to all errors
- **GitHub Issue Deduplication**: Fingerprinting to prevent duplicate issues
- **CloudWatch Metrics**: Error rates by Lambda, type, and category

## Custom Error Classes

All custom errors extend `CustomLambdaError` in `src/lib/system/errors.ts`:

```typescript
import { CustomLambdaError } from '#lib/system/errors'

class ValidationError extends CustomLambdaError {
  constructor(message: string) {
    super(message)
    this.statusCode = 400
    this.code = 'VALIDATION_ERROR'
  }
}
```

### Available Error Classes

| Class | Status Code | Use Case |
|-------|-------------|----------|
| `UnauthorizedError` | 401 | Invalid or missing auth token |
| `NotFoundError` | 404 | Resource not found |
| `ConflictError` | 409 | Resource already exists |
| `ServerError` | 500 | Internal server errors |

### Error Context

Errors automatically receive request context via `withContext()`:

```typescript
error.withContext({
  correlationId: 'abc-123',
  traceId: 'xyz-789',
  userId: 'user-id',
  lambdaName: 'StartFileUpload',
  timestamp: '2025-01-03T00:00:00Z',
  path: '/files',
  httpMethod: 'GET'
})
```

## Error Classification System

Domain-specific classifiers determine retry behavior and alerting:

### Domains

1. **Auth Errors** (`classifyAuthError`):
   - `auth_expired`: Token/session expired, requires re-authentication
   - `auth_invalid`: Invalid credentials, no retry
   - `transient`: Network issues, retryable

2. **Database Errors** (`classifyDatabaseError`):
   - `transient`: Connection issues, retry with backoff
   - `permanent`: Constraint violations, create issue

3. **External API Errors** (`classifyExternalApiError`):
   - `rate_limited`: Retry with 60s delay
   - `transient`: 5xx errors, retry with backoff
   - `permanent`: 4xx errors, no retry

### Classification Result

```typescript
interface ErrorClassification {
  category: ErrorCategory
  retryable: boolean
  retryDelayMs?: number
  maxRetries: number
  reason: string
  createIssue: boolean
  issuePriority?: 'low' | 'normal' | 'high' | 'critical'
}
```

### Usage

```typescript
import { classifyError } from '#lib/domain/error'

const result = classifyError(error, 'database')
if (result.retryable) {
  await sleep(result.retryDelayMs)
  // retry operation
}
```

## GitHub Issue Deduplication

Errors that trigger GitHub issues are fingerprinted to prevent duplicates:

### How It Works

1. **Fingerprint Generation**: Hash from error type, code, stack frame, and Lambda name
2. **Issue Lookup**: Check for existing open issue with fingerprint label
3. **Deduplication**: Add comment to existing issue OR create new issue

### Fingerprint Format

```
error-fp-[12 char hex hash]
```

### Template Integration

All issue templates include a Deduplication section:

```markdown
## Deduplication

**Fingerprint**: `error-fp-abc123def456`
**Components**: type:TypeError, lambda:StartFileUpload, ctx:video:file-123
```

## CloudWatch Metrics

Error and success metrics are emitted for all Lambda invocations:

### Error Metrics

| Metric | Dimensions | When Emitted |
|--------|------------|--------------|
| `ErrorCount` | LambdaName, ErrorType | Every error |
| `ErrorByCategory` | LambdaName, ErrorCategory | When classification available |
| `ErrorByStatusCode` | LambdaName, StatusCode | HTTP errors with status |
| `RetryExhausted` | LambdaName, ErrorType | Non-retryable after max retries |

### Success Metrics

| Metric | Dimensions | When Emitted |
|--------|------------|--------------|
| `SuccessCount` | LambdaName | 2xx responses |

### Integration

Metrics are automatically emitted by:
- `buildErrorResponse()` in `src/lib/lambda/responses.ts`
- API middleware wrappers in `src/lib/lambda/middleware/api.ts`

## Middleware Wrappers

The API middleware provides centralized error handling:

```typescript
import { wrapAuthenticatedHandler } from '#lib/lambda/middleware/api'

export const handler = wrapAuthenticatedHandler(async ({ event, context, userId }) => {
  // Business logic - errors are automatically caught and formatted
  return { statusCode: 200, body: JSON.stringify(result) }
})
```

### Available Wrappers

| Wrapper | Auth Required | Use Case |
|---------|---------------|----------|
| `wrapApiHandler` | No | Public endpoints |
| `wrapAuthenticatedHandler` | Yes | Authenticated endpoints |
| `wrapOptionalAuthHandler` | Optional | Mixed auth endpoints |

## Debugging Workflow

1. **Check CloudWatch Logs**: Errors include full context with correlationId
2. **Use X-Ray**: Trace requests across Lambda invocations
3. **Review GitHub Issues**: Automated issues for critical failures
4. **Query Metrics**: Error rates by Lambda and error type

## Best Practices

1. **Use Custom Error Classes**: Inherit from `CustomLambdaError` for consistency
2. **Let Middleware Handle Errors**: Don't wrap handlers in try-catch
3. **Add Context**: Use `withContext()` for additional debugging info
4. **Classify Errors**: Use domain classifiers for consistent retry behavior
5. **Monitor Metrics**: Set up CloudWatch alarms on error rates

## Related Documentation

- [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md)
- [System Library](../TypeScript/System-Library.md)
- [Vitest Mocking Strategy](../Testing/Vitest-Mocking-Strategy.md)
