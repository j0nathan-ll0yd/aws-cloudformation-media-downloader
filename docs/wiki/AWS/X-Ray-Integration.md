# X-Ray Integration (via ADOT Layer)

## Quick Reference
- **When to use**: All Lambda functions for distributed tracing
- **Enforcement**: Automatic via ADOT Lambda layer
- **Impact if violated**: LOW - Reduced visibility

## Architecture Overview

Distributed tracing is provided by the **AWS Distro for OpenTelemetry (ADOT)** Lambda layer, which:
- Automatically instruments AWS SDK calls
- Propagates X-Ray trace context
- Sends telemetry to X-Ray without code changes
- Requires no manual SDK initialization

## ADOT Layer Configuration

All Lambda functions include the ADOT layer via Terraform:

```hcl
locals {
  adot_layer_arn = "arn:aws:lambda:${data.aws_region.current.name}:901920570463:layer:aws-otel-nodejs-amd64-ver-1-30-2:1"

  # Common environment variables for all lambdas
  common_lambda_env = {
    OTEL_LOG_LEVEL              = "warn"  # Suppress INFO startup/shutdown logs
    OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318"
    OTEL_PROPAGATORS            = "xray"
    NODE_OPTIONS                = "--no-deprecation"
    LOG_LEVEL                   = "DEBUG"
  }
}

resource "aws_lambda_function" "example" {
  layers = [local.adot_layer_arn]

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = merge(local.common_lambda_env, {
      OTEL_SERVICE_NAME   = "ExampleLambda"
      # Lambda-specific variables...
    })
  }
}
```

## Lambda Handler Pattern

Use `withPowertools` wrapper for observability (handles logging, metrics):

```typescript
import {withPowertools} from '#lib/lambda/middleware/powertools'
import {wrapApiHandler} from '#lib/lambda/middleware/api'
import {buildValidatedResponse} from '#lib/lambda/responses'

export const handler = withPowertools(wrapApiHandler(async ({event, context, metadata}) => {
  // metadata.traceId available for correlation
  // ADOT automatically traces AWS SDK calls
  return buildValidatedResponse(context, 200, data)
}))
```

The ADOT layer automatically:
- Creates trace segments for Lambda invocations
- Traces AWS SDK calls (DynamoDB, S3, SNS, etc.)
- Propagates trace context to downstream services

## Trace ID in Logs

Trace IDs are automatically included in Powertools logs via the `injectLambdaContext` middleware:

```json
{
  "level": "INFO",
  "message": "request <=",
  "xray_trace_id": "1-abc123-def456",
  "function_name": "ListFiles",
  "cold_start": true
}
```

## Annotations and Metadata

For custom trace annotations, use OpenTelemetry APIs:

```typescript
import {trace} from '@opentelemetry/api'

const tracer = trace.getTracer('my-service')
const span = tracer.startSpan('downloadVideo')
span.setAttribute('url', url)
span.end()
```

- **Annotations** - Indexed, searchable (userId, operation)
- **Metadata** - Detailed info, not searchable (request body, response)

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `OTEL_LOG_LEVEL` | ADOT log verbosity | `warn` (suppresses startup noise) |
| `OTEL_PROPAGATORS` | Trace propagation format | `xray` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP exporter endpoint | `http://localhost:4318` |
| `OTEL_SERVICE_NAME` | Service name in traces | Lambda function name |

## Testing

ADOT layer is not loaded in tests. Mock the Powertools wrapper:

```typescript
jest.unstable_mockModule('#lib/lambda/middleware/powertools', () => ({
  withPowertools: (handler: any) => handler,
  logger: {info: jest.fn(), debug: jest.fn(), error: jest.fn()},
  metrics: {addMetric: jest.fn()}
}))
```

## Best Practices

✅ Use `withPowertools` wrapper for all Lambda handlers
✅ Use centralized `common_lambda_env` for consistent OTEL configuration
✅ Set `OTEL_LOG_LEVEL=warn` to suppress startup/shutdown noise
✅ Let ADOT auto-instrument AWS SDK calls (no manual wrapping needed)
✅ Include `OTEL_SERVICE_NAME` for each Lambda

## Related Patterns

- [CloudWatch Logging](CloudWatch-Logging.md) - Structured logging with Powertools
- [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) - Handler patterns

---

*Tracing is automatic via ADOT layer. Use withPowertools wrapper for observability.*