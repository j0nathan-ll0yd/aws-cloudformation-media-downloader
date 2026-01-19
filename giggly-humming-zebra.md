# Lambda Class Decorator Enhancement Implementation Plan

## Overview

This plan proposes new class decorators for Lambda handlers, following the established `@RequiresDatabase` pattern. Based on 14 web searches and analysis of the current codebase, we recommend 5 priority decorators that provide maximum value for declarative infrastructure and documentation.

## Current State Analysis

### Existing Decorators
| Decorator | Type | Purpose | Location |
|-----------|------|---------|----------|
| `@Traced` | Method | OpenTelemetry span wrapping | `BaseHandler.ts:22-39` |
| `@InjectContext` | Method | Lambda context injection | `BaseHandler.ts:45-55` |
| `@LogMetrics` | Method | CloudWatch metrics publishing | `BaseHandler.ts:61-81` |
| `@RequiresDatabase` | Class | Database permission declaration | `RequiresDatabase.ts:28-34` |

### Key Pattern: Class Decorator for Static Metadata
The `@RequiresDatabase` pattern attaches metadata to the class constructor:
```typescript
export function RequiresDatabase(permissions: DatabasePermissions) {
  return function<T extends new(...args: unknown[]) => unknown>(constructor: T): T {
    const target = constructor as T & WithDatabasePermissions
    target.__databasePermissions = permissions
    return target
  }
}
```

**Benefits:**
- Metadata available at build time via AST parsing
- Enables Terraform/IAM policy generation from code
- MCP validation can verify declared vs actual usage
- Self-documenting code

## What We're NOT Doing

- **Not implementing runtime behavior decorators** (circuit breaker, retry, caching) - these already exist in the system library or AWS Powertools
- **Not duplicating Powertools functionality** - validation, idempotency, etc. already available
- **Not adding decorators without extraction/validation tooling** - decorators must have build-time value

## Recommended Decorators (Priority Order)

### 1. `@RequiresSecrets` (HIGH Priority)
**Purpose:** Declare which Secrets Manager secrets or Parameter Store parameters the Lambda needs.

**Value:**
- Generate IAM policies for secret access
- Document secret dependencies in code
- MCP validation that declared secrets match actual `getSecret()` calls
- Terraform `aws_secretsmanager_secret_policy` generation

**Example:**
```typescript
@RequiresDatabase([...])
@RequiresSecrets([
  {type: SecretType.SecretsManager, name: 'apns-certificate'},
  {type: SecretType.ParameterStore, name: '/app/youtube-cookies', encrypted: true}
])
class SendPushNotificationHandler extends SqsHandler { ... }
```

### 2. `@RequiresServices` (HIGH Priority)
**Purpose:** Declare which AWS services (S3, SQS, SNS, EventBridge) the Lambda uses.

**Value:**
- Generate IAM permissions for AWS service access
- Document external service dependencies
- MCP validation that declared services match vendor wrapper imports
- Terraform IAM policy generation

**Example:**
```typescript
@RequiresDatabase([...])
@RequiresServices([
  {service: AWSService.S3, bucket: 'media-bucket', operations: [S3Operation.PutObject, S3Operation.GetObject]},
  {service: AWSService.SQS, queue: 'download-queue', operations: [SQSOperation.SendMessage]}
])
class StartFileUploadHandler extends SqsHandler { ... }
```

### 3. `@RequiresFeatureFlags` (MEDIUM Priority)
**Purpose:** Declare which feature flags the Lambda depends on.

**Value:**
- Document feature flag dependencies
- Track feature flag usage across Lambdas
- Support gradual rollout planning
- Generate AppConfig resource references

**Example:**
```typescript
@RequiresDatabase([...])
@RequiresFeatureFlags(['video-transcoding-enabled', 'new-notification-format'])
class WebhookFeedlyHandler extends AuthenticatedHandler { ... }
```

### 4. `@RequiresTimeout` (MEDIUM Priority)
**Purpose:** Declare timeout expectations for external service calls.

**Value:**
- Document expected SLAs in code
- Generate CloudWatch alarms for timeout thresholds
- Terraform Lambda timeout configuration validation
- Build-time extraction for monitoring dashboards

**Example:**
```typescript
@RequiresDatabase([...])
@RequiresTimeout({
  external: {youtube: 30000, apns: 5000},
  overall: 60000
})
class StartFileUploadHandler extends SqsHandler { ... }
```

### 5. `@RequiresEventBridge` (LOW Priority)
**Purpose:** Declare EventBridge event patterns the Lambda publishes or subscribes to.

**Value:**
- Document event flow in code
- Generate EventBridge rule definitions
- MCP validation of event types vs published events
- Terraform `aws_cloudwatch_event_rule` generation

**Example:**
```typescript
@RequiresDatabase([...])
@RequiresEventBridge({
  publishes: ['DownloadStarted', 'DownloadCompleted', 'DownloadFailed'],
  subscribes: ['ArticleReceived']
})
class StartFileUploadHandler extends SqsHandler { ... }
```

---

## Phase 1: Foundation - `@RequiresSecrets`

### Overview
Implement `@RequiresSecrets` decorator following the `@RequiresDatabase` pattern. This includes types, decorator, extraction script, MCP validation rule, and Terraform generation.

### Changes Required:

#### 1. Type Definitions
**File**: `src/types/secretPermissions.ts` (new)

```typescript
export enum SecretType {
  SecretsManager = 'secretsmanager',
  ParameterStore = 'ssm'
}

export interface SecretPermission {
  type: SecretType
  name: string
  encrypted?: boolean  // For SSM parameters
}

export type SecretPermissions = SecretPermission[]

export interface WithSecretPermissions {
  __secretPermissions?: SecretPermissions
}
```

#### 2. Decorator Implementation
**File**: `src/lib/lambda/handlers/RequiresSecrets.ts` (new)

```typescript
export function RequiresSecrets(permissions: SecretPermissions) {
  return function<T extends new(...args: unknown[]) => unknown>(constructor: T): T {
    const target = constructor as T & WithSecretPermissions
    target.__secretPermissions = permissions
    return target
  }
}

export function getSecretPermissions(handlerClass: unknown): SecretPermissions | undefined {
  return (handlerClass as WithSecretPermissions).__secretPermissions
}
```

#### 3. Export from handlers index
**File**: `src/lib/lambda/handlers/index.ts`
- Add export for `RequiresSecrets`, `getSecretPermissions`
- Add export for types

#### 4. Extraction Script
**File**: `scripts/extractSecretPermissions.ts` (new)
- Parse Lambda source files with ts-morph
- Extract `@RequiresSecrets` decorator arguments
- Output JSON mapping Lambda → Secret permissions

#### 5. MCP Validation Rule
**File**: `src/mcp/validation/rules/secret-permissions.ts` (new)
- Verify Lambdas importing secret utilities have `@RequiresSecrets` decorator
- Check declared secrets match actual `getSecret()` / `getParameter()` calls
- Severity: HIGH

#### 6. Terraform Generation
**File**: `scripts/generateSecretPermissions.ts` (new)
- Generate IAM policy statements for Secrets Manager access
- Generate IAM policy statements for SSM Parameter Store access
- Output to `terraform/secret_permissions.tf`

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compilation passes: `pnpm run precheck`
- [ ] Unit tests pass: `pnpm test`
- [ ] MCP validation passes: `pnpm run validate:conventions`
- [ ] Extraction script runs successfully
- [ ] Generated Terraform is valid: `tofu validate`

#### Manual Verification:
- [ ] Apply decorator to `SendPushNotification` Lambda (uses APNS secrets)
- [ ] Verify extraction script outputs correct JSON
- [ ] Verify generated Terraform IAM policies are correct

---

## Phase 2: `@RequiresServices`

### Overview
Implement `@RequiresServices` decorator for AWS service dependencies with IAM policy generation.

### Changes Required:

#### 1. Type Definitions
**File**: `src/types/servicePermissions.ts` (new)

```typescript
export enum AWSService {
  S3 = 's3',
  SQS = 'sqs',
  SNS = 'sns',
  EventBridge = 'events',
  DynamoDB = 'dynamodb'
}

export enum S3Operation {
  GetObject = 's3:GetObject',
  PutObject = 's3:PutObject',
  DeleteObject = 's3:DeleteObject',
  ListBucket = 's3:ListBucket'
}

export enum SQSOperation {
  SendMessage = 'sqs:SendMessage',
  ReceiveMessage = 'sqs:ReceiveMessage',
  DeleteMessage = 'sqs:DeleteMessage'
}

// ... other operation enums

export interface ServicePermission {
  service: AWSService
  resource: string  // bucket name, queue name, etc.
  operations: string[]
}

export type ServicePermissions = ServicePermission[]
```

#### 2. Decorator, Extraction, MCP Rule, Terraform Generation
Follow same pattern as Phase 1.

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compilation passes
- [ ] Unit tests pass
- [ ] MCP validation rule works

#### Manual Verification:
- [ ] Apply decorator to `StartFileUpload` Lambda (uses S3, SQS)
- [ ] Verify generated IAM policies are correct

---

## Phase 3: `@RequiresFeatureFlags`

### Overview
Implement `@RequiresFeatureFlags` decorator for feature flag dependency tracking.

### Changes Required:
- Type definitions in `src/types/featureFlagPermissions.ts`
- Decorator in `src/lib/lambda/handlers/RequiresFeatureFlags.ts`
- Extraction script
- MCP validation rule (optional - validates flags exist in AppConfig)

### Success Criteria:
- [ ] Decorator applied to at least one Lambda
- [ ] Extraction script outputs feature flag usage report

---

## Phase 4: Documentation & Wiki Updates

### Changes Required:
- Update `docs/wiki/TypeScript/Lambda-Function-Patterns.md` with new decorators
- Update `docs/wiki/Meta/Conventions-Tracking.md` with new conventions
- Update `AGENTS.md` with new decorator information
- Create `docs/wiki/Infrastructure/Lambda-Decorators.md` comprehensive guide

---

## Phase 5: Branch, PR, and CI

### Git Workflow:
1. Create feature branch: `git checkout -b feat/lambda-class-decorators`
2. Implement changes in phases
3. Run full test suite: `pnpm run ci:local:full`
4. Push to GitHub: `git push -u origin feat/lambda-class-decorators`
5. Create PR with comprehensive description
6. Ensure CI passes on GitHub

### PR Description Template:
```markdown
## Summary
- Add @RequiresSecrets decorator for secret dependency declaration
- Add @RequiresServices decorator for AWS service dependency declaration
- Add @RequiresFeatureFlags decorator for feature flag tracking
- Add extraction scripts for build-time metadata collection
- Add MCP validation rules for decorator compliance

## Motivation
Following the successful @RequiresDatabase pattern, these decorators enable:
- Declarative infrastructure requirements in code
- Build-time extraction for Terraform generation
- MCP validation of declared vs actual usage
- Self-documenting Lambda dependencies

## Test plan
- [ ] All unit tests pass
- [ ] MCP validation rules work correctly
- [ ] Extraction scripts produce valid output
- [ ] Generated Terraform validates successfully
- [ ] Applied to sample Lambdas and verified

## Research References
- [AWS Lambda Powertools](https://docs.powertools.aws.dev/lambda/typescript/latest/)
- [TypeScript Decorators](https://www.typescriptlang.org/docs/handbook/decorators.html)
- [AWS Lambda Best Practices 2025](https://ridjex.medium.com/mastering-aws-lambda-functions-best-practices-with-typescript-2025-ee9e82327019)
```

---

## Testing Strategy

### Unit Tests:
- Test decorator attaches metadata correctly
- Test extraction scripts parse AST correctly
- Test MCP validation rules detect violations
- Test Terraform generation produces valid HCL

### Integration Tests:
- Apply decorators to existing Lambdas
- Run full build pipeline
- Verify generated Terraform validates

---

## Implementation Order

| Phase | Decorator | Effort | Value |
|-------|-----------|--------|-------|
| 1 | `@RequiresSecrets` | Medium | High |
| 2 | `@RequiresServices` | Medium | High |
| 3 | `@RequiresFeatureFlags` | Low | Medium |
| 4 | Documentation | Low | High |
| 5 | Branch/PR/CI | Low | Required |

Total estimated phases: 5

---

## References

### Web Research Sources:
- [AWS Lambda Powertools TypeScript](https://docs.powertools.aws.dev/lambda/typescript/latest/)
- [TypeScript Decorators Documentation](https://www.typescriptlang.org/docs/handbook/decorators.html)
- [AWS Secrets Manager Lambda Integration](https://docs.aws.amazon.com/secretsmanager/latest/userguide/retrieving-secrets_lambda.html)
- [AWS Parameter Store Lambda Extension](https://aws.amazon.com/blogs/compute/using-the-aws-parameter-and-secrets-lambda-extension-to-cache-parameters-and-secrets/)
- [Circuit Breaker Pattern in TypeScript](https://dev.to/wallacefreitas/circuit-breaker-pattern-in-nodejs-and-typescript-enhancing-resilience-and-stability-bfi)
- [Rate Limiting for Serverless](https://aws.amazon.com/blogs/architecture/rate-limiting-strategies-for-serverless-applications/)
- [Feature Flags in Serverless](https://launchdarkly.com/blog/go-serveless-not-flagless-implementing-feature-flags-in-serverless-environments/)
- [backoff-decorator NPM](https://www.npmjs.com/package/backoff-decorator)

### Codebase References:
- `src/lib/lambda/handlers/RequiresDatabase.ts` - Pattern to follow
- `src/types/databasePermissions.ts` - Type definition pattern
- `scripts/extractDbPermissions.ts` - Extraction script pattern
- `src/mcp/validation/rules/database-permissions.ts` - MCP rule pattern
