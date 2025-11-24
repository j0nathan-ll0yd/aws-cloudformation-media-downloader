# Fixture Extraction from Production

This guide explains the automated fixture extraction system that captures real production data from CloudWatch logs for use in tests.

## Overview

The fixture extraction system transforms production API requests/responses into test fixtures automatically, ensuring tests reflect real-world usage patterns.

### Benefits

1. **Production Truth**: Test against actual payloads, not assumptions
2. **Edge Case Discovery**: Capture edge cases you didn't know existed
3. **API Contract Validation**: Detect breaking changes automatically
4. **Reduced Maintenance**: Weekly auto-update eliminates manual fixture creation
5. **Zero Drift Risk**: Fixtures always match current production behavior

## Architecture

### 1. Production Logging (Lambda Functions)

Lambda handlers mark requests/responses for extraction using fixture logging functions:

```typescript
import {logIncomingFixture, logOutgoingFixture} from '../../../util/lambda-helpers'

export const handler = withXRay(async (event, context) => {
  // Log incoming request
  logIncomingFixture(event, 'feedly-webhook')

  // Process request...
  const result = response(context, 200, {success: true})

  // Log outgoing response
  logOutgoingFixture(result, 'feedly-webhook')

  return result
})
```

**Key Features**:
- Controlled by `ENABLE_FIXTURE_LOGGING` environment variable
- Automatic PII sanitization (removes tokens, passwords, device IDs)
- Structured markers for CloudWatch extraction (`__FIXTURE_MARKER__`)

### 2. Extraction Pipeline

**bin/extract-fixtures.sh** - Extracts raw fixtures from CloudWatch:
```bash
# Extract last 7 days
npm run extract-fixtures

# Extract custom time range
./bin/extract-fixtures.sh 14  # 14 days back
```

**bin/process-fixtures.js** - Deduplicates and formats fixtures:
```bash
npm run process-fixtures
```

**Process**:
1. Query CloudWatch logs for `__FIXTURE_MARKER__` pattern
2. Extract incoming/outgoing fixtures per Lambda
3. Deduplicate by structural similarity (90% threshold)
4. Save to `test/fixtures/api-contracts/[LambdaName]/`

### 3. GitHub Actions Automation

Weekly workflow automatically:
1. Extracts fixtures from production
2. Processes and deduplicates
3. Creates PR with changes
4. Requires manual review before merge

**Schedule**: Every Sunday at 2am UTC

**Manual Trigger**:
```bash
gh workflow run extract-fixtures.yml
```

## Usage

### Enabling Fixture Logging

Set environment variable in Lambda configuration:
```bash
ENABLE_FIXTURE_LOGGING=true
```

**⚠️ Warning**: Only enable in production, not staging/dev (increases CloudWatch costs)

### Adding Fixture Logging to New Lambdas

1. Import fixture logging functions:
```typescript
import {logIncomingFixture, logOutgoingFixture} from '../../../util/lambda-helpers'
```

2. Log at handler entry:
```typescript
export const handler = withXRay(async (event, context) => {
  logIncomingFixture(event, 'my-lambda-name')
  // ... handler logic
})
```

3. Log before returning:
```typescript
const result = response(context, 200, data)
logOutgoingFixture(result, 'my-lambda-name')
return result
```

4. Add Lambda to extraction script:
```bash
# Edit bin/extract-fixtures.sh
LAMBDA_FUNCTIONS=(
  "WebhookFeedly"
  "ListFiles"
  "MyNewLambda"  # Add here
)
```

### Using Fixtures in Tests

Fixtures are saved to `test/fixtures/api-contracts/[LambdaName]/`:
- `incoming.json` - Array of API Gateway events
- `outgoing.json` - Array of Lambda responses

```typescript
import incomingFixtures from '../../../test/fixtures/api-contracts/WebhookFeedly/incoming.json'

test('should handle production webhook payloads', async () => {
  for (const fixture of incomingFixtures) {
    const result = await handler(fixture, mockContext)
    expect(result.statusCode).toBe(200)
  }
})
```

## PII Sanitization

The following fields are automatically redacted:
- `Authorization` / `authorization`
- `token` / `Token`
- `password` / `Password`
- `apiKey` / `ApiKey`
- `secret` / `Secret`
- `appleDeviceIdentifier`

**Recursive**: Sanitization applies to nested objects and arrays.

**Custom Sanitization**: Edit `sanitizeForTest()` in `src/util/lambda-helpers.ts`

## Deduplication Strategy

Fixtures are deduplicated by **structural similarity**:
- Compares object keys and value types
- Default threshold: 90% similarity
- Keeps most recent fixture for each unique structure

**Why**: Prevents 1000 identical payloads in fixtures while capturing structural variations

**Example**:
```json
// These are considered duplicates (same structure)
{"userId": "user-1", "action": "download"}
{"userId": "user-2", "action": "upload"}

// These are kept (different structure)
{"userId": "user-1", "action": "download"}
{"userId": "user-1", "action": "download", "metadata": {...}}
```

## Troubleshooting

### No Fixtures Extracted

**Causes**:
1. `ENABLE_FIXTURE_LOGGING` not set in Lambda
2. Lambda not invoked in extraction time window
3. CloudWatch logs expired (default retention: 30 days)

**Solution**:
```bash
# Check Lambda environment variables
aws lambda get-function-configuration --function-name WebhookFeedly

# Verify CloudWatch logs exist
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/

# Check log retention
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/ \
  --query 'logGroups[*].[logGroupName,retentionInDays]'
```

### Sensitive Data in Fixtures

**If sensitive data leaks**:
1. Immediately delete affected fixture files
2. Add field to sanitization list in `lambda-helpers.ts`
3. Re-run extraction: `npm run extract-fixtures && npm run process-fixtures`
4. Audit git history and force-push if needed (consult team first)

### GitHub Actions Workflow Fails

**Check**:
1. AWS credentials configured in repository secrets
2. IAM permissions for CloudWatch Logs read access
3. Workflow logs: `gh run view [run-id]`

## Performance Considerations

### CloudWatch Costs

Fixture logging increases CloudWatch costs:
- **Logs**: ~$0.50/GB ingested
- **Queries**: ~$0.005 per GB scanned

**Estimate**: 10K Lambda invocations/day = ~1MB logs = ~$0.015/day = $5.50/year

**Recommendation**: Enable only in production, disable in staging/dev

### Extraction Speed

Extraction time depends on:
- Number of Lambda functions
- Time range (days back)
- Log volume per function

**Typical**: 6 Lambdas × 7 days = ~30 seconds

## Future Enhancements

### OSS Package: cloudwatch-fixture-extractor

The extraction logic can be extracted into a standalone npm package:

```typescript
import {extractFixtures} from 'cloudwatch-fixture-extractor'

await extractFixtures({
  logGroup: '/aws/lambda/MyFunction',
  markerPattern: '__FIXTURE_MARKER__',
  outputDir: 'test/fixtures',
  sanitize: (data) => removePII(data),
  dedupeStrategy: 'structural-similarity'
})
```

**Benefits**: Reusable across serverless projects, community contribution

## References

- [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md)
- [LocalStack Testing](../Integration/LocalStack-Testing.md)
- [Coverage Philosophy](./Coverage-Philosophy.md)
- [Jest ESM Mocking Strategy](./Jest-ESM-Mocking-Strategy.md)

## See Also

- `.github/workflows/extract-fixtures.yml` - Automation workflow
- `bin/extract-fixtures.sh` - Extraction script
- `bin/process-fixtures.js` - Processing script
- `src/util/lambda-helpers.ts` - Fixture logging functions
