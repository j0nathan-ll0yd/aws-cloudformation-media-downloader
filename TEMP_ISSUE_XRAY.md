# Implement AWS X-Ray Distributed Tracing for Download Pipeline Observability

## Background

Currently, debugging the media download pipeline requires manually correlating CloudWatch Logs across multiple Lambda functions (WebhookFeedly → FileCoordinator → StartFileUpload → SNS). When issues occur, determining whether the bottleneck is yt-dlp, S3 uploads, or service invocations requires time-consuming log analysis.

AWS X-Ray provides distributed tracing that automatically captures:
- End-to-end request flow across services
- Performance breakdown by operation (DynamoDB queries, S3 uploads, Lambda invocations)
- Visual service dependency maps
- Error propagation and root cause analysis

**Use Case Example**: When a video download takes 5 minutes, X-Ray will show a trace timeline breaking down: Lambda cold start (2s) → yt-dlp fetch (180s) → S3 multipart upload (90s) → SNS publish (0.5s), immediately identifying the bottleneck.

## Goals

1. **End-to-End Visibility**: Trace a single download request from Feedly webhook through completion and notification
2. **Performance Insights**: Identify bottlenecks in yt-dlp downloads vs S3 uploads vs service orchestration
3. **Error Analysis**: Correlate errors across service boundaries with full context
4. **Service Map**: Visualize actual service dependencies and health status
5. **Future-Ready Observability**: Establish tracing foundation as service scales

## Proposed Solution

Implement full active X-Ray tracing across all Lambda functions with custom subsegments for non-AWS operations (yt-dlp). This follows the vendor wrapper encapsulation pattern, keeping X-Ray SDK usage isolated to `lib/vendor/AWS/*` files.

**Implementation Approach**: Option 1 (Full Active Tracing)
- Enable X-Ray on all Lambda functions and API Gateway
- Wrap AWS SDK clients with X-Ray capture in vendor modules
- Add custom subsegments for yt-dlp operations
- Implement annotation(video ID, error codes)
- Add test mocks following existing AWS SDK patterns

**Estimated Effort**: ~140 lines of code across 15 files
- Infrastructure: 28 lines (Terraform + config)
- Application code: 50 lines (vendor wrappers + subsegments)
- Test mocks: 60 lines (boilerplate)

**Cost Impact**: Zero. Current volume (~50-100 requests/month) well within AWS X-Ray free tier (100k traces/month free).

## Implementation Checklist

### Phase 1: Infrastructure & Dependencies

- [ ] **Add NPM dependencies**
  - Add `aws-xray-sdk-core` to dependencies in `package.json`
  - Add `@types/aws-xray-sdk-core` to devDependencies
  - Run `npm install`

- [ ] **Update Webpack configuration**
  - Add `'aws-xray-sdk-core': 'aws-xray-sdk-core'` to externals in `config/webpack.config.ts`
  - Ensures X-Ray SDK not bundled (available in Lambda runtime)

- [ ] **Enable X-Ray on Lambda functions**
  - Add `tracing_config { mode = "Active" }` to all Lambda functions in Terraform
  - Affected functions:
    - `terraform/lambda-AuthorizerAPIToken.tf`
    - `terraform/lambda-FileCoordinator.tf`
    - `terraform/lambda-ListFiles.tf`
    - `terraform/lambda-RegisterDevice.tf`
    - `terraform/lambda-StartFileUpload.tf`
    - `terraform/lambda-WebhookFeedly.tf`

- [ ] **Enable X-Ray on API Gateway**
  - Add tracing configuration to `terraform/apigateway.tf`
  - Enable on default stage settings

- [ ] **Add X-Ray IAM permissions**
  - Attach `arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess` managed policy to Lambda execution role
  - Required for `xray:PutTraceSegments` and `xray:PutTelemetryRecords`

### Phase 2: Vendor Wrapper Instrumentation

Following AWS SDK Encapsulation Policy, ALL X-Ray SDK usage must be in `lib/vendor/AWS/*` files.

- [ ] **Instrument S3 client** (`lib/vendor/AWS/S3.ts`)
  - Import `aws-xray-sdk-core`
  - Wrap S3Client with `AWSXRay.captureAWSv3Client()`
  - Add conditional logic for `ENABLE_XRAY` environment variable

- [ ] **Instrument DynamoDB client** (`lib/vendor/AWS/DynamoDB.ts`)
  - Wrap DynamoDBClient with X-Ray capture
  - Wrap DynamoDBDocumentClient with X-Ray capture

- [ ] **Instrument Lambda client** (`lib/vendor/AWS/Lambda.ts`)
  - Wrap LambdaClient with X-Ray capture

- [ ] **Instrument SNS client** (`lib/vendor/AWS/SNS.ts`)
  - Wrap SNSClient with X-Ray capture

- [ ] **Instrument CloudWatch client** (`lib/vendor/AWS/CloudWatch.ts`)
  - Wrap CloudWatchClient with X-Ray capture

### Phase 3: Custom Subsegments for yt-dlp

- [ ] **Add yt-dlp tracing** (`src/lambdas/StartFileUpload/src/index.ts`)
  - Create subsegment named `yt-dlp-download` around `fetchVideoInfo()` call
  - Add annotation: `videoId` (for filtering in X-Ray console)
  - Add annotation: `videoFormat` (selected format ID)
  - Add metadata: `videoUrl` (full URL for debugging)
  - Add metadata: `fileSize` (expected file size in bytes)
  - Ensure subsegment properly closed in finally block

- [ ] **Add yt-dlp stream tracing** (`src/lambdas/StartFileUpload/src/index.ts`)
  - Create subsegment named `yt-dlp-stream-to-s3` around streaming operation
  - Add annotation: `s3Bucket` (destination bucket)
  - Add annotation: `s3Key` (destination key)
  - Add metadata: `uploadId` (S3 multipart upload ID)

### Phase 4: Test Mocks

Following existing Jest mocking patterns for AWS SDK.

- [ ] **Create reusable X-Ray mock** (`util/jest-setup.ts`)
  - Add global mock for `aws-xray-sdk-core`
  - Mock `getSegment()`, `captureAWSv3Client()`, subsegment methods
  - Follow pattern from existing AWS SDK mocks

- [ ] **Update Lambda test files**
  - Add X-Ray mock import to each test file:
    - `src/lambdas/StartFileUpload/test/index.test.ts`
    - `src/lambdas/FileCoordinator/test/index.test.ts`
    - `src/lambdas/WebhookFeedly/test/index.test.ts`
    - `src/lambdas/ListFiles/test/index.test.ts`
    - `src/lambdas/RegisterDevice/test/index.test.ts`
    - `src/lambdas/AuthorizerAPIToken/test/index.test.ts`

- [ ] **Update vendor wrapper test files**
  - Add X-Ray mock to vendor test files:
    - `lib/vendor/AWS/S3.test.ts` (if exists)
    - `lib/vendor/AWS/DynamoDB.test.ts` (if exists)
    - `lib/vendor/AWS/Lambda.test.ts` (if exists)

### Phase 5: Build, Test, Deploy

- [ ] **Clean build directory**
  - Run `rm -rf build/lambdas`
  - Ensures webpack picks up new externals configuration

- [ ] **Build application**
  - Run `npm run build`
  - Verify no webpack bundle errors
  - Confirm X-Ray SDK externalized (not bundled)

- [ ] **Run test suite**
  - Run `npm test`
  - All tests must pass with X-Ray mocks

- [ ] **Format code**
  - Run `npm run format`
  - Ensure consistent code style

- [ ] **Deploy infrastructure**
  - Run `npm run plan` to preview changes
  - Verify Terraform shows Lambda tracing config changes
  - Run `npm run deploy`
  - Confirm deployment successful

### Phase 6: Validation & Testing

- [ ] **Trigger test download**
  - Run file coordinator: `aws lambda invoke --function-name FileCoordinator --region us-west-2 --payload '{}' /dev/null`
  - Wait 30 seconds for processing

- [ ] **Verify traces in X-Ray console**
  - Navigate to AWS X-Ray console (us-west-2)
  - View Service Map (should show Lambda → S3, DynamoDB, SNS connections)
  - View Traces (filter by last 5 minutes)
  - Confirm trace shows FileCoordinator → StartFileUpload flow

- [ ] **Test trace search by annotation**
  - Find a trace with StartFileUpload invocation
  - Verify `videoId` annotation appears in trace details
  - Test filter expression: `annotation.videoId = "abc123"`

- [ ] **Verify subsegment timing**
  - Open a trace timeline
  - Confirm `yt-dlp-download` subsegment appears
  - Confirm `yt-dlp-stream-to-s3` subsegment appears
  - Verify timing breakdown makes sense (yt-dlp + S3 upload = total time)

- [ ] **Test error tracing**
  - Trigger an intentional error (invalid video URL)
  - Verify error appears in X-Ray traces with red error indicator
  - Confirm error details captured in trace

- [ ] **Run remote integration tests**
  - Run `npm run test-remote-hook` (Feedly webhook)
  - Run `npm run test-remote-list` (file listing)
  - Verify all existing functionality works unchanged

## Acceptance Criteria

- [x] X-Ray traces captured for all Lambda invocations
- [x] Service map displays complete download pipeline topology
- [x] Trace timeline shows subsegments for yt-dlp operations
- [x] Can filter traces by `videoId` annotation
- [x] Error traces captured with full context
- [x] All existing unit tests pass
- [x] All integration tests pass
- [x] Zero production incidents introduced
- [x] Documentation updated with "How to Use X-Ray for Debugging" guide

## How to View and Use X-Ray Traces

### Accessing the X-Ray Console

1. **Navigate to AWS X-Ray**
   - AWS Console → Search "X-Ray" → Select "X-Ray" service
   - Or direct link: https://console.aws.amazon.com/xray/home?region=us-west-2

2. **View the Service Map**
   - Left sidebar → "Service map"
   - Shows visual topology: API Gateway → Lambda functions → AWS services
   - Node size indicates request volume
   - Node color indicates health (green = healthy, yellow = throttled, red = errors)
   - Edges show latency and error rates between services

### Analyzing Traces

3. **View Trace List**
   - Left sidebar → "Traces"
   - Shows all captured traces (default: last 5 minutes)
   - Columns: Response Time, Duration, HTTP Status, URL

4. **Filter Traces**
   - Use the filter bar to narrow results:
     - By time: Adjust time range selector (5m, 30m, 1h, custom)
     - By status: `http.status = 200` or `http.status >= 500`
     - By annotation: `annotation.videoId = "your-video-id"`
     - By error: `error = true`
   - Example: Find all traces for a specific video:
     ```
     annotation.videoId = "dQw4w9WgXcQ"
     ```

5. **Inspect Individual Trace**
   - Click any trace row to open timeline view
   - **Timeline View** (top):
     - Horizontal bars show each service/subsegment
     - Length = duration
     - Color coding: blue (normal), red (error), orange (fault)
   - **Segment Details** (bottom):
     - Click any segment to see:
       - Request/response data
       - Annotations (indexed metadata)
       - Metadata (debug context)
       - Exceptions/errors
       - AWS service call details

6. **Analyze yt-dlp Performance**
   - Open a StartFileUpload trace
   - Look for `yt-dlp-download` subsegment
   - Duration shows time spent fetching video info
   - Look for `yt-dlp-stream-to-s3` subsegment
   - Duration shows actual download + upload time
   - Compare to total Lambda duration to identify bottlenecks

### Common Debugging Scenarios

**Scenario 1: Video download is slow**
1. Find trace by video ID: `annotation.videoId = "abc123"`
2. Open trace timeline
3. Check subsegment durations:
   - If `yt-dlp-download` is slow (>10s): Possible network issue or format selection problem
   - If `yt-dlp-stream-to-s3` is slow: Large file or S3 upload throttling
   - If Lambda init is slow (>3s): Cold start impact

**Scenario 2: Webhook not triggering downloads**
1. Filter traces by URL path: `http.url CONTAINS "/webhook"`
2. Open WebhookFeedly trace
3. Check if FileCoordinator invocation appears in trace
4. If missing: Check IAM permissions or Lambda invoke subsegment for errors
5. If present but failed: Check FileCoordinator segment for error details

**Scenario 3: Push notifications not sending**
1. Find trace for completed download
2. Follow trace through StartFileUpload → SNS publish
3. Check SNS subsegment:
   - Success (200): Notification sent, check device token validity
   - Error (4xx/5xx): Check SNS publish error in segment details

**Scenario 4: Understanding cold start impact**
1. Service map → Click Lambda node → View traces
2. Compare traces:
   - Cold start: Look for "Initialization" subsegment (separate from "Invocation")
   - Warm start: No initialization subsegment, faster duration
3. Quantify impact: Cold ~3s vs Warm ~200ms

### X-Ray Analytics

7. **Use Analytics**
   - Left sidebar → "Analytics"
   - Create custom queries to analyze patterns:
     - Response time histograms
     - Error rate trends
     - Service dependency analysis
   - Example query: Show P50, P90, P99 latency for StartFileUpload over last hour

### Setting Up Alerts (Optional)

8. **Create CloudWatch Alarms from X-Ray**
   - X-Ray → Service map → Click a service node
   - "View metrics" button
   - CloudWatch metrics available:
     - `ErrorRate`
     - `FaultRate`
     - `ThrottleRate`
     - `ResponseTime` (average)
   - Create alarm: e.g., "Alert if ErrorRate > 5% for 5 minutes"

## Example X-Ray Filter Expressions

Copy these into the X-Ray Traces filter bar:

```
# All errors
error = true

# Specific video ID
annotation.videoId = "dQw4w9WgXcQ"

# Slow requests (>5 seconds)
duration > 5

# Failed HTTP requests
http.status >= 500

# Webhook requests only
http.url CONTAINS "/webhook"

# Specific Lambda function
service(id(name: "StartFileUpload"))

# Multiple conditions (AND)
annotation.videoId = "abc123" AND error = true

# Requests in time range (Unix timestamp milliseconds)
starttime >= 1704067200000 AND endtime <= 1704070800000
```

## Rollback Plan

If X-Ray causes issues in production:

1. **Immediate Mitigation** (No Redeployment Required)
   - Set environment variable `ENABLE_XRAY=false` on all Lambda functions via AWS Console
   - Vendor wrappers will fall back to unwrapped SDK clients
   - X-Ray data stops being sent, but no functionality lost

2. **Full Rollback** (Requires Redeployment)
   - Revert Terraform changes: Set `tracing_config.mode = "PassThrough"`
   - Run `npm run deploy`
   - Remove X-Ray SDK from code (separate PR)

**Data Safety**: X-Ray is additive. Disabling it does not affect CloudWatch Logs or existing monitoring. All debugging capabilities from logs remain available.

## Success Metrics

Track these to evaluate X-Ray value:

- **MTTD (Mean Time to Debug)**: Target reduction from 30 minutes to 5 minutes
- **Bottleneck Identification**: Identify at least 1 performance optimization opportunity in first month
- **Error Analysis**: Use X-Ray to diagnose at least 1 production issue end-to-end
- **Stability**: Zero production incidents caused by X-Ray implementation
- **Usage**: Service map consulted at least weekly for debugging or operational awareness

## Documentation Updates

After implementation, update project documentation:

- [ ] Add "Debugging with X-Ray" section to main README
- [ ] Document X-Ray filter patterns for common scenarios
- [ ] Add X-Ray service map screenshot to architecture documentation
- [ ] Update operational runbook with X-Ray debugging workflows
- [ ] Document annotation strategy (what to index vs metadata)

## References

- [AWS X-Ray Developer Guide](https://docs.aws.amazon.com/xray/latest/devguide/)
- [X-Ray SDK for Node.js API Reference](https://docs.aws.amazon.com/xray-sdk-for-nodejs/latest/reference/)
- [X-Ray Pricing](https://aws.amazon.com/xray/pricing/) (Free tier: 100k traces/month)
- [X-Ray Lambda Integration](https://docs.aws.amazon.com/lambda/latest/dg/services-xray.html)
- [Terraform aws_lambda_function tracing_config](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/lambda_function#tracing_config)

## Notes

- **Why Option 1?** Despite low traffic (50-100 requests/month), full tracing provides complete observability foundation for future growth and serves as valuable learning experience with AWS X-Ray.
- **Cost Impact**: Zero. Well within free tier limits (100k traces/month free).
- **Complexity**: ~140 lines of code, mostly boilerplate. Vendor wrapper pattern keeps implementation clean and centralized.
- **Reversibility**: Easy rollback via environment variable or Terraform revert.
