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

## Accessing Lambda Logs from CLI

### Log Group Naming Convention

All Lambda log groups follow the pattern `/aws/lambda/{FunctionName}`. Log groups are defined in Terraform alongside each Lambda function:

```hcl
# Example from terraform/list_files.tf
resource "aws_cloudwatch_log_group" "ListFiles" {
  name              = "/aws/lambda/${aws_lambda_function.ListFiles.function_name}"
  retention_in_days = 14
}
```

### Lambda Log Groups Reference

| Lambda | Log Group | Terraform File |
|--------|-----------|----------------|
| ApiGatewayAuthorizer | `/aws/lambda/ApiGatewayAuthorizer` | api_gateway_authorizer.tf |
| FileCoordinator | `/aws/lambda/FileCoordinator` | file_coordinator.tf |
| ListFiles | `/aws/lambda/ListFiles` | list_files.tf |
| LogClientEvent | `/aws/lambda/LogClientEvent` | log_client_event.tf |
| LoginUser | `/aws/lambda/LoginUser` | login_user.tf |
| PruneDevices | `/aws/lambda/PruneDevices` | prune_devices.tf |
| RefreshToken | `/aws/lambda/RefreshToken` | refresh_token.tf |
| RegisterDevice | `/aws/lambda/RegisterDevice` | register_device.tf |
| RegisterUser | `/aws/lambda/RegisterUser` | register_user.tf |
| S3ObjectCreated | `/aws/lambda/S3ObjectCreated` | file_bucket.tf |
| SendPushNotification | `/aws/lambda/SendPushNotification` | send_push_notification.tf |
| StartFileUpload | `/aws/lambda/StartFileUpload` | feedly_webhook.tf |
| UserDelete | `/aws/lambda/UserDelete` | user_delete.tf |
| UserSubscribe | `/aws/lambda/UserSubscribe` | user_subscribe.tf |
| WebhookFeedly | `/aws/lambda/WebhookFeedly` | feedly_webhook.tf |

### CLI Commands for Log Access

```bash
# Tail logs in real-time (last 10 minutes)
aws logs tail /aws/lambda/ApiGatewayAuthorizer --since 10m --follow --region us-west-2

# View recent logs without following
aws logs tail /aws/lambda/ListFiles --since 30m --format short --region us-west-2

# Filter for errors only
aws logs tail /aws/lambda/WebhookFeedly --since 1h --filter-pattern "ERROR" --region us-west-2

# Filter for specific request ID
aws logs tail /aws/lambda/LoginUser --since 1h --filter-pattern "abc123-request-id" --region us-west-2

# View logs from a specific time range
aws logs filter-log-events \
  --log-group-name /aws/lambda/FileCoordinator \
  --start-time $(date -v-1H +%s000) \
  --end-time $(date +%s000) \
  --region us-west-2

# Search across multiple log groups (useful after deployments)
for lambda in ApiGatewayAuthorizer ListFiles LoginUser; do
  echo "=== $lambda ==="
  aws logs tail /aws/lambda/$lambda --since 5m --format short --region us-west-2 | head -20
done
```

### Post-Deployment Log Verification

After deploying Lambda changes, verify logs to confirm expected behavior:

```bash
# Quick health check of key lambdas after deployment
aws logs tail /aws/lambda/ApiGatewayAuthorizer --since 5m --format short --region us-west-2

# Check for any errors after deployment
aws logs filter-log-events \
  --log-group-name /aws/lambda/ApiGatewayAuthorizer \
  --start-time $(date -v-5M +%s000) \
  --filter-pattern "ERROR" \
  --region us-west-2

# Verify OTEL deprecation warnings are suppressed
aws logs tail /aws/lambda/ApiGatewayAuthorizer --since 10m --region us-west-2 | grep -i "deprecated"
```

## JSON Log Format

### Why JSON?

Powertools Logger **always outputs structured JSON** regardless of Lambda's `log_format` setting. This is intentional:

**Plain Text Format (traditional):**
```
2024-10-27T19:17:45.586Z 79b4f56e INFO some log message
```

**JSON Format (Powertools):**
```json
{"level":"INFO","message":"some log message","timestamp":"2024-10-27T19:17:45.586Z","service":"LoginUser","xray_trace_id":"..."}
```

### Trade-offs

| Aspect | Plain Text | JSON (current) |
|--------|------------|----------------|
| Human readability | Better in raw logs | Requires parsing |
| Searchability | Regex-based | Field-based queries |
| CloudWatch Insights | Limited | Full field discovery |
| Log size | Smaller | ~20% larger |
| Structured data | Difficult | Native support |

### Why JSON Was Chosen

1. **CloudWatch Logs Insights** auto-discovers JSON fields - you can filter by `level`, `message`, `requestId`, etc.
2. **Correlation**: X-Ray trace IDs, request IDs, and service names are automatically included
3. **Context enrichment**: Cold start indicators, Lambda context, custom attributes
4. **AWS recommendation**: [AWS recommends JSON format](https://docs.aws.amazon.com/lambda/latest/dg/monitoring-cloudwatchlogs-logformat.html) for production Lambda functions

### Working with JSON Logs

**In CloudWatch Console:**
- Use **Logs Insights** tab instead of raw log streams
- Click fields in the sidebar to auto-filter
- JSON fields are auto-indexed for fast queries

**Quick Filtering:**
```sql
-- Filter by log level
fields @timestamp, message, level
| filter level = "ERROR"
| sort @timestamp desc

-- Filter by service
fields @timestamp, message
| filter service = "LoginUser"
| sort @timestamp desc
```

**For Local Development:**
Set `POWERTOOLS_DEV=true` to pretty-print JSON (multi-line with indentation).

### Reference
- [AWS Lambda Log Format Documentation](https://docs.aws.amazon.com/lambda/latest/dg/monitoring-cloudwatchlogs-logformat.html)
- [Powertools Logger Documentation](https://docs.aws.amazon.com/powertools/typescript/latest/core/logger/)
- [CloudWatch Logs Insights Query Syntax](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_QuerySyntax.html)

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