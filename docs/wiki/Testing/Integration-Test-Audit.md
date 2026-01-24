---
last_updated: 2024-12-01
next_review: 2025-06-01
status: stale
---

# Integration Test Audit

## Quick Reference
- **Purpose**: Classification and tracking of integration test coverage
- **Last Updated**: December 2024
- **Total Tests**: 18 files, 142 tests

## Test Classification

Integration tests are classified by what services they actually exercise:

| Classification | Description | Count |
|----------------|-------------|-------|
| **TRUE_INTEGRATION** | Uses real LocalStack services, no AWS vendor mocking | 17 |
| **HYBRID** | Uses real services but mocks external APIs (APNS) | 1 |

## Test Inventory

### TRUE_INTEGRATION Tests

These tests use real LocalStack services with no AWS vendor wrapper mocking:

| Test File | Services Exercised | Database |
|-----------|-------------------|----------|
| `eventChain.e2e.integration.test.ts` | EventBridge, SQS, S3 | PostgreSQL |
| `betterAuth.entities.integration.test.ts` | - | PostgreSQL |
| `startFileUpload.workflow.integration.test.ts` | S3, EventBridge | PostgreSQL |
| `webhookFeedly.workflow.integration.test.ts` | EventBridge, S3 | PostgreSQL |
| `sendPushNotification.workflow.integration.test.ts` | SNS | PostgreSQL |
| `userSubscribe.workflow.integration.test.ts` | SNS | - |
| `deviceRegistration.integration.test.ts` | SNS | PostgreSQL (mocked entities) |
| `s3ObjectCreated.workflow.integration.test.ts` | SQS | PostgreSQL |
| `cleanupExpiredRecords.workflow.integration.test.ts` | - | PostgreSQL |
| `listFiles.workflow.integration.test.ts` | - | PostgreSQL |
| `refreshToken.workflow.integration.test.ts` | - | PostgreSQL |
| `apiGatewayAuthorizer.dedicated.integration.test.ts` | API Gateway (rate limiting mocked) | PostgreSQL |
| `apiGatewayAuth.workflow.integration.test.ts` | API Gateway (rate limiting mocked) | PostgreSQL |
| `userDelete.cascade.integration.test.ts` | - | PostgreSQL (mocked entities) |
| `failures/externalServices.failure.integration.test.ts` | SNS, SQS | PostgreSQL |
| `failures/database.failure.integration.test.ts` | SNS | PostgreSQL |
| `auth.flow.integration.test.ts` | Better Auth (Apple JWKS mocked) | PostgreSQL |

### HYBRID Tests

These tests use real LocalStack but mock external services that cannot be emulated:

| Test File | Real Services | Mocked (External) | Reason |
|-----------|--------------|-------------------|--------|
| `pruneDevices.workflow.integration.test.ts` | SNS, PostgreSQL | APNS (apns2) | Apple Push Notification Service is external |

## Services Coverage Matrix

| Service | Integration Tests Using It |
|---------|---------------------------|
| **PostgreSQL** | 16 tests (worker-isolated schemas) |
| **SNS** | 6 tests (platform apps, endpoints, topics) |
| **SQS** | 3 tests (queues, message delivery) |
| **S3** | 3 tests (object upload, events) |
| **EventBridge** | 3 tests (rules, targets) |
| **API Gateway** | 2 tests (rate limiting mocked) |

## Acceptable Mocking

The following mocks are acceptable in integration tests because they represent external services that cannot be emulated locally:

| Mock | Reason | Tests Using |
|------|--------|-------------|
| **APNS (apns2)** | Apple Push Notification Service - external | pruneDevices |
| **Apple JWKS (mock-jwks)** | Apple's public key endpoint - external network call | auth.flow |
| **GitHub API** | External service for issue creation | userDelete.cascade |
| **API Gateway Rate Limiting** | LocalStack limitation | apiGatewayAuthorizer, apiGatewayAuth |

## Migration History

### December 2024 - Auth Flow True Integration

Converted auth.flow from HYBRID (mocking entire Better Auth) to TRUE_INTEGRATION:

| Test | Before | After |
|------|--------|-------|
| auth.flow | Mock Better Auth signInSocial | Real Better Auth, mock Apple JWKS only |

**Key changes:**
- Added `mock-jwks` package to mock Apple's JWKS endpoint (`https://appleid.apple.com/auth/keys`)
- Created `test/integration/helpers/apple-jwks-mock.ts` helper for generating valid Apple ID tokens
- Updated `globalSetup.ts` to add proper column defaults for Better Auth compatibility
- Real Better Auth code now executes against real PostgreSQL

### December 2024 - Mock Removal Sprint

Converted 13 "mock disguised" tests to true integration tests:

| Test | Before | After |
|------|--------|-------|
| sendPushNotification.workflow | Mock SNS vendor | Real LocalStack SNS |
| userSubscribe.workflow | Mock SNS vendor | Real LocalStack SNS |
| deviceRegistration | Mock SNS vendor | Real LocalStack SNS |
| s3ObjectCreated.workflow | Mock SQS vendor | Real LocalStack SQS |
| cleanupExpiredRecords.workflow | Mock Drizzle | Real PostgreSQL |
| listFiles.workflow | Mock entity queries | Real PostgreSQL |
| refreshToken.workflow | Mock session service | Real PostgreSQL |
| apiGatewayAuthorizer.dedicated | Mock session service | Real PostgreSQL |
| apiGatewayAuth.workflow | Mock session service | Real PostgreSQL |
| pruneDevices.workflow | Mock SNS + APNS | Real SNS, Mock APNS only |
| failures/externalServices | Skipped in CI | Enabled with SNS readiness check |
| failures/database | Skipped in CI | Enabled with SNS readiness check |

### CI Reliability Improvements

Added to prevent flaky tests in CI:
1. **SNS Readiness Check** - Validates SNS lifecycle before tests run
2. **Isolated Platform App Names** - Uses `GITHUB_RUN_ID` for CI isolation
3. **Worker Schema Isolation** - PostgreSQL schemas per test worker

## Test Infrastructure

### Helpers

| Helper | Purpose |
|--------|---------|
| `postgres-helpers.ts` | Database operations, schema isolation |
| `sns-helpers.ts` | SNS platform apps, endpoints, topics |
| `sqs-helpers.ts` | Queue creation, message polling |
| `s3-helpers.ts` | Bucket operations |
| `eventbridge-helpers.ts` | Rules and targets |
| `lambda-context.ts` | Mock Lambda context |
| `test-data.ts` | Event fixtures |

### Vendor Wrappers

Integration tests use vendor wrappers in `test/integration/lib/vendor/AWS/`:
- `SNS.ts` - SNS operations following encapsulation pattern

## Related Documentation

- [LocalStack Testing](./LocalStack-Testing.md) - Setup and patterns
- [Coverage Philosophy](Coverage-Philosophy.md) - When to use integration vs unit tests
- [Vitest Mocking Strategy](Vitest-Mocking-Strategy.md) - Mocking patterns

---

*Integration tests should use real LocalStack services. Only mock external services that cannot be emulated.*
