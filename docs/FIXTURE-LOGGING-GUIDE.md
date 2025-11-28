# Fixture Logging Guide

This guide explains how to use the fixture logging system for both Lambda functions and Better Auth endpoints to capture production request/response data for testing.

## Overview

The fixture logging system allows you to:
1. Log production requests and responses with sanitized data
2. Extract fixtures from CloudWatch logs
3. Process and deduplicate fixtures for use in tests
4. Track API contract changes over time

## Configuration

### Environment Variables

Set these environment variables to enable fixture logging:

```bash
ENABLE_FIXTURE_LOGGING=true  # Enable fixture logging
AWS_ACCOUNT_ID=123456789012  # AWS account ID (optional, for context)
STAGE=prod                    # Deployment stage (optional)
```

## Lambda Functions

Lambda functions automatically log fixtures when the helper functions are used:

```typescript
import { logIncomingFixture, logOutgoingFixture } from '../../../util/lambda-helpers'

export const handler = async (event, context) => {
  // Log incoming request (use actual Lambda name)
  logIncomingFixture(event, 'ListFiles')

  // ... process request ...

  // Log outgoing response
  const response = { statusCode: 200, body: JSON.stringify(data) }
  logOutgoingFixture(response, 'ListFiles')

  return response
}
```

### Naming Convention

Always use the actual Lambda function name (PascalCase) for the fixture type:
- ✅ `'ListFiles'` (matches Lambda name)
- ❌ `'list-files'` (kebab-case)

## Better Auth Integration

Better Auth uses hooks to log fixtures for authentication endpoints:

### 1. Import Fixture Hooks

```typescript
import { betterAuth } from 'better-auth'
import { fixtureLoggingHooks } from './lib/better-auth/fixture-hooks'

export const auth = betterAuth({
  // ... your config ...

  // Add fixture logging hooks
  hooks: fixtureLoggingHooks
})
```

### 2. Fixture Naming

Better Auth fixtures are automatically named based on the endpoint:
- `/auth/sign-in` → `BetterAuthSignIn`
- `/auth/sign-up` → `BetterAuthSignUp`
- `/auth/sign-out` → `BetterAuthSignOut`
- `/auth/forgot-password` → `BetterAuthForgotPassword`

### 3. Custom Hooks

You can combine fixture logging with custom hooks:

```typescript
hooks: {
  before: [
    ...fixtureLoggingHooks.before,
    // Your custom before hooks
  ],
  after: [
    ...fixtureLoggingHooks.after,
    // Your custom after hooks
  ]
}
```

## Extracting Fixtures

### Local Extraction

Use the local extraction script to pull fixtures from CloudWatch:

```bash
# Extract last 7 days of fixtures
./bin/extract-production-fixtures.sh

# Extract last 14 days
./bin/extract-production-fixtures.sh 14

# Extract and create a pull request
./bin/extract-production-fixtures.sh 7 true
```

### Manual Steps

1. **Extract from CloudWatch**:
   ```bash
   ./bin/extract-fixtures.sh 7
   ```

2. **Process fixtures**:
   ```bash
   node bin/process-fixtures.js
   ```

3. **Review changes**:
   ```bash
   git diff test/fixtures/api-contracts/
   ```

## Data Sanitization

The fixture logging system automatically sanitizes sensitive data:

### Redacted Fields
- `Authorization` headers
- `token` fields
- `password` fields
- `apiKey` fields
- `secret` fields
- `appleDeviceIdentifier`

### Example

```javascript
// Original data
{
  "headers": {
    "Authorization": "Bearer abc123...",
    "Content-Type": "application/json"
  },
  "body": {
    "password": "supersecret",
    "email": "user@example.com"
  }
}

// Sanitized fixture
{
  "headers": {
    "Authorization": "[REDACTED]",
    "Content-Type": "application/json"
  },
  "body": {
    "password": "[REDACTED]",
    "email": "user@example.com"
  }
}
```

## Testing with Fixtures

Use extracted fixtures in your tests:

```typescript
import incomingFixtures from '../../../test/fixtures/api-contracts/ListFiles/incoming.json'
import outgoingFixtures from '../../../test/fixtures/api-contracts/ListFiles/outgoing.json'

describe('ListFiles Lambda', () => {
  it('should handle production-like requests', () => {
    const testEvent = incomingFixtures[0]
    const result = await handler(testEvent, context)

    // Verify response structure matches production
    expect(result).toMatchObject({
      statusCode: 200,
      body: expect.any(String)
    })
  })
})
```

## CloudWatch Log Format

Fixtures are logged with a special marker for extraction:

```json
{
  "__FIXTURE_MARKER__": "INCOMING",
  "fixtureType": "ListFiles",
  "timestamp": 1704067200000,
  "data": { /* sanitized request data */ }
}
```

## Deduplication

The processing script deduplicates fixtures by structural similarity:
- Similarity threshold: 90%
- Keeps the most recent fixture for each unique structure
- Compares both keys and value types

## Troubleshooting

### No fixtures appearing in CloudWatch

1. Check `ENABLE_FIXTURE_LOGGING=true` is set
2. Verify Lambda has CloudWatch write permissions
3. Check log group exists: `/aws/lambda/{LambdaName}`

### Extraction script finds no fixtures

1. Verify AWS CLI is configured: `aws sts get-caller-identity`
2. Check the correct time range: default is 7 days
3. Ensure `__FIXTURE_MARKER__` is in the filter pattern

### Better Auth fixtures not logging

1. Verify hooks are added to Better Auth config
2. Check `process.env.ENABLE_FIXTURE_LOGGING` is accessible
3. Ensure Better Auth is running in an environment with CloudWatch access

## Best Practices

1. **Enable in production only temporarily** - Fixture logging adds overhead
2. **Review sanitization** - Always check that sensitive data is redacted
3. **Regular extraction** - Run extraction weekly to catch API changes
4. **Deduplicate fixtures** - Avoid test bloat with similar fixtures
5. **Version control fixtures** - Track API contract changes over time