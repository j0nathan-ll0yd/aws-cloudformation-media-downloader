# ADR-0007: Error Handling by Lambda Invocation Type

## Status
Accepted

## Date
2025-12-17

## Context

Different Lambda invocation patterns have fundamentally different error semantics:

1. **API Gateway**: Throwing an unhandled error returns 502 Bad Gateway to clients
2. **Event-Driven (SNS/SQS/EventBridge)**: Errors trigger automatic retries and DLQ processing
3. **Scheduled (CloudWatch Events)**: Errors should propagate for alerting

Without clear guidelines, developers made inconsistent choices:
- Some API handlers threw errors (bad UX - users see 502)
- Some event handlers caught and swallowed errors (no retries, silent failures)
- Error logging was inconsistent

## Decision

Error handling strategy is determined by Lambda invocation type.

### API Gateway Lambdas: NEVER Throw

Always return a well-formed response, even for errors:

```typescript
export const handler = wrapApiHandler(async ({event, context}) => {
  try {
    const result = await operation()
    return response(context, 200, result)
  } catch (error) {
    // Return error response, don't throw
    return buildApiResponse(context, error as Error)
  }
})
```

**Why**: Throwing returns 502 Bad Gateway. Users deserve proper error messages.

### Event-Driven Lambdas: DO Throw

Let errors propagate to trigger retries and DLQ:

```typescript
export const handler = wrapEventHandler(async ({record}) => {
  try {
    await processRecord(record)
  } catch (error) {
    logError('Failed to process record', error)
    throw error  // Triggers retry/DLQ
  }
})
```

**Why**: AWS automatically retries failed events. Swallowing errors prevents retries and causes silent data loss.

### Input Validation: Return 400

Validation errors in API handlers return 400 Bad Request:

```typescript
try {
  validateRequest(body, schema)
} catch (error) {
  return buildApiResponse(context, error)  // 400 response
}
```

## Consequences

### Positive
- Consistent error handling across all Lambdas
- Users get proper error messages from APIs
- Event failures trigger retries automatically
- Clear mental model for developers

### Negative
- Must remember which pattern applies
- Handler wrappers must match invocation type

## Enforcement

- Handler wrappers enforce patterns automatically
- Code review checklist includes error handling verification
- ESLint could detect throw in API handlers (not implemented)

## Related

- [TypeScript Error Handling](../TypeScript/TypeScript-Error-Handling.md) - Implementation guide
- [ADR-0006: Lambda Middleware](0006-lambda-middleware.md) - Handler wrappers
- [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) - Full examples
