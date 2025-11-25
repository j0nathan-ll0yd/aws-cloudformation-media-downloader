# Production Debugging

## Quick Reference
- **When to use**: Investigating production issues, performance problems, errors
- **Enforcement**: Recommended procedures and tools
- **Impact if violated**: MEDIUM - Longer resolution time, missed root causes

## Overview

Systematic approach to debugging production AWS Lambda issues using CloudWatch Logs, X-Ray tracing, CloudWatch Insights, and automated error reporting. Focus on quick identification, root cause analysis, and resolution.

## Available Tools

### 1. CloudWatch Logs

Real-time log streaming and historical search.

### 2. AWS X-Ray

Distributed tracing across services.

### 3. CloudWatch Insights

SQL-like log analysis.

### 4. CloudWatch Metrics

Performance and error metrics.

### 5. GitHub Issues

Automated error reporting from production.

## Common Debugging Scenarios

### Scenario 1: Lambda Timeout

**Symptoms**:
- Function duration equals timeout value
- "Task timed out" error message
- Incomplete processing

**Investigation Steps**:

1. **Check CloudWatch Logs**:
```bash
# Find timeout errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/ProcessFile \
  --filter-pattern "Task timed out" \
  --start-time $(date -d '1 hour ago' +%s)000
```

2. **Analyze with CloudWatch Insights**:
```sql
fields @timestamp, @duration, @message
| filter @message like /Task timed out/
| stats avg(@duration) as avg_duration,
        max(@duration) as max_duration,
        count() as timeout_count
| sort @timestamp desc
```

3. **Check X-Ray Traces** (using withXRay wrapper):
```typescript
// All Lambda handlers use withXRay for automatic tracing
export const handler = withXRay(async (event, context, {traceId}) => {
  logInfo('event <=', event)
  // traceId is automatically extracted from X-Ray segment

  // Add custom subsegment for specific operation
  const segment = getSegment()
  const subsegment = segment?.addNewSubsegment('database-operation')

  try {
    await performDatabaseOperation()
  } finally {
    subsegment?.close()
  }
})
```

4. **Common Causes and Fixes**:
```typescript
// ❌ Problem: Synchronous operations
for (const item of largeArray) {
  await processItem(item)  // Serial processing
}

// ✅ Fix: Parallel processing
await Promise.all(
  largeArray.map(item => processItem(item))
)

// ❌ Problem: No timeout on external calls
const response = await fetch(url)

// ✅ Fix: Add timeout
const response = await fetch(url, {
  signal: AbortSignal.timeout(5000)
})
```

### Scenario 2: Memory Exhaustion

**Symptoms**:
- "Runtime exited with error: signal: killed"
- Memory usage equals allocated memory
- Sudden function termination

**Investigation Steps**:

1. **Check Memory Metrics**:
```sql
-- CloudWatch Insights query
fields @timestamp, @memorySize, @maxMemoryUsed
| filter @type = "REPORT"
| stats max(@maxMemoryUsed/@memorySize) as memory_percentage
| filter memory_percentage > 0.9
```

2. **Identify Memory Leaks**:
```typescript
// Add memory logging
console.log('Memory Usage:', process.memoryUsage())

// Track over time
setInterval(() => {
  const usage = process.memoryUsage()
  console.log('Heap Used:', usage.heapUsed / 1024 / 1024, 'MB')
}, 1000)
```

3. **Common Causes and Fixes**:
```typescript
// ❌ Problem: Loading large files into memory
const fileContent = await s3.getObject({
  Bucket: bucket,
  Key: largeFile
}).promise()

// ✅ Fix: Use streaming
const stream = s3.getObject({
  Bucket: bucket,
  Key: largeFile
}).createReadStream()

stream.pipe(processStream)

// ❌ Problem: Not clearing global variables
let cache = []
exports.handler = async () => {
  cache.push(newData)  // Grows with each invocation
}

// ✅ Fix: Clear between invocations
exports.handler = async () => {
  cache = []  // Reset each time
  cache.push(newData)
}
```

### Scenario 3: DynamoDB Throttling

**Symptoms**:
- ProvisionedThroughputExceededException
- Increased latency
- Retry storms

**Investigation Steps**:

1. **Check Throttling Metrics**:
```bash
# CloudWatch metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name UserErrors \
  --dimensions Name=TableName,Value=MediaDownloader \
  --statistics Sum \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-01T23:59:59Z \
  --period 300
```

2. **Analyze Request Patterns**:
```sql
-- CloudWatch Insights
fields @timestamp, operation, table_name
| filter @message like /ProvisionedThroughputExceededException/
| stats count() by bin(@timestamp, 5m) as time_bucket
| sort time_bucket desc
```

3. **X-Ray Service Map**:
```typescript
// Check DynamoDB segment errors
const serviceMap = await xray.getServiceMap({
  startTime: new Date(Date.now() - 3600000),
  endTime: new Date()
})

// Find throttled operations
serviceMap.services
  .filter(s => s.name === 'DynamoDB')
  .forEach(service => {
    console.log('Throttle rate:', service.responseTimeHistogram.throttle)
  })
```

4. **Fixes**:
```typescript
// ✅ Implement exponential backoff
const backoff = require('exponential-backoff')

async function dynamoOperation(params) {
  return backoff.backOff(() =>
    dynamodb.query(params).promise(),
    {
      numOfRetries: 5,
      startingDelay: 100,
      maxDelay: 5000
    }
  )
}

// ✅ Use batch operations
const batchWrite = async (items) => {
  const chunks = chunk(items, 25)  // DynamoDB batch limit

  for (const batch of chunks) {
    await dynamodb.batchWriteItem({
      RequestItems: {
        TableName: batch
      }
    }).promise()
  }
}
```

### Scenario 4: API Gateway 502 Errors

**Symptoms**:
- Client receives 502 Bad Gateway
- Lambda throws unhandled error
- Malformed response

**Investigation Steps**:

1. **Check Lambda Errors**:
```sql
-- CloudWatch Insights
fields @timestamp, @message
| filter @message like /Error/
  or @message like /Exception/
  or @message like /Traceback/
| sort @timestamp desc
| limit 20
```

2. **Verify Response Format**:
```typescript
// ❌ Problem: Throwing error in API Gateway Lambda
export const handler = async (event) => {
  if (!event.body) {
    throw new Error('Missing body')  // Causes 502
  }
}

// ✅ Fix: Return proper response
export const handler = async (event) => {
  if (!event.body) {
    return {
      statusCode: 400,
      body: JSON.stringify({error: 'Missing body'})
    }
  }
}
```

3. **Check Integration Response**:
```bash
# API Gateway logs
aws logs filter-log-events \
  --log-group-name API-Gateway-Execution-Logs \
  --filter-pattern "502" \
  --start-time $(date -d '1 hour ago' +%s)000
```

## CloudWatch Insights Queries

### Performance Analysis

```sql
-- Function duration percentiles
fields @type, @duration
| filter @type = "REPORT"
| stats pct(@duration, 50) as p50,
        pct(@duration, 95) as p95,
        pct(@duration, 99) as p99,
        max(@duration) as max
```

### Error Tracking

```sql
-- Error frequency by type
fields @timestamp, @message
| filter @message like /Error|Exception/
| parse @message /(?<error_type>\w+Error|\w+Exception)/
| stats count() by error_type
| sort count() desc
```

### Cold Start Analysis

```sql
-- Cold start frequency and duration
fields @type, @duration, @initDuration
| filter @type = "REPORT" and ispresent(@initDuration)
| stats count() as cold_starts,
        avg(@initDuration) as avg_init,
        max(@initDuration) as max_init
```

### Memory Usage Patterns

```sql
-- Memory usage over time
fields @timestamp, @maxMemoryUsed, @memorySize
| filter @type = "REPORT"
| stats avg(@maxMemoryUsed) as avg_used,
        max(@maxMemoryUsed) as max_used,
        avg(@maxMemoryUsed/@memorySize) as avg_percentage
| sort @timestamp desc
```

## X-Ray Tracing Patterns

### Enable Tracing

```typescript
// lib/vendor/AWS/XRay.ts
import * as AWSXRay from 'aws-xray-sdk-core'

export function withXRay(handler) {
  return async (event, context) => {
    const segment = AWSXRay.getSegment()
    const traceId = segment?.trace_id || 'no-trace'

    try {
      // Add trace ID to all logs
      console.log = console.log.bind(console, `[${traceId}]`)

      return await handler(event, context, {traceId})
    } catch (error) {
      segment?.addError(error)
      throw error
    }
  }
}
```

### Correlate Logs with Traces

```typescript
// Find logs for specific trace
const traceId = '1-5e1b4c3d-1234567890abcdef'

// CloudWatch Insights
const query = `
  fields @timestamp, @message
  | filter @message like /${traceId}/
  | sort @timestamp desc
`

// Get full trace
const trace = await xray.getTraceDetails({
  traceId: traceId
})
```

### Custom Subsegments

```typescript
// Track specific operations
const subsegment = segment.addNewSubsegment('database-query')
try {
  const result = await dynamodb.query(params).promise()
  subsegment.addAnnotation('item_count', result.Count)
  return result
} catch (error) {
  subsegment.addError(error)
  throw error
} finally {
  subsegment.close()
}
```

## Automated Error Reporting

### GitHub Issue Creation

```typescript
// util/error-reporter.ts
export async function reportError(error: Error, context: any) {
  const issue = {
    title: `Production Error: ${error.name}`,
    body: `
## Error Details
- **Message**: ${error.message}
- **Stack**: \`\`\`${error.stack}\`\`\`
- **Function**: ${context.functionName}
- **Request ID**: ${context.awsRequestId}
- **Time**: ${new Date().toISOString()}

## CloudWatch Logs
[View Logs](https://console.aws.amazon.com/cloudwatch/home?region=${process.env.AWS_REGION}#logsV2:log-groups/log-group/${context.logGroupName})

## X-Ray Trace
[View Trace](https://console.aws.amazon.com/xray/home?region=${process.env.AWS_REGION}#/traces/${context.traceId})
    `,
    labels: ['bug', 'production', 'auto-generated']
  }

  await github.createIssue(issue)
}
```

### Error Aggregation

```typescript
// Aggregate similar errors
interface ErrorPattern {
  pattern: RegExp
  count: number
  firstSeen: Date
  lastSeen: Date
  samples: string[]
}

const patterns: Map<string, ErrorPattern> = new Map()

export function aggregateError(error: Error) {
  const key = error.message.replace(/\d+/g, 'N')  // Normalize numbers

  if (patterns.has(key)) {
    const pattern = patterns.get(key)!
    pattern.count++
    pattern.lastSeen = new Date()
    pattern.samples.push(error.stack!)
  } else {
    patterns.set(key, {
      pattern: new RegExp(key),
      count: 1,
      firstSeen: new Date(),
      lastSeen: new Date(),
      samples: [error.stack!]
    })
  }
}
```

## Performance Profiling

### Lambda Power Tuning

```bash
# Use AWS Lambda Power Tuning
npm install -g aws-lambda-power-tuning

# Run tuning
npx aws-lambda-power-tuning \
  --function ProcessFile \
  --payload '{"test": "data"}' \
  --powerValues "128,256,512,1024,2048" \
  --num 10
```

### Profiling Code

```typescript
// Add performance marks
performance.mark('operation-start')

await expensiveOperation()

performance.mark('operation-end')
performance.measure('operation', 'operation-start', 'operation-end')

const measure = performance.getEntriesByName('operation')[0]
console.log(`Operation took ${measure.duration}ms`)
```

### Memory Profiling

```typescript
// Heap snapshot for memory analysis
import v8 from 'v8'
import fs from 'fs'

export function takeHeapSnapshot() {
  const snapshot = v8.writeHeapSnapshot()
  fs.writeFileSync('/tmp/heap.heapsnapshot', snapshot)

  // Upload to S3 for analysis
  await s3.putObject({
    Bucket: 'debug-snapshots',
    Key: `heap-${Date.now()}.heapsnapshot`,
    Body: snapshot
  }).promise()
}
```

## Debug Workflows

### Emergency Response

1. **Immediate Actions**:
```bash
# Check error rate
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=ProcessFile \
  --statistics Sum \
  --start-time $(date -d '15 minutes ago' +%s)000 \
  --end-time $(date +%s)000 \
  --period 60

# Recent logs
aws logs tail /aws/lambda/ProcessFile --follow
```

2. **Rollback if Needed**:
```bash
# Quick rollback to previous version
aws lambda update-function-code \
  --function-name ProcessFile \
  --s3-bucket deployments \
  --s3-key previous-version.zip
```

3. **Scale Down if Necessary**:
```bash
# Reduce concurrency to stop bleeding
aws lambda put-function-concurrency \
  --function-name ProcessFile \
  --reserved-concurrent-executions 1
```

### Root Cause Analysis

```typescript
// Structured RCA process
interface RootCauseAnalysis {
  incident: {
    start: Date
    end: Date
    impact: string
    severity: 'low' | 'medium' | 'high' | 'critical'
  }
  timeline: Array<{
    time: Date
    event: string
  }>
  rootCause: string
  contributingFactors: string[]
  resolution: string
  preventiveMeasures: string[]
}

const rca: RootCauseAnalysis = {
  incident: {
    start: new Date('2024-01-01T10:00:00Z'),
    end: new Date('2024-01-01T11:30:00Z'),
    impact: '500 failed file processes',
    severity: 'high'
  },
  timeline: [
    {time: new Date('10:00'), event: 'Deployment of v2.1.0'},
    {time: new Date('10:05'), event: 'First timeout errors'},
    {time: new Date('10:15'), event: 'Alert triggered'},
    {time: new Date('10:30'), event: 'Root cause identified'},
    {time: new Date('11:00'), event: 'Fix deployed'},
    {time: new Date('11:30'), event: 'System recovered'}
  ],
  rootCause: 'Synchronous S3 operations in loop',
  contributingFactors: [
    'No timeout on S3 calls',
    'Insufficient testing with large files',
    'No canary deployment'
  ],
  resolution: 'Implemented parallel processing',
  preventiveMeasures: [
    'Add integration tests for large files',
    'Implement canary deployments',
    'Add S3 operation timeouts'
  ]
}
```

## Monitoring Setup

### CloudWatch Alarms

```typescript
// terraform/monitoring.tf
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "ProcessFile-Errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name        = "Errors"
  namespace          = "AWS/Lambda"
  period             = "60"
  statistic          = "Sum"
  threshold          = "10"
  alarm_description  = "Lambda error rate too high"
  alarm_actions      = [aws_sns_topic.alerts.arn]

  dimensions = {
    FunctionName = aws_lambda_function.ProcessFile.function_name
  }
}
```

### Custom Metrics

```typescript
// Publish custom metrics
import {CloudWatch} from '@aws-sdk/client-cloudwatch'
const cloudwatch = new CloudWatch()

export async function publishMetric(name: string, value: number) {
  await cloudwatch.putMetricData({
    Namespace: 'MediaDownloader',
    MetricData: [{
      MetricName: name,
      Value: value,
      Unit: 'Count',
      Timestamp: new Date(),
      Dimensions: [{
        Name: 'Environment',
        Value: process.env.STAGE || 'dev'
      }]
    }]
  }).promise()
}

// Usage
await publishMetric('FilesProcessed', 1)
await publishMetric('ProcessingDuration', duration)
```

## Debug Tools

### Local Testing

```bash
# SAM Local for Lambda testing
sam local invoke ProcessFile \
  --event event.json \
  --env-vars env.json \
  --debug

# LocalStack for AWS services
localstack start
aws --endpoint-url=http://localhost:4566 \
  lambda invoke \
  --function-name ProcessFile \
  --payload file://event.json \
  response.json
```

### Log Analysis Scripts

```bash
#!/bin/bash
# scripts/analyze-errors.sh

LOG_GROUP="/aws/lambda/ProcessFile"
PATTERN="ERROR"
HOURS_AGO=1

# Get recent errors
aws logs filter-log-events \
  --log-group-name $LOG_GROUP \
  --filter-pattern $PATTERN \
  --start-time $(date -d "$HOURS_AGO hours ago" +%s)000 \
  | jq '.events[].message' \
  | sort | uniq -c | sort -rn
```

## Best Practices

### Logging

```typescript
// Structured logging
const log = {
  level: 'ERROR',
  message: 'Failed to process file',
  error: error.message,
  stack: error.stack,
  context: {
    fileId: event.fileId,
    userId: event.userId,
    traceId: context.traceId
  }
}
console.error(JSON.stringify(log))
```

### Error Handling

```typescript
// Comprehensive error information
class DetailedError extends Error {
  constructor(
    message: string,
    public code: string,
    public context: any,
    public cause?: Error
  ) {
    super(message)
    this.name = 'DetailedError'
  }
}

throw new DetailedError(
  'Failed to process file',
  'FILE_PROCESSING_ERROR',
  {fileId, userId, operation: 'download'},
  originalError
)
```

## Related Patterns

- [Error Handling](../TypeScript/Error-Handling.md) - Proper error handling patterns
- [CloudWatch Logging](../AWS/CloudWatch-Logging.md) - Structured logging
- [X-Ray Integration](../AWS/X-Ray-Integration.md) - Distributed tracing setup
- [Lambda Patterns](../TypeScript/Lambda-Function-Patterns.md) - Lambda best practices

## Enforcement

- **Monitoring**: CloudWatch alarms for error rates
- **Alerting**: PagerDuty/Slack for critical issues
- **Documentation**: RCA for all production incidents
- **Automation**: Auto-create GitHub issues for errors

---

*Debug systematically, monitor proactively, resolve quickly.*