# ADR-0006: Lambda Middleware Pattern (withPowertools)

## Status
Accepted

## Date
2025-12-18

## Context

Lambda handlers across the project exhibited several issues:

1. **Boilerplate Repetition**: Every handler had the same try-catch, logging, and response formatting
2. **Inconsistent Error Handling**: Some handlers caught errors, others didn't
3. **No Observability**: Missing structured logging, metrics, and tracing
4. **Response Format Drift**: Different handlers returned responses in different formats
5. **No Cold Start Tracking**: Important for performance monitoring

These issues led to:
- Bugs from inconsistent error handling
- Difficulty debugging production issues
- No visibility into Lambda performance
- Maintenance burden from duplicated code

## Decision

All Lambda handlers must use the `withPowertools` wrapper and an appropriate handler type wrapper.

### Handler Structure
```typescript
import {withPowertools} from '#lib/lambda/middleware/powertools'
import {wrapApiHandler} from '#lib/lambda/middleware/api'
import {response} from '#util/lambda-helpers'

export const handler = withPowertools(wrapApiHandler(async ({event, context}: ApiHandlerParams) => {
  // Business logic only - no try-catch, no logging boilerplate
  return response(context, 200, {data: result})
  // Errors automatically converted to 500 responses
}))
```

### Available Wrappers

| Wrapper | Use Case | Error Behavior |
|---------|----------|----------------|
| `wrapApiHandler` | Public API endpoints | Catches errors → 500 response |
| `wrapAuthenticatedHandler` | Auth-required endpoints | Rejects Unauthenticated/Anonymous → 401 |
| `wrapOptionalAuthHandler` | Mixed auth endpoints | Rejects only Unauthenticated → 401 |
| `wrapAuthorizer` | API Gateway authorizers | Propagates `Error('Unauthorized')` → 401 |
| `wrapEventHandler` | S3/SQS batch processing | Per-record error handling |
| `wrapScheduledHandler` | CloudWatch scheduled events | Logs and rethrows errors |

### What Wrappers Provide
- Automatic request logging via `logIncomingFixture()` (~150 bytes)
- Cold start metrics tracking (all handlers)
- Structured logging with correlation IDs
- Fixture extraction for test data
- `WrapperMetadata` with traceId

### Metrics Options
```typescript
// Default - cold start tracking only
export const handler = withPowertools(wrapApiHandler(...))

// Enable custom metrics for handlers that publish metrics
export const handler = withPowertools(wrapApiHandler(...), {enableCustomMetrics: true})
```

## Consequences

### Positive
- **Zero boilerplate**: Business logic only in handlers
- **Consistent error handling**: All handlers behave the same
- **Built-in observability**: Logging, metrics, tracing
- **Type safety**: Params are strongly typed
- **Fixture extraction**: Test data generated automatically
- **Cold start visibility**: Performance monitoring

### Negative
- Learning curve for wrapper patterns
- Must choose correct wrapper type
- Wrappers add slight overhead (~5ms)

## Enforcement

| Rule | Method | Severity |
|------|--------|----------|
| All handlers must use `withPowertools()` | ESLint `enforce-powertools` | HIGH |
| Use `response()` helper | MCP `response-helpers` | HIGH |
| No raw response objects | MCP `response-helpers` | HIGH |

## Related

- [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) - Implementation guide
- [ADR-0007: Error Handling](0007-error-handling-types.md) - Error patterns by handler type
- [CloudWatch Logging](../AWS/CloudWatch-Logging.md) - Structured logging
