# Authentication Bypass Strategy for Automated API Testing

## Summary

Hybrid approach: **Session Injection** for integration tests (LocalStack) + **Enhanced Authorizer Bypass** for E2E tests (real AWS staging).

## User Decisions

- Test mode: Always-on in staging environment
- Test users: Single hardcoded userId (no multi-user support)
- Session scope: Full setup (User + Account + Session entities)

---

## Phase 1: Enhanced Authorizer Bypass (E2E Tests)

### Changes to `src/lambdas/ApiGatewayAuthorizer/src/index.ts`

Add `TESTING_MODE` environment variable check for defense in depth:

```typescript
function isRemoteTestRequest(event: APIGatewayRequestAuthorizerEvent): boolean {
  // Layer 1: Environment check (NEVER set in production)
  const testingMode = getOptionalEnv('TESTING_MODE', '')
  if (testingMode !== 'true') {
    return false
  }

  // Layer 2: Existing IP + User-Agent check (unchanged)
  if (!event.headers) {
    return false
  }
  const reservedIp = getOptionalEnv('RESERVED_CLIENT_IP', '')
  if (!reservedIp) {
    return false
  }
  const userAgent = event.headers['User-Agent']
  const clientIp = event.requestContext.identity.sourceIp
  logDebug('isRemoteTestRequest <=', {reservedIp, userAgent, clientIp})
  return clientIp === reservedIp && userAgent === 'localhost@lifegames'
}
```

### Changes to `terraform/api_gateway_authorizer.tf`

Add `TESTING_MODE` variable with staging-only enablement:

```hcl
variable "enable_testing_mode" {
  description = "Enable test mode for authorizer (staging only, NEVER production)"
  type        = bool
  default     = false
}

# In aws_lambda_function.ApiGatewayAuthorizer.environment.variables:
TESTING_MODE = var.enable_testing_mode ? "true" : ""
```

### Changes to `terraform/terraform.tfvars` (staging)

```hcl
enable_testing_mode = true
```

---

## Phase 2: Session Injection (Integration Tests)

### New file: `test/integration/helpers/auth-session-injector.ts`

Creates real User, Account, and Session records in LocalStack DynamoDB:

```typescript
import {Sessions} from '#entities/Sessions'
import {Users} from '#entities/Users'
import {Accounts} from '#entities/Accounts'
import {v4 as uuidv4} from 'uuid'
import {createMockUser, createMockSession, createMockAccount} from '../../helpers/better-auth-test-data'

export interface TestCredentials {
  userId: string
  sessionId: string
  token: string
  expiresAt: number
}

export async function injectTestSession(overrides?: {
  userId?: string
  email?: string
  sessionTTL?: number
}): Promise<TestCredentials> {
  const userId = overrides?.userId ?? `test-user-${uuidv4()}`
  const sessionId = `test-session-${uuidv4()}`
  const accountId = `test-account-${uuidv4()}`
  const token = `test-token-${uuidv4()}`
  const expiresAt = Date.now() + (overrides?.sessionTTL ?? 30 * 24 * 60 * 60 * 1000)

  // Create user
  await Users.create(createMockUser({
    userId,
    email: overrides?.email ?? `${userId}@test.local`
  })).go()

  // Create OAuth account (required by Better Auth)
  await Accounts.create(createMockAccount({
    accountId,
    userId,
    providerId: 'apple',
    providerAccountId: `apple-${userId}`
  })).go()

  // Create session
  await Sessions.create(createMockSession({
    sessionId,
    userId,
    token,
    expiresAt,
    ipAddress: '127.0.0.1',
    userAgent: 'Integration-Test/1.0'
  })).go()

  return {userId, sessionId, token, expiresAt}
}

export async function injectExpiredSession(userId?: string): Promise<TestCredentials> {
  return injectTestSession({userId, sessionTTL: -3600000})
}

export async function cleanupTestSession(credentials: TestCredentials): Promise<void> {
  await Sessions.delete({sessionId: credentials.sessionId}).go()
  // User/Account cleanup optional - DynamoDB table recreated each test run
}

export function makeAuthHeader(credentials: TestCredentials): string {
  return `Bearer ${credentials.token}`
}
```

---

## Phase 3: Test Token Generation Script

### New file: `bin/generate-test-token.sh`

For local development with LocalStack:

```bash
#!/usr/bin/env bash
set -euo pipefail

USER_ID="${1:-test-user-$(uuidgen | tr '[:upper:]' '[:lower:]')}"
SESSION_ID="test-session-$(uuidgen | tr '[:upper:]' '[:lower:]')"
TOKEN="test-token-$(uuidgen | tr '[:upper:]' '[:lower:]')"
EXPIRES_AT=$(($(date +%s) * 1000 + 2592000000))

aws dynamodb put-item \
  --endpoint-url http://localhost:4566 \
  --table-name "${DYNAMODB_TABLE_NAME:-MediaDownloader}" \
  --item "{
    \"pk\": {\"S\": \"SESSION#${SESSION_ID}\"},
    \"sk\": {\"S\": \"SESSION#${SESSION_ID}\"},
    \"sessionId\": {\"S\": \"${SESSION_ID}\"},
    \"userId\": {\"S\": \"${USER_ID}\"},
    \"token\": {\"S\": \"${TOKEN}\"},
    \"expiresAt\": {\"N\": \"${EXPIRES_AT}\"},
    \"gsi2pk\": {\"S\": \"${TOKEN}\"},
    \"gsi2sk\": {\"S\": \"\"}
  }"

echo "Authorization: Bearer ${TOKEN}"
```

---

## Phase 4: CI Integration

### Update `.github/workflows/integration-tests.yml`

No changes needed - integration tests use LocalStack with session injection.

### Create `.github/workflows/e2e-tests.yml` (optional, future)

```yaml
jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - name: Get runner IP
        id: ip
        run: echo "ip=$(curl -s https://ipv4.icanhazip.com)" >> $GITHUB_OUTPUT

      - name: Run E2E tests
        run: pnpm run test:e2e
        env:
          TEST_API_URL: ${{ secrets.STAGING_API_URL }}
          TEST_API_KEY: ${{ secrets.STAGING_API_KEY }}
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/lambdas/ApiGatewayAuthorizer/src/index.ts` | Add `TESTING_MODE` check |
| `terraform/api_gateway_authorizer.tf` | Add `enable_testing_mode` variable |
| `terraform/variables.tf` | Declare `enable_testing_mode` variable |
| `terraform/terraform.tfvars` | Set `enable_testing_mode = true` for staging |

## Files to Create

| File | Purpose |
|------|---------|
| `test/integration/helpers/auth-session-injector.ts` | Session injection for integration tests |
| `bin/generate-test-token.sh` | Token generation for local development |

---

## Security Analysis

| Threat | Mitigation |
|--------|------------|
| Production bypass | `TESTING_MODE` never set in production Terraform |
| IP spoofing | Requires actual network routing to whitelisted IP |
| Unauthorized access | Dual-layer: env var + IP + User-Agent |
| Test token leakage | Tokens only valid in LocalStack (isolated) |

### Defense in Depth

```
Production: TESTING_MODE="" -> bypass ALWAYS disabled
Staging: TESTING_MODE="true" + RESERVED_CLIENT_IP + User-Agent check
```

---

## Implementation Order

1. Update `isRemoteTestRequest()` in authorizer with `TESTING_MODE` check
2. Add Terraform variable `enable_testing_mode`
3. Create `auth-session-injector.ts` for integration tests
4. Create `generate-test-token.sh` for local development
5. Update one integration test to use session injection as proof of concept
6. Add documentation to `docs/wiki/Testing/Authentication-Testing.md`
