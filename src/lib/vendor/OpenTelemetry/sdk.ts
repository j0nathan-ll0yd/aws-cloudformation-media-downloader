/**
 * OpenTelemetry SDK Initializer for AWS Lambda
 *
 * Initializes the OpenTelemetry SDK with configuration for:
 * - AWS X-Ray trace ID format and propagation
 * - OTLP exporter (sends to ADOT collector sidecar)
 * - Automatic AWS SDK v3 instrumentation
 *
 * Call initializeTracing() once per Lambda cold start.
 *
 * @see https://aws-otel.github.io/docs/getting-started/lambda/lambda-js/
 */
import {NodeTracerProvider} from '@opentelemetry/sdk-trace-node'
import {Resource} from '@opentelemetry/resources'
import {ATTR_SERVICE_NAME} from '@opentelemetry/semantic-conventions'
import {OTLPTraceExporter} from '@opentelemetry/exporter-trace-otlp-proto'
import {AWSXRayPropagator} from '@opentelemetry/propagator-aws-xray'
import {AWSXRayIdGenerator} from '@opentelemetry/id-generator-aws-xray'
import {BatchSpanProcessor} from '@opentelemetry/sdk-trace-base'
import {AwsInstrumentation} from '@opentelemetry/instrumentation-aws-sdk'
import {registerInstrumentations} from '@opentelemetry/instrumentation'

let initialized = false

/**
 * Initialize OpenTelemetry tracing for Lambda
 *
 * This function is idempotent - calling it multiple times has no effect.
 * It should be called at the start of each Lambda invocation (withPowertools handles this).
 *
 * Tracing is disabled when:
 * - USE_LOCALSTACK=true (LocalStack doesn't support tracing)
 * - ENABLE_XRAY=false (explicitly disabled)
 */
export function initializeTracing(): void {
  // Only initialize once per cold start
  if (initialized) {
    return
  }

  // Skip initialization if tracing is disabled
  if (process.env.USE_LOCALSTACK === 'true') {
    initialized = true
    return
  }

  if (process.env.ENABLE_XRAY === 'false') {
    initialized = true
    return
  }

  const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME || 'unknown'

  // Create resource with Lambda metadata
  // Note: cloud.* and faas.* attributes are experimental in @opentelemetry/semantic-conventions
  const resource = new Resource({[ATTR_SERVICE_NAME]: functionName, 'cloud.provider': 'aws', 'cloud.platform': 'aws_lambda', 'faas.name': functionName})

  // Create provider with X-Ray compatible ID generator
  const provider = new NodeTracerProvider({resource, idGenerator: new AWSXRayIdGenerator()})

  // Configure OTLP exporter to send to ADOT collector sidecar
  // The ADOT Lambda layer runs a collector on localhost:4318
  const exporter = new OTLPTraceExporter({url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces'})

  // Use BatchSpanProcessor for efficient trace export
  provider.addSpanProcessor(new BatchSpanProcessor(exporter))

  // Register with X-Ray propagator for trace context propagation
  provider.register({propagator: new AWSXRayPropagator()})

  // Register AWS SDK v3 auto-instrumentation
  // This automatically traces all AWS SDK calls (DynamoDB, S3, SQS, etc.)
  registerInstrumentations({instrumentations: [new AwsInstrumentation()]})

  initialized = true
}

/**
 * Check if tracing has been initialized
 * Useful for testing and debugging
 */
export function isTracingInitialized(): boolean {
  return initialized
}

/**
 * Reset initialization state (for testing only)
 * @internal
 */
export function resetTracingForTest(): void {
  initialized = false
}
