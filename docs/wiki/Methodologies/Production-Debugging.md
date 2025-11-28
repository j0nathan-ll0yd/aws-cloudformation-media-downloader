# Production Debugging

## Quick Reference
- **When to use**: Investigating production issues
- **Enforcement**: Recommended
- **Impact if violated**: MEDIUM - Longer resolution time

## Debugging Tools

1. **CloudWatch Logs** - Real-time logs and search
2. **X-Ray** - Distributed tracing (via withXRay wrapper)
3. **CloudWatch Insights** - SQL-like log analysis
4. **GitHub Issues** - Automated error reporting

## Common Issues & Solutions

### Lambda Timeout
```sql
-- CloudWatch Insights query
fields @timestamp, @duration, @message
| filter @message like /Task timed out/
| stats max(@duration) as max_duration
```

**Fix**: Use parallel processing with `Promise.all()` instead of serial loops

### Memory Exhaustion
```sql
-- Check memory usage
fields @timestamp, @maxMemoryUsed/@memorySize as memory_percentage
| filter @type = "REPORT" and memory_percentage > 0.9
```

**Fix**: Stream large files instead of loading into memory

### DynamoDB Throttling
```sql
-- Find throttled requests
fields @timestamp, @message
| filter @message like /ProvisionedThroughputExceededException/
| stats count() by bin(@timestamp, 5m)
```

**Fix**: Implement exponential backoff and batch operations

### API Gateway 502 Errors
```sql
-- Find integration failures
fields @timestamp, method, resource
| filter status = 502
| stats count() by resource
```

**Fix**: Ensure Lambda returns proper API Gateway response format

## X-Ray Integration

All Lambdas use the withXRay wrapper for automatic tracing:

```typescript
export const handler = withXRay(async (event, context, {traceId}) => {
  logInfo('event <=', event)
  // traceId available for correlation
})
```

## Quick Commands

```bash
# Recent errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/FunctionName \
  --filter-pattern ERROR

# X-Ray traces
aws xray get-trace-summaries \
  --time-range-type LastHour \
  --query "TraceSummaries[?ErrorRootCauses]"

# Lambda metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=ProcessFile
```

## Performance Optimization

1. **Cold Starts** - Check duration for first invocation
2. **Memory Allocation** - Monitor @maxMemoryUsed
3. **Concurrent Executions** - Check throttling metrics
4. **External API Calls** - Add timeouts and retries

## Error Patterns

| Error | Cause | Solution |
|-------|-------|----------|
| Task timed out | Long-running operation | Increase timeout or optimize |
| Runtime exited | Memory exhaustion | Increase memory or stream data |
| AccessDenied | IAM permissions | Check Lambda execution role |
| ECONNREFUSED | Network issue | Verify endpoints and security groups |

## Related Patterns

- [CloudWatch Logging](../AWS/CloudWatch-Logging.md) - Logging setup
- [X-Ray Integration](../AWS/X-Ray-Integration.md) - Tracing details
- [Error Handling](../TypeScript/TypeScript-Error-Handling.md) - Error patterns

---

*Use CloudWatch Insights for log analysis, X-Ray for tracing, and monitor key metrics for production debugging.*