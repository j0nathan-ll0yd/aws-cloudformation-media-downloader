# Fixture Extraction

## Quick Reference
- **When to use**: Automated test fixture generation from production
- **Enforcement**: Optional (enable with ENABLE_FIXTURE_LOGGING)
- **Impact if violated**: LOW - Manual fixture maintenance

## Overview

Automatic extraction of production API requests/responses from CloudWatch logs for use as test fixtures. Transforms production reality into test truth weekly via GitHub Actions.

## Architecture

```
Production Lambda → CloudWatch Logs → extract-fixtures.sh → process-fixtures.js → test/fixtures/
```

### Workflow
1. **Production logging**: Lambda marks requests/responses with `__FIXTURE_MARKER__`
2. **Weekly extraction**: GitHub Actions queries CloudWatch (last 7 days)
3. **Processing**: Deduplicate, sanitize PII, format for tests
4. **PR creation**: Automated PR with fixture updates for review

## Enable Fixture Logging

### 1. Lambda Configuration

Add to Lambda environment variables:
```bash
ENABLE_FIXTURE_LOGGING=true
```

### 2. Lambda Implementation

```typescript
import {logIncomingFixture, logOutgoingFixture} from '../../../util/lambda-helpers'

export const handler = withXRay(async (event, context) => {
  logIncomingFixture(event, 'webhook-feedly')

  // ... handler logic
  const result = response(context, 200, {status: 'Success'})

  logOutgoingFixture(result, 'webhook-feedly')
  return result
})
```

**Automatic PII sanitization**: Redacts Authorization, tokens, passwords, apiKey, secret, appleDeviceIdentifier

## Manual Extraction

```bash
# Extract from last 7 days
pnpm run extract-fixtures

# Extract from last 14 days
./bin/extract-fixtures.sh 14

# Process and deduplicate
pnpm run process-fixtures
```

**Output**: `test/fixtures/api-contracts/{LambdaName}/incoming.json`, `outgoing.json`

## GitHub Actions Automation

`.github/workflows/extract-fixtures.yml` runs weekly (Sunday 2am UTC):

```yaml
on:
  schedule:
    - cron: '0 2 * * 0'  # Weekly
  workflow_dispatch:      # Manual trigger
```

**Process**:
1. Extract fixtures from CloudWatch
2. Deduplicate by structural similarity (90% threshold)
3. Create PR with updated fixtures
4. Requires manual review before merge

## Deduplication Strategy

**Structural similarity** (not exact match):
- Compares object structure, not values
- 90% similarity threshold
- Prevents 1000 identical fixtures with different IDs
- Keeps diverse edge cases

```javascript
// These are considered similar (deduplicated):
{userId: "user-1", status: "Downloaded"}
{userId: "user-2", status: "Downloaded"}

// These are kept (different structure):
{userId: "user-1", status: "Downloaded"}
{userId: "user-1", status: "Failed", error: "Network timeout"}
```

## Supported Lambdas

Current fixture extraction (configured in `bin/extract-fixtures.sh`):
- WebhookFeedly
- ListFiles
- RegisterDevice
- LoginUser
- StartFileUpload
- SendPushNotification

**Add more**: Edit `LAMBDA_FUNCTIONS` array in `bin/extract-fixtures.sh`

## Security

### PII Sanitization

Automatically redacted fields:
- `Authorization` / `authorization`
- `token` / `Token`
- `password` / `Password`
- `apiKey` / `ApiKey`
- `secret` / `Secret`
- `appleDeviceIdentifier`

Recursive processing handles nested objects/arrays.

### Production Safety
- ✅ Opt-in via environment variable
- ✅ No performance impact (async logging)
- ✅ CloudWatch costs: ~$5.50/year
- ✅ Manual PR review before merging

## Cost Analysis

**CloudWatch Logs Insights**:
- $0.005 per GB ingested
- $0.005 per GB scanned in queries
- ~10KB per fixture × 50 fixtures/week = 500KB/week = 26MB/year
- **Total**: ~$1.30/year ingestion + $4.20/year scanning = **$5.50/year**

## Troubleshooting

### No Fixtures Extracted

1. Verify `ENABLE_FIXTURE_LOGGING=true` in Lambda
2. Check Lambda was invoked in time window
3. Verify CloudWatch log group exists
4. Check log retention (default 30 days)

```bash
# Check log group exists
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/WebhookFeedly

# Check recent log events
aws logs tail /aws/lambda/WebhookFeedly --since 1h
```

### Sensitive Data in Fixtures

1. Delete affected fixture files immediately
2. Add field to `sensitiveFields` array in `lambda-helpers.ts`
3. Re-run extraction
4. Audit git history if needed

```bash
# Remove from git history if committed
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch test/fixtures/api-contracts/WebhookFeedly/incoming.json' \
  --prune-empty --tag-name-filter cat -- --all
```

### GitHub Actions Fails

1. Verify AWS credentials in repository secrets:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
2. Check IAM permissions (logs:FilterLogEvents)
3. Review workflow logs: `gh run view --log`

## Best Practices

✅ Enable fixture logging in production only (not staging/dev)
✅ Review PRs for sensitive data before merging
✅ Add new Lambdas to extraction list as they're created
✅ Keep fixture count manageable (~5-10 per endpoint)
✅ Use fixtures for API contract tests, not unit tests

## Related Patterns

- [ElectroDB Testing Patterns](ElectroDB-Testing-Patterns.md)
- [Integration Testing](Integration-Testing.md)
- [Coverage Philosophy](Coverage-Philosophy.md)

---

*Use production data as test oracle. Weekly extraction keeps fixtures current.*
