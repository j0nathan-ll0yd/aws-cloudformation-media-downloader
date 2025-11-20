# Fixture Extraction Runbook

This document provides step-by-step instructions for extracting test fixtures from production CloudWatch Logs.

## Overview

The fixture extraction system automatically captures real production requests and responses from Lambda functions, eliminating manual fixture maintenance.

### Benefits

- **Always Current**: Fixtures match actual production payloads
- **No Manual Work**: Automated extraction from CloudWatch
- **Sanitized**: Sensitive data automatically redacted
- **Easy Updates**: Run extraction script weekly or on-demand

## Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **jq** installed for JSON processing
3. **Node.js 22+** for processing script
4. **CloudWatch access** to Lambda log groups

Install dependencies (macOS):
```bash
brew install awscli jq
```

Install dependencies (Linux):
```bash
sudo apt-get install awscli jq
```

## Extraction Process

### Step 1: Extract Fixtures from CloudWatch

Run the extraction script to query CloudWatch Logs for fixture markers:

```bash
# Extract fixtures for a specific Lambda function
./bin/extract-fixtures.sh WebhookFeedly 7

# Extract fixtures from all Lambda functions (default: last 7 days)
./bin/extract-fixtures.sh

# Extract fixtures with custom lookback period (14 days)
./bin/extract-fixtures.sh ListFiles 14
```

**What this does:**
- Queries CloudWatch Logs for `[FIXTURE:*]` markers
- Looks back specified number of days (default: 7)
- Saves raw results to `fixtures/extracted/{LambdaName}_raw.json`
- Uses AWS CloudWatch Logs Insights for efficient querying

**Output:**
```
Extracting fixtures from CloudWatch Logs
Lambda: WebhookFeedly
Looking back: 7 days
Output directory: /path/to/project/fixtures/extracted

Processing WebhookFeedly...
  Query ID: 12345678-1234-1234-1234-123456789abc
  Waiting for query to complete....
  Found 15 fixture markers
  Raw results saved to: fixtures/extracted/WebhookFeedly_raw.json
```

### Step 2: Process and Sanitize Fixtures

Run the processing script to parse CloudWatch logs and generate fixture files:

```bash
# Process fixtures for a specific Lambda
node bin/process-fixture-markers.js WebhookFeedly

# Process all extracted fixtures
node bin/process-fixture-markers.js
```

**What this does:**
- Parses CloudWatch log messages
- Extracts JSON payloads from fixture markers
- Sanitizes sensitive data (see Sanitization Rules below)
- Generates organized fixture files
- Saves to `src/lambdas/{LambdaName}/test/fixtures/extracted/`

**Output:**
```
Processing fixture markers
Output: Lambda test/fixtures/extracted/ directories

Processing WebhookFeedly...
  Saved 15 fixtures to src/lambdas/WebhookFeedly/test/fixtures/extracted
    - Incoming: 5
    - Outgoing: 5
    - Internal: 5
```

### Step 3: Review and Validate Fixtures

Manually review extracted fixtures for completeness and accuracy:

```bash
# View extracted fixtures
ls src/lambdas/WebhookFeedly/test/fixtures/extracted/

# Review a specific fixture
cat src/lambdas/WebhookFeedly/test/fixtures/extracted/APIGatewayEvent-extracted-0.json | jq
```

**Checklist:**
- [ ] All sensitive data properly redacted
- [ ] Fixture structure matches expected format
- [ ] Representative sample of production traffic
- [ ] No PII or credentials exposed
- [ ] Fixtures contain relevant test scenarios

### Step 4: Move Validated Fixtures

After validation, move fixtures from `extracted/` to main fixtures directory:

```bash
# Move validated fixtures
mv src/lambdas/WebhookFeedly/test/fixtures/extracted/APIGatewayEvent-extracted-0.json \
   src/lambdas/WebhookFeedly/test/fixtures/APIGatewayEvent-production.json

# Or copy if you want to keep extracted versions
cp src/lambdas/WebhookFeedly/test/fixtures/extracted/APIGatewayEvent-extracted-0.json \
   src/lambdas/WebhookFeedly/test/fixtures/APIGatewayEvent-production.json
```

### Step 5: Update Tests

Update test imports to use new fixtures:

```typescript
// Before
const {default: eventMock} = await import('./fixtures/APIGatewayEvent.json', {assert: {type: 'json'}})

// After - use extracted fixture
const {default: eventMock} = await import('./fixtures/APIGatewayEvent-production.json', {assert: {type: 'json'}})
```

## Sanitization Rules

The processing script automatically sanitizes sensitive fields:

### Redacted Fields

- `Authorization` → `REDACTED_AUTHORIZATION`
- `X-Api-Key` → `REDACTED_X_API_KEY`
- `ApiKey` → `REDACTED_APIKEY`
- `token` → `REDACTED_TOKEN`
- `authorizationCode` → `REDACTED_AUTHORIZATIONCODE`
- `deviceToken` → `REDACTED_DEVICETOKEN`
- `appleUserId` → `REDACTED_APPLEUSERID`
- `userId` → `REDACTED_USERID`
- `email` → `REDACTED_EMAIL`
- `identityToken` → `REDACTED_IDENTITYTOKEN`
- `principalId` → `REDACTED_PRINCIPALID`

### Manual Review Required

After extraction, manually review for:
- Custom sensitive fields not in the auto-sanitization list
- Nested sensitive data in complex objects
- URLs containing sensitive parameters
- User-generated content that might contain PII

## Fixture Types

The extraction system captures three types of fixtures:

### 1. Incoming Fixtures (API Gateway Events)

**Marker**: `[FIXTURE:INCOMING:{LambdaName}]`

**Example**:
```json
{
  "body": "{\"articleURL\":\"https://youtube.com/watch?v=abc123\"}",
  "headers": {
    "Authorization": "REDACTED_AUTHORIZATION",
    "Content-Type": "application/json"
  },
  "requestContext": {
    "authorizer": {
      "principalId": "REDACTED_PRINCIPALID"
    }
  }
}
```

**Used for**: Handler entry point tests

### 2. Outgoing Fixtures (API Gateway Responses)

**Marker**: `[FIXTURE:OUTGOING:{LambdaName}]`

**Example**:
```json
{
  "statusCode": 200,
  "body": "{\"body\":{\"status\":\"Dispatched\"},\"requestId\":\"abc-123\"}",
  "headers": {}
}
```

**Used for**: Handler response validation tests

### 3. Internal Fixtures (AWS Service Responses)

**Marker**: `[FIXTURE:INTERNAL:{LambdaName}:{Service}:{Operation}]`

**Example**:
```json
{
  "Items": [
    {
      "fileId": "video-123",
      "status": "Downloaded",
      "userId": "REDACTED_USERID"
    }
  ],
  "Count": 1
}
```

**Used for**: Mocking AWS SDK responses in unit tests

## Recommended Schedule

### Weekly Extraction (Automated)

Set up a cron job or scheduled GitHub Action:

```bash
# Every Sunday at 2 AM
0 2 * * 0 cd /path/to/project && ./bin/extract-fixtures.sh >> /tmp/fixture-extraction.log 2>&1
```

### On-Demand Extraction

Run manually when:
- New Lambda function deployed
- API contract changes
- Test fixtures become stale
- Investigating production issues

## Troubleshooting

### Issue: "Log group not found"

**Cause**: Lambda hasn't been invoked or doesn't exist

**Solution**:
1. Verify Lambda function name is correct
2. Check CloudWatch Logs for log group existence
3. Ensure Lambda has been invoked at least once

### Issue: "No fixture markers found"

**Cause**: Lambda not using fixture logging functions

**Solution**:
1. Verify Lambda handler uses `logIncomingFixture()` and `logOutgoingFixture()`
2. Deploy updated Lambda code
3. Invoke Lambda to generate logs
4. Re-run extraction

### Issue: "Query timed out"

**Cause**: Too many logs or large time window

**Solution**:
1. Reduce lookback period (use 3-7 days instead of 14+)
2. Extract specific Lambda instead of all at once
3. Check AWS CloudWatch Logs service status

### Issue: "Permission denied"

**Cause**: AWS credentials lack CloudWatch Logs access

**Solution**:
1. Verify AWS CLI credentials: `aws sts get-caller-identity`
2. Add required IAM permissions:
```json
{
  "Effect": "Allow",
  "Action": [
    "logs:DescribeLogGroups",
    "logs:StartQuery",
    "logs:GetQueryResults"
  ],
  "Resource": "*"
}
```

## Best Practices

### Frequency
- **Weekly extraction**: Keeps fixtures current
- **Post-deployment**: Validate new Lambda changes
- **Pre-release**: Ensure test coverage with latest data

### Storage
- Keep extracted fixtures in version control
- Store raw CloudWatch results temporarily (can be regenerated)
- Archive old fixtures in `fixtures/archive/` directory

### Validation
- Always review extracted fixtures manually
- Run tests after updating fixtures
- Compare extracted vs hand-crafted fixtures
- Keep hand-crafted fixtures for edge cases

### Documentation
- Document any manual fixture modifications
- Note which fixtures are production-extracted vs hand-crafted
- Maintain fixture update history in commit messages

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Extract Fixtures Weekly

on:
  schedule:
    - cron: '0 2 * * 0'  # Sunday 2 AM
  workflow_dispatch:      # Manual trigger

jobs:
  extract-fixtures:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-west-2
      
      - name: Extract fixtures
        run: |
          ./bin/extract-fixtures.sh
          node bin/process-fixture-markers.js
      
      - name: Create Pull Request
        uses: peter-evans/create-pull-request@v5
        with:
          commit-message: 'chore: Update fixtures from production logs'
          title: 'Weekly Fixture Update'
          body: 'Automated extraction of fixtures from CloudWatch Logs'
          branch: 'fixtures/weekly-update'
```

## Support

For questions or issues:
1. Review Lambda style guide: `docs/styleGuides/lambdaStyleGuide.md`
2. Check test style guide: `docs/styleGuides/testStyleGuide.md`
3. Review extraction script source: `bin/extract-fixtures.sh`
4. Review processing script source: `bin/process-fixture-markers.js`
