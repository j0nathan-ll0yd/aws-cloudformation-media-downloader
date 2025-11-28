# CloudWatch Logging

## Quick Reference
- **When to use**: All Lambda functions
- **Enforcement**: Required
- **Impact if violated**: MEDIUM - Poor observability

## Logging Functions

The project provides three logging functions in `util/lambda-helpers.ts`:

```typescript
logInfo(message: string, stringOrObject?: string | object): void
logDebug(message: string, stringOrObject?: string | object): void
logError(message: string, stringOrObject?: string | object | unknown): void
```

- **logInfo**: Standard functionality and flow
- **logDebug**: Detailed diagnostic information
- **logError**: Error conditions

## Usage Pattern

```typescript
import {logInfo, logDebug, logError} from '../../../util/lambda-helpers'

// Log with message only
logInfo('event <=', event)

// Log with context object
logDebug('getFilesByUser.userFiles =>', userFilesResponse)

// Log errors
logError('Failed to process', error)
```

## CloudWatch Insights Queries

```sql
# Find errors
fields @timestamp, @message
| filter @message like /error/i
| sort @timestamp desc

# Find specific Lambda invocations
fields @timestamp, @message
| filter @logStream like /ListFiles/
| sort @timestamp desc

# Find slow operations
fields @timestamp, @message, @duration
| filter @duration > 5000
| sort @duration desc
```

## Best Practices

### Do's
- Log incoming events: `logInfo('event <=', event)`
- Log key operations with arrow notation for clarity
- Include relevant context in the object parameter
- Use logDebug for detailed diagnostics

### Don'ts
- Don't log sensitive data (passwords, tokens, PII)
- Don't log in tight loops
- Don't log entire large objects

## Related Patterns

- [X-Ray Integration](X-Ray-Integration.md) - Tracing with trace IDs
- [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) - Handler patterns
- [Error Handling](../TypeScript/Error-Handling.md) - Error logging

---

*Use the provided logging functions for consistent CloudWatch logging.*