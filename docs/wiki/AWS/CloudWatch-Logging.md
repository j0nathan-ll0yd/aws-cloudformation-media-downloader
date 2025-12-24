# CloudWatch Logging

## Quick Reference
- **When to use**: All Lambda functions
- **Enforcement**: Required via Powertools middleware
- **Impact if violated**: MEDIUM - Poor observability

## Logging Architecture

The project uses **AWS Lambda Powertools** for structured JSON logging with automatic context enrichment. All logs are enhanced with:
- Lambda request ID
- Cold start indicators
- X-Ray trace IDs (via ADOT layer)
- Service name

## Logging Functions

Core logging functions are in `src/lib/system/logging.ts`:

```typescript
import {logInfo, logDebug, logError} from '#lib/system/logging'

logInfo(message: string, data?: string | object): void
logDebug(message: string, data?: string | object): void
logError(message: string, data?: string | Error | object): void
```

- **logInfo**: Standard functionality and flow (INFO level)
- **logDebug**: Detailed diagnostic information (DEBUG level, controlled by LOG_LEVEL)
- **logError**: Error conditions (ERROR level)

All logging functions automatically sanitize PII via `sanitizeData()`.

## Request Logging Pattern

For incoming requests, use the consolidated logging in middleware wrappers:

```typescript
import {logIncomingFixture} from '#lib/system/observability'
import {getRequestSummary} from '#lib/system/logging'

// Middleware automatically logs compact request summary (~150 bytes)
// Full event details available in DEBUG mode or via X-Ray traces
logInfo('request <=', getRequestSummary(event))
```

The `getRequestSummary()` helper extracts essential fields:
- `path` - API path or resource
- `method` - HTTP method
- `requestId` - API Gateway request ID
- `sourceIp` - Client IP address

## Log Levels

Controlled by `LOG_LEVEL` environment variable:

| Level | When to Use | Production Default |
|-------|-------------|-------------------|
| ERROR | Error conditions only | ✓ Always shown |
| WARN | Warnings and errors | ✓ Always shown |
| INFO | Standard flow + above | ✓ Default |
| DEBUG | Detailed diagnostics | Development only |

## CloudWatch Insights Queries

```sql
# Find errors
fields @timestamp, @message
| filter level = 'ERROR'
| sort @timestamp desc

# Find specific Lambda invocations
fields @timestamp, @message
| filter @logStream like /ListFiles/
| sort @timestamp desc

# Find slow operations
fields @timestamp, @message, @duration
| filter @duration > 5000
| sort @duration desc

# Find requests by path
fields @timestamp, path, method, requestId
| filter path like /files/
| sort @timestamp desc
```

## Best Practices

### Do's
- Use middleware wrappers - they handle request logging automatically
- Use `logDebug` for detailed diagnostics (only shown when LOG_LEVEL=DEBUG)
- Include relevant context in the data parameter
- Use `getRequestSummary()` for compact request logging

### Don'ts
- Don't log sensitive data (passwords, tokens, PII) - sanitization is automatic
- Don't log entire large objects at INFO level
- Don't bypass Powertools logging (use `logInfo`/`logDebug`/`logError`)

## ADOT Layer Integration

Tracing is handled by the **AWS Distro for OpenTelemetry (ADOT)** Lambda layer:
- Automatic X-Ray trace propagation
- AWS SDK auto-instrumentation
- No manual SDK initialization required

ADOT log noise is suppressed via `OTEL_LOG_LEVEL=warn` in Lambda environment.

## Related Patterns

- [X-Ray Integration](X-Ray-Integration.md) - Distributed tracing via ADOT
- [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) - Handler patterns with Powertools
- [PII Protection](../TypeScript/PII-Protection.md) - Automatic PII sanitization

---

*Use Powertools logging functions for structured CloudWatch logs with automatic PII sanitization.*