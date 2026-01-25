---
last_updated: 2025-12-29
next_review: 2026-03-29
status: current
---

# Security Audit Report

**Audit Date**: 2025-12-29
**Auditor**: Claude Code (Automated Security Review)
**Scope**: Comprehensive security review of aws-cloudformation-media-downloader codebase

---

## Executive Summary

This security audit evaluated six critical areas of the codebase:

| Area | Status | Findings |
|------|--------|----------|
| Secrets Management (SOPS) | SECURE | No issues found |
| Input Validation (Zod) | NEEDS IMPROVEMENT | 3 Lambdas missing validation |
| IAM Policies | SECURE | Follows least privilege |
| Authentication | SECURE | Properly implemented |
| OWASP Top 10 | 4 ISSUES | 1 HIGH, 2 MEDIUM, 1 LOW |
| Secret Rotation | NEEDS IMPROVEMENT | No automated rotation |

---

## 1. Secrets Management (SOPS)

### Status: SECURE

### Findings

**Positive Observations:**
- All secrets encrypted with SOPS using AGE encryption
- Secrets files (`secrets.staging.enc.yaml`, `secrets.prod.enc.yaml`) properly encrypted and versioned
- Plaintext secrets (`secrets.yaml`) git-ignored
- Terraform SOPS provider decrypts secrets at deployment time
- Secure directory (`secure/`) git-ignored for certificates and keys

**Secret Categories Managed:**
| Secret | Storage | Usage |
|--------|---------|-------|
| Sign In With Apple Config | SOPS | LoginUser, RegisterUser Lambdas |
| Better Auth Secret | SOPS | Session token signing |
| APNS Credentials | SOPS + files | Push notifications |
| GitHub Personal Token | SOPS | Automated issue creation |
| YouTube Cookies | Lambda Layer | Video downloads |

**Environment Variable Handling:**
- Centralized via `src/lib/system/env.ts`
- `getRequiredEnv()` fails fast on missing variables
- ESLint rules enforce helper usage over direct `process.env` access

---

## 2. Input Validation (Zod)

### Status: NEEDS IMPROVEMENT

### Findings

**Properly Validated (Using Zod):**
- `LoginUser` - `userLoginRequestSchema`
- `RegisterUser` - `userRegistrationRequestSchema`
- `RegisterDevice` - `deviceRegistrationRequestSchema`
- `WebhookFeedly` - `feedlyWebhookRequestSchema`
- `UserSubscribe` - `userSubscriptionRequestSchema`

**Missing Validation:**
| Lambda | Trigger | Issue |
|--------|---------|-------|
| `StartFileUpload` | SQS | `JSON.parse()` without Zod validation |
| `SendPushNotification` | SQS | `JSON.parse()` without Zod validation |
| `ApiGatewayAuthorizer` | API Gateway | Manual validation, not Zod |

**Remediation:**
Add Zod schemas for SQS message types in `src/types/schemas.ts`:
```typescript
export const downloadQueueMessageSchema = z.object({
  fileId: z.string().min(1),
  correlationId: z.string().uuid(),
  sourceUrl: z.string().url().optional()
})
```

---

## 3. IAM Policies

### Status: SECURE

### Findings

**Positive Observations:**
- Each Lambda has its own IAM role with specific permissions
- Managed policies for common permissions (logging, X-Ray, DSQL)
- Resource-level restrictions on S3, SQS, DynamoDB, SNS

**Policy Summary:**
| Policy Type | Count | Compliance |
|-------------|-------|------------|
| IAM Roles | 19 | Per-function isolation |
| Managed Policies | 12 | Reusable, auditable |
| Inline Policies | 2 | Minimal usage |
| Resource-Based | 14 | Lambda invoke permissions |

**Acceptable Wildcards:**
- `cloudwatch:PutMetricData` with `resources = ["*"]` - AWS requirement for custom metrics

---

## 4. Authentication

### Status: SECURE

### Findings

**Implementation:**
- **Provider**: Better Auth with Apple Sign In
- **Token Type**: Session tokens (30-day expiration)
- **Validation**: Server-side via `validateSessionToken()`
- **Storage**: Aurora DSQL with indexed token lookup

**Security Features:**
- ID token verification using Apple's JWKS
- Session expiration enforced server-side
- IP address and user agent logged for audit
- IAM authentication for database connections (no static passwords)

**Security Headers Applied:**
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Cache-Control: no-store`

---

## 5. OWASP Top 10 Analysis

### Finding 1: Remote Test Bypass (HIGH)

**Location**: `src/lambdas/ApiGatewayAuthorizer/src/index.ts:182-184`

**Description**: The authorizer contains a backdoor that bypasses authentication for requests from a specific IP with a specific user agent. If `RESERVED_CLIENT_IP` is set in production, any attacker spoofing this configuration can bypass all authentication.

**Evidence**:
```typescript
if (isRemoteTestRequest(event)) {
  const fakeUserId = '123e4567-e89b-12d3-a456-426614174000'
  return generateAllow(fakeUserId, event.methodArn, apiKeyValue)
}
```

**Remediation**: Add explicit production guard:
```typescript
function isRemoteTestRequest(event: APIGatewayRequestAuthorizerEvent): boolean {
  const nodeEnv = getOptionalEnv('NODE_ENV', '')
  if (nodeEnv === 'production') {
    return false
  }
  // ... existing logic
}
```

---

### Finding 2: Wildcard CORS (MEDIUM)

**Location**: `src/lib/lambda/middleware/security-headers.ts:11`

**Description**: CORS configured with `Access-Control-Allow-Origin: '*'` allows any website to make credentialed requests to the API.

**Evidence**:
```typescript
const DEFAULT_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  // ...
}
```

**Remediation**: Since this is a mobile-only API (iOS app uses native HTTP), remove CORS headers entirely:
```typescript
const DEFAULT_HEADERS: Record<string, string> = {
  // Security headers only - no CORS needed for mobile-only API
  'X-Content-Type-Options': 'nosniff',
  // ...
}
```

---

### Finding 3: Dynamic Function Creation (MEDIUM)

**Location**: `src/lib/integrations/github/templates.ts:26`

**Description**: Template rendering uses `new Function()` which is effectively `eval()`. While templates are source-controlled, this pattern could enable code injection if templates become user-influenced.

**Evidence**:
```typescript
const fn = new Function(...Object.keys(data), 'return `' + safeTemplate + '`')
return fn(...Object.values(data))
```

**Remediation**: Replace with safe explicit interpolation:
```typescript
for (const [key, value] of Object.entries(data)) {
  const placeholder = new RegExp(`\\$\\{${key}\\}`, 'g')
  template = template.replace(placeholder, String(value ?? ''))
}
```

---

### Finding 4: Missing SQS Message Validation (LOW)

**Location**: `src/lambdas/StartFileUpload/src/index.ts:418`

**Description**: SQS-triggered Lambdas parse JSON messages without schema validation, allowing malformed messages to reach business logic.

**Evidence**:
```typescript
const message: DownloadQueueMessage = JSON.parse(record.body)
```

**Remediation**: Add Zod validation:
```typescript
const parseResult = validateSchema(downloadQueueMessageSchema, JSON.parse(record.body))
if (!parseResult.success) {
  logError('Invalid SQS message format', {errors: parseResult.errors})
  continue
}
```

---

## 6. Secret Rotation Assessment

### Status: NEEDS IMPROVEMENT

### Findings

**Current State:**
- All secrets properly encrypted with SOPS (AGE encryption)
- No automated rotation for any secrets
- Limited expiration tracking (only APNS has documented dates)

**Secret Expiration Tracking:**

| Secret | Expiration | Status |
|--------|------------|--------|
| APNS Signing Key | 2027-01-03 | Documented |
| APNS Certificate | 2027-01-03 | Documented |
| GitHub PAT | Varies | Check GitHub settings |
| YouTube Cookies | ~30-60 days | Auto-detected via 403 errors |
| Better Auth Secret | No expiry | Rotate on compromise only |
| Sign In With Apple | No expiry | Rotate as needed |

**Positive Observations:**
- YouTube cookie expiration is automatically detected
- GitHub issues are created when cookies expire
- SOPS encryption prevents accidental secret exposure

**Gaps Identified:**
1. No calendar reminders for APNS certificate renewal
2. GitHub PAT expiration not tracked
3. No documentation for rotation procedures (now addressed)

### Remediation

1. **Created**: [Secret-Rotation-Runbook.md](Secret-Rotation-Runbook.md) with detailed procedures
2. **Recommended**: Set calendar reminder for APNS renewal (2026-12-01)
3. **Recommended**: Configure GitHub PAT with 90-day expiration

---

## Recommendations Summary

| Priority | Finding | Action |
|----------|---------|--------|
| HIGH | Remote test bypass | Add production guard |
| MEDIUM | Wildcard CORS | Remove CORS headers |
| MEDIUM | Dynamic function | Use safe interpolation |
| MEDIUM | Secret rotation docs | Document procedures (DONE) |
| LOW | SQS validation | Add Zod schemas |

---

## Appendix: Security Controls Already in Place

### Input Sanitization
- `sanitizeInput()` middleware removes XSS vectors
- Control character stripping
- HTML tag removal

### Error Handling
- Structured error responses without stack traces
- Correlation IDs for tracing
- CloudWatch logging with X-Ray integration

### Supply Chain Protection
- pnpm lifecycle scripts disabled by default (`.npmrc`)
- Explicit allowlist for packages requiring install scripts

### Database Security
- Aurora DSQL with IAM authentication
- SigV4 token auto-refresh (no static passwords)
- SSL required for connections
