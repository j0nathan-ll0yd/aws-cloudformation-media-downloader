# Logging Strategy Assessment - January 2026

## Executive Summary

This document assesses the current AWS Lambda Powertools logging implementation across all Lambda handlers in the Media Downloader project. The assessment evaluates log level consistency, structured data inclusion, sensitive data handling, and correlation ID propagation.

**Key Finding**: Correlation ID propagation is already automatically handled by all middleware wrappers. The logging architecture is well-designed; improvements focus on consistent entry logging patterns and a single sensitive data fix.

---

## Architecture Overview

### Powertools Configuration

| Component | Location | Purpose |
|-----------|----------|---------|
| Logger Instance | `src/lib/vendor/Powertools/index.ts` | Centralized Logger with service name, log level, persistent attributes |
| Middleware Wrapper | `src/lib/lambda/middleware/powertools.ts` | `withPowertools()` - adds context injection and cold start tracking |
| Correlation ID | `src/lib/lambda/correlation.ts` | Extracts/generates correlation IDs from various event types |
| Logging Utilities | `src/lib/system/logging.ts` | `logInfo()`, `logDebug()`, `logError()` with automatic PII sanitization |

### Correlation ID Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Lambda Invocation                            │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  withPowertools() - src/lib/lambda/middleware/powertools.ts         │
│  - Injects Lambda context (awsRequestId, functionName, etc.)        │
│  - Tracks cold starts                                                │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  wrapXxxHandler() - src/lib/lambda/middleware/api.ts                │
│  1. extractCorrelationId(event, context)                            │
│  2. logger.appendKeys({correlationId, traceId})                     │
│  3. Pass metadata: {traceId, correlationId} to handler              │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Handler Function                                                    │
│  - Access correlationId via metadata.correlationId                  │
│  - Use logDebug('HandlerName <=', {correlationId, ...input})        │
└─────────────────────────────────────────────────────────────────────┘
```

### Correlation ID Sources

Extracted from events in priority order (see `src/lib/lambda/correlation.ts`):

| Priority | Event Type | Source |
|----------|------------|--------|
| 1 | SQS | Message body: `_correlationId` or `correlationId` |
| 2 | API Gateway | Header: `X-Correlation-ID` (case-insensitive) |
| 3 | EventBridge | `event.detail._correlationId` or `event.detail.correlationId` |
| 4 | S3 | Generated UUID (no prior correlation context) |
| 5 | Fallback | Generated UUID for originating requests |

---

## Lambda Handler Audit

### Audit Matrix

| Lambda | Middleware | Correlation ID | Entry Logging | Sensitive Data | Status |
|--------|-----------|----------------|---------------|----------------|--------|
| ApiGatewayAuthorizer | Custom | N/A (authorizer) | Partial | DEBUG-level IP/UA | Document |
| CleanupExpiredRecords | wrapScheduledHandler | Auto | logInfo | Safe | Good |
| CloudfrontMiddleware | None (Edge) | N/A | N/A | N/A | Special |
| DeviceEvent | wrapApiHandler | Auto | logDebug | Safe | Good |
| ListFiles | wrapOptionalAuthHandler | Auto | Missing | Safe | **Improve** |
| LoginUser | wrapApiHandler | Auto | Missing | Sanitized | **Improve** |
| MigrateDSQL | wrapLambdaInvokeHandler | Auto | logInfo | Safe | Good |
| PruneDevices | wrapScheduledHandler | Auto | logInfo | Safe | Good |
| RefreshToken | wrapApiHandler | Auto | logInfo | Safe | Good |
| RegisterDevice | wrapOptionalAuthHandler | Auto | In helpers | Safe | **Improve** |
| RegisterUser | wrapApiHandler | Auto | logInfo | Sanitized | Good |
| S3ObjectCreated | wrapEventHandler | Auto | logInfo | Safe | Good |
| SendPushNotification | wrapSqsBatchHandler | Auto | logDebug | **targetArn** | **Fix** |
| StartFileUpload | wrapSqsBatchHandler | Auto | Rich | Safe | Reference |
| UserDelete | wrapAuthenticatedHandler | Auto | logDebug | Safe | Good |
| UserSubscribe | wrapAuthenticatedHandler | Auto | None | Safe | **Improve** |
| WebhookFeedly | wrapAuthenticatedHandler | Auto | Rich | Safe | Reference |

### Handler Categories

#### Reference Implementations (Use as Examples)
- **WebhookFeedly**: Rich structured logging with correlation ID in business logic
- **StartFileUpload**: Comprehensive entry/exit logging, error classification, metrics

#### Good (No Changes Needed)
- RegisterUser, RefreshToken, UserDelete, DeviceEvent, S3ObjectCreated, PruneDevices, CleanupExpiredRecords, MigrateDSQL
- Middleware handles correlation ID automatically; adequate logging for their purpose

#### Needs Entry Logging
- **ListFiles**: Has helper function logging but no handler-level entry log with correlationId
- **LoginUser**: Only logs on success; no entry log
- **RegisterDevice**: Has helper function logging but no handler-level entry log
- **UserSubscribe**: No logging at all; needs entry/exit logs

#### Sensitive Data Fix Required
- **SendPushNotification**: Logs `targetArn` (SNS endpoint ARN containing device token path)
  - Fix: Remove `targetArn` from log call; `deviceId` is sufficient for debugging

#### Special Cases
- **CloudfrontMiddleware**: Lambda@Edge cannot use Powertools layer or middleware
- **ApiGatewayAuthorizer**: Logs `clientIp`/`userAgent` at DEBUG level for test request detection; acceptable since DEBUG is not enabled in production

---

## Security Considerations

### PII Protection

All logging functions (`logInfo`, `logDebug`, `logError`) in `src/lib/system/logging.ts` automatically sanitize sensitive data via `sanitizeData()` from `src/util/security.ts`.

**Protected Patterns** (18+ field types):
- `authorization`, `token`, `password`, `apiKey`, `secret`
- `email`, `phoneNumber`, `name`, `ssn`, `creditCard`
- `certificate`, `appleDeviceIdentifier`

**Redaction**: All sensitive fields are replaced with `[REDACTED]`

### Sensitive Data Issues Found

| Handler | Issue | Severity | Resolution |
|---------|-------|----------|------------|
| SendPushNotification | Logs `targetArn` (SNS endpoint ARN) | Medium | Remove from log call |
| ApiGatewayAuthorizer | Logs `clientIp`/`userAgent` at DEBUG | Low | Acceptable (DEBUG disabled in prod) |

---

## Log Level Configuration

### Current Settings

| Environment | LOG_LEVEL | Source |
|-------------|-----------|--------|
| Production | DEBUG | `terraform/main.tf` (lines 47-64) |
| Unit Tests | SILENT | `test/setup.ts` |
| Integration Tests | SILENT | `test/integration/globalSetup.ts` |

**Note**: LOG_LEVEL=DEBUG is currently set globally. For production, this provides maximum visibility during development but should be changed to INFO when the system is stable.

### Log Level Semantics

| Level | Purpose | Production Visibility |
|-------|---------|----------------------|
| ERROR | Error conditions | Always |
| WARN | Warnings | Always |
| INFO | Standard flow, success messages | Always |
| DEBUG | Detailed diagnostics, entry/exit traces | Development only |
| SILENT | Suppress all logs (testing) | Never |

---

## Recommendations

### Implemented in This PR

1. **Add entry logging to 4 handlers**: ListFiles, LoginUser, RegisterDevice, UserSubscribe
   - Pattern: `const {correlationId} = metadata; logDebug('HandlerName <=', {correlationId, ...})`

2. **Fix sensitive data in SendPushNotification**
   - Remove `targetArn` from log call (line 63)

### Future Considerations

1. **LOG_LEVEL for Production**: Consider changing to INFO when system is stable
2. **Metrics Consistency**: Audit which handlers use `enableCustomMetrics: true`
3. **CloudfrontMiddleware**: Cannot be improved due to Lambda@Edge restrictions

---

## CloudWatch Retention

All Lambda log groups have **7-day retention** configured in Terraform:

```hcl
resource "aws_cloudwatch_log_group" "LambdaName" {
  name              = "/aws/lambda/${aws_lambda_function.LambdaName.function_name}"
  retention_in_days = 7
  tags              = local.common_tags
}
```

---

## Related Documentation

- [CloudWatch Logging](../AWS/CloudWatch-Logging.md) - Full logging architecture guide
- [PII Protection](../TypeScript/PII-Protection.md) - Security patterns for data sanitization
- [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) - Handler middleware patterns

---

*Assessment conducted January 2026*
