# Test Suite Audit

> Generated: 2025-12-30
> Last Updated: 2025-12-30

This document provides a comprehensive inventory of all test files in the codebase, their purposes, mocking mechanisms, and dependencies.

## Overview

| Category | Files | Estimated Test Cases | Mocking Approach |
|----------|-------|---------------------|------------------|
| Lambda Unit Tests | 17 | ~155 | vi.mock on vendor wrappers |
| Library Tests | 28 | ~111 | vi.mock + vi.fn |
| MCP Validation Tests | 19 | ~271 | AST fixtures |
| Integration Tests | 18 | ~80 | Real PostgreSQL + LocalStack |
| **Total** | **82** | **~617** | - |

## Lambda Handler Tests

All Lambda tests are located at `src/lambdas/[name]/test/index.test.ts`.

### ApiGatewayAuthorizer

| Attribute | Value |
|-----------|-------|
| **File** | `src/lambdas/ApiGatewayAuthorizer/test/index.test.ts` |
| **Purpose** | Tests custom API Gateway authorizer with Better Auth integration |
| **Test Cases** | ~16 |
| **Describe Blocks** | 4 |
| **AWS Services** | None directly (uses Better Auth) |
| **Mocking** | Better Auth config, environment fixtures |
| **Dependencies** | Better Auth, session service |

### CleanupExpiredRecords

| Attribute | Value |
|-----------|-------|
| **File** | `src/lambdas/CleanupExpiredRecords/test/index.test.ts` |
| **Purpose** | Tests scheduled cleanup of expired sessions and verification tokens |
| **Test Cases** | 11 |
| **Describe Blocks** | 2 |
| **AWS Services** | None |
| **Mocking** | Entity queries (deleteExpiredSessions, deleteExpiredVerificationTokens) |
| **Dependencies** | Drizzle ORM |

### CloudfrontMiddleware

| Attribute | Value |
|-----------|-------|
| **File** | `src/lambdas/CloudfrontMiddleware/test/index.test.ts` |
| **Purpose** | Tests CloudFront edge request handling |
| **Test Cases** | ~9 |
| **Describe Blocks** | 2 |
| **AWS Services** | None directly |
| **Mocking** | Request handling |
| **Dependencies** | CloudFront event types |

### DeviceEvent

| Attribute | Value |
|-----------|-------|
| **File** | `src/lambdas/DeviceEvent/test/index.test.ts` |
| **Purpose** | Tests client-side device event logging |
| **Test Cases** | ~9 |
| **Describe Blocks** | 2 |
| **AWS Services** | None |
| **Mocking** | Entity queries |
| **Dependencies** | Drizzle ORM |

### ListFiles

| Attribute | Value |
|-----------|-------|
| **File** | `src/lambdas/ListFiles/test/index.test.ts` |
| **Purpose** | Tests file listing for authenticated users |
| **Test Cases** | ~12 |
| **Describe Blocks** | 3 |
| **AWS Services** | None |
| **Mocking** | Entity queries (getFilesForUser), JSON fixtures |
| **Dependencies** | Drizzle ORM |

### LoginUser

| Attribute | Value |
|-----------|-------|
| **File** | `src/lambdas/LoginUser/test/index.test.ts` |
| **Purpose** | Tests user authentication via Better Auth |
| **Test Cases** | ~10 |
| **Describe Blocks** | 3 |
| **AWS Services** | None |
| **Mocking** | Better Auth (signInSocial), response validation |
| **Dependencies** | Better Auth |

### MigrateDSQL

| Attribute | Value |
|-----------|-------|
| **File** | `src/lambdas/MigrateDSQL/test/index.test.ts` |
| **Purpose** | Tests Aurora DSQL migration execution |
| **Test Cases** | 12 |
| **Describe Blocks** | 2 |
| **AWS Services** | None |
| **Mocking** | Drizzle client (execute), fs module (migration file reading) |
| **Dependencies** | Drizzle ORM, migration files |

### PruneDevices

| Attribute | Value |
|-----------|-------|
| **File** | `src/lambdas/PruneDevices/test/index.test.ts` |
| **Purpose** | Tests device health checking and cleanup |
| **Test Cases** | ~9 |
| **Describe Blocks** | 4 |
| **AWS Services** | SNS (deleteEndpoint) |
| **Mocking** | Entity queries, device service, APNS library |
| **Dependencies** | Drizzle ORM, apns2 |

### RefreshToken

| Attribute | Value |
|-----------|-------|
| **File** | `src/lambdas/RefreshToken/test/index.test.ts` |
| **Purpose** | Tests session token refresh flow |
| **Test Cases** | ~8 |
| **Describe Blocks** | 3 |
| **AWS Services** | None |
| **Mocking** | Better Auth, response wrapping |
| **Dependencies** | Better Auth |

### RegisterDevice

| Attribute | Value |
|-----------|-------|
| **File** | `src/lambdas/RegisterDevice/test/index.test.ts` |
| **Purpose** | Tests iOS device registration with APNS |
| **Test Cases** | ~14 |
| **Describe Blocks** | 3 |
| **AWS Services** | SNS (createPlatformEndpoint, subscribe, listSubscriptionsByTopic, deleteEndpoint, unsubscribe) |
| **Mocking** | SNS vendor wrapper, entity queries, device service |
| **Dependencies** | Drizzle ORM, SNS |

### RegisterUser

| Attribute | Value |
|-----------|-------|
| **File** | `src/lambdas/RegisterUser/test/index.test.ts` |
| **Purpose** | Tests new user registration |
| **Test Cases** | ~9 |
| **Describe Blocks** | 2 |
| **AWS Services** | None |
| **Mocking** | Better Auth, entity creation |
| **Dependencies** | Better Auth, Drizzle ORM |

### S3ObjectCreated

| Attribute | Value |
|-----------|-------|
| **File** | `src/lambdas/S3ObjectCreated/test/index.test.ts` |
| **Purpose** | Tests S3 upload completion handling |
| **Test Cases** | ~9 |
| **Describe Blocks** | 2 |
| **AWS Services** | S3 (headObject), SQS (sendMessage) |
| **Mocking** | S3 vendor wrapper, SQS vendor wrapper, entity queries |
| **Dependencies** | Drizzle ORM |

### SendPushNotification

| Attribute | Value |
|-----------|-------|
| **File** | `src/lambdas/SendPushNotification/test/index.test.ts` |
| **Purpose** | Tests APNS notification dispatch |
| **Test Cases** | ~5 |
| **Describe Blocks** | 2 |
| **AWS Services** | SNS (publish) |
| **Mocking** | SNS vendor wrapper, SQS batch processing |
| **Dependencies** | SNS |

### StartFileUpload

| Attribute | Value |
|-----------|-------|
| **File** | `src/lambdas/StartFileUpload/test/index.test.ts` |
| **Purpose** | Tests video download from YouTube to S3 |
| **Test Cases** | ~12 |
| **Describe Blocks** | 1 |
| **AWS Services** | SQS (sendMessage), EventBridge (publishEvent) |
| **Mocking** | YouTube vendor, SQS/EventBridge vendor wrappers, entity queries, circuit breaker |
| **Dependencies** | Drizzle ORM, yt-dlp |

### UserDelete

| Attribute | Value |
|-----------|-------|
| **File** | `src/lambdas/UserDelete/test/index.test.ts` |
| **Purpose** | Tests cascade user deletion |
| **Test Cases** | ~11 |
| **Describe Blocks** | 3 |
| **AWS Services** | SNS (deleteEndpoint, unsubscribe) |
| **Mocking** | Drizzle queries, cascade operations, GitHub issue service |
| **Dependencies** | Drizzle ORM |

### UserSubscribe

| Attribute | Value |
|-----------|-------|
| **File** | `src/lambdas/UserSubscribe/test/index.test.ts` |
| **Purpose** | Tests user topic subscription management |
| **Test Cases** | ~11 |
| **Describe Blocks** | 2 |
| **AWS Services** | SNS (subscribe, unsubscribe) |
| **Mocking** | Entity queries, SNS vendor wrapper |
| **Dependencies** | Drizzle ORM |

### WebhookFeedly

| Attribute | Value |
|-----------|-------|
| **File** | `src/lambdas/WebhookFeedly/test/index.test.ts` |
| **Purpose** | Tests Feedly webhook article processing |
| **Test Cases** | ~11 |
| **Describe Blocks** | 4 |
| **AWS Services** | SQS (sendMessage), EventBridge (publishEvent) |
| **Mocking** | Entity queries, SQS/EventBridge vendor wrappers, Powertools |
| **Dependencies** | Drizzle ORM |

---

## Library Tests

### Domain Layer Tests

| File | Purpose | Test Cases |
|------|---------|------------|
| `src/lib/domain/auth/test/session-service.test.ts` | Session management service | ~8 |
| `src/lib/domain/device/test/device-service.test.ts` | Device management service | ~10 |
| `src/lib/domain/notification/test/transformers.test.ts` | Push notification transformation | ~6 |
| `src/lib/domain/user/test/user-file-service.test.ts` | User-file relationship management | ~8 |
| `src/lib/domain/video/test/error-classifier.test.ts` | YouTube error classification | ~12 |

### System Layer Tests

| File | Purpose | Test Cases |
|------|---------|------------|
| `src/lib/system/test/errors.test.ts` | Custom error classes | ~8 |
| `src/lib/system/test/env.test.ts` | Environment variable handling | ~10 |
| `src/lib/system/test/logging.test.ts` | Logging utilities | ~6 |
| `src/lib/system/test/retry.test.ts` | Retry logic | ~8 |
| `src/lib/system/test/circuit-breaker.test.ts` | Circuit breaker pattern | ~10 |
| `src/lib/system/test/observability.test.ts` | OpenTelemetry integration | ~5 |

### Lambda Middleware Tests

| File | Purpose | Test Cases |
|------|---------|------------|
| `src/lib/lambda/middleware/test/api.test.ts` | API middleware | ~8 |
| `src/lib/lambda/middleware/test/correlation.test.ts` | Correlation ID middleware | ~6 |
| `src/lib/lambda/middleware/test/internal.test.ts` | Internal middleware | ~5 |
| `src/lib/lambda/middleware/test/legacy.test.ts` | Legacy middleware compatibility | ~4 |
| `src/lib/lambda/middleware/test/legacy-wrappers.test.ts` | Legacy wrapper functions | ~4 |
| `src/lib/lambda/middleware/test/powertools.test.ts` | AWS Powertools middleware | ~6 |
| `src/lib/lambda/middleware/test/sanitization.test.ts` | Input sanitization | ~8 |
| `src/lib/lambda/middleware/test/security-headers.test.ts` | Security header injection | ~6 |
| `src/lib/lambda/middleware/test/validation.test.ts` | Request validation | ~8 |

### Lambda Core Tests

| File | Purpose | Test Cases |
|------|---------|------------|
| `src/lib/lambda/test/correlation.test.ts` | Correlation ID utilities | ~6 |
| `src/lib/lambda/test/responses.test.ts` | Response helper functions | ~10 |

### Integration and Vendor Tests

| File | Purpose | Test Cases |
|------|---------|------------|
| `src/lib/integrations/github/test/issue-service.test.ts` | GitHub issue creation | ~6 |
| `src/lib/integrations/github/test/templates.test.ts` | Issue template generation | ~4 |
| `src/lib/vendor/YouTube.test.ts` | yt-dlp integration | ~8 |
| `src/lib/vendor/Drizzle/test/fk-enforcement.test.ts` | Foreign key enforcement | ~6 |

### Data Layer Tests

| File | Purpose | Test Cases |
|------|---------|------------|
| `src/lib/data/test/pagination.test.ts` | Pagination utilities | ~6 |

---

## MCP Validation Tests

### Convention Rule Tests

| File | Purpose | Test Cases |
|------|---------|------------|
| `authenticated-handler-enforcement.test.ts` | API handler auth enforcement | ~15 |
| `aws-sdk-encapsulation.test.ts` | AWS SDK vendor wrapping | ~20 |
| `batch-retry.test.ts` | Batch operation error handling | ~12 |
| `cascade-safety.test.ts` | Database cascade delete patterns | ~18 |
| `config-enforcement.test.ts` | Configuration validation | ~10 |
| `docs-structure.test.ts` | TSDoc structure | ~15 |
| `drizzle-orm-encapsulation.test.ts` | Drizzle query function usage | ~18 |
| `entity-mocking.test.ts` | Entity mock detection | ~12 |
| `env-validation.test.ts` | Environment variable handling | ~20 |
| `import-order.test.ts` | Import statement ordering | ~15 |
| `mock-formatting.test.ts` | Mock statement formatting | ~10 |
| `powertools-metrics.test.ts` | AWS Powertools metrics usage | ~12 |
| `response-enum.test.ts` | Response status code enums | ~15 |
| `response-helpers.test.ts` | Response builder usage | ~18 |
| `scan-pagination.test.ts` | Database scan pagination | ~10 |
| `types-location.test.ts` | Type file organization | ~12 |

### Core MCP Tests

| File | Purpose | Test Cases |
|------|---------|------------|
| `src/mcp/validation/index.test.ts` | Validation framework | ~15 |
| `src/mcp/handlers/data-loader.test.ts` | Data loading handlers | ~10 |
| `src/mcp/parsers/convention-parser.test.ts` | Convention parsing | ~12 |

---

## Integration Tests

All integration tests are located at `test/integration/workflows/`.

### Auth and User Management

| File | Purpose | AWS Services | Mocking |
|------|---------|--------------|---------|
| `auth.flow.integration.test.ts` | Login/Register flows | PostgreSQL | Better Auth |
| `apiGatewayAuth.workflow.integration.test.ts` | API Gateway auth | PostgreSQL | Custom authorizer |
| `apiGatewayAuthorizer.dedicated.integration.test.ts` | Authorizer testing | PostgreSQL | None |
| `betterAuth.entities.integration.test.ts` | Better Auth entities | PostgreSQL | None |

### File Management

| File | Purpose | AWS Services | Mocking |
|------|---------|--------------|---------|
| `webhookFeedly.workflow.integration.test.ts` | Feedly webhook | PostgreSQL | Idempotency |
| `startFileUpload.workflow.integration.test.ts` | File upload | PostgreSQL | File status |
| `s3ObjectCreated.workflow.integration.test.ts` | S3 completion | S3, SQS | Entity queries |
| `listFiles.workflow.integration.test.ts` | File listing | PostgreSQL | None |

### Device Management

| File | Purpose | AWS Services | Mocking |
|------|---------|--------------|---------|
| `deviceRegistration.integration.test.ts` | Device registration | SNS | APNS platform |
| `pruneDevices.workflow.integration.test.ts` | Device cleanup | PostgreSQL | APNS health |

### Push Notifications

| File | Purpose | AWS Services | Mocking |
|------|---------|--------------|---------|
| `sendPushNotification.workflow.integration.test.ts` | APNS dispatch | SNS, SQS | None |

### User Operations

| File | Purpose | AWS Services | Mocking |
|------|---------|--------------|---------|
| `userDelete.cascade.integration.test.ts` | Cascade deletion | PostgreSQL, SNS | Partial failure |
| `userSubscribe.workflow.integration.test.ts` | Subscriptions | SNS | None |

### Refresh and Cleanup

| File | Purpose | AWS Services | Mocking |
|------|---------|--------------|---------|
| `refreshToken.workflow.integration.test.ts` | Token refresh | PostgreSQL | None |
| `cleanupExpiredRecords.workflow.integration.test.ts` | Scheduled cleanup | PostgreSQL | None |

### Event-Driven Workflows

| File | Purpose | AWS Services | Mocking |
|------|---------|--------------|---------|
| `eventChain.e2e.integration.test.ts` | E2E event chain | EventBridge, SQS | None |

### Failure Scenarios

| File | Purpose | AWS Services | Mocking |
|------|---------|--------------|---------|
| `failures/database.failure.integration.test.ts` | DB errors | PostgreSQL | Error injection |
| `failures/externalServices.failure.integration.test.ts` | External failures | Various | Timeouts, rate limits |

---

## Test Helpers

### Unit Test Helpers

| File | Purpose | Key Exports |
|------|---------|-------------|
| `test/helpers/entity-fixtures.ts` | Factory functions for mock entities | `createMockFile()`, `createMockDevice()`, `createMockUser()`, etc. |
| `test/helpers/drizzle-mock.ts` | Drizzle ORM mocking | `createDrizzleEntityMock()`, `createDrizzleClientMock()` |
| `test/helpers/better-auth-mock.ts` | Better Auth mocking | `createBetterAuthMock()` |
| `test/helpers/better-auth-test-data.ts` | Better Auth test data | Object Mother pattern factories |

### Integration Test Helpers

| File | Purpose | Key Exports |
|------|---------|-------------|
| `test/integration/helpers/postgres-helpers.ts` | PostgreSQL operations | `getTestDb()`, `truncateAllTables()`, entity CRUD |
| `test/integration/helpers/s3-helpers.ts` | S3 operations | `createTestBucket()`, `objectExists()` |
| `test/integration/helpers/sqs-helpers.ts` | SQS operations | `createTestQueue()`, `waitForMessages()` |
| `test/integration/helpers/sns-helpers.ts` | SNS operations | `createTestTopic()`, `createTestEndpoint()` |
| `test/integration/helpers/eventbridge-helpers.ts` | EventBridge operations | `createTestEventBus()`, `publishTestEvent()` |
| `test/integration/helpers/test-data.ts` | Test data factories | `createMockFile()`, `createMockAPIGatewayEvent()` |
| `test/integration/helpers/apns-mock.ts` | APNS mocking | `createApnsMock()`, device response simulation |
| `test/integration/helpers/failure-injection.ts` | Failure simulation | `createFailingAfterNMock()`, `createTimeoutMock()` |

---

## Coverage Gaps

### Lambda Tests

All Lambda handlers now have comprehensive test coverage. Previous gaps in CleanupExpiredRecords (11 tests) and MigrateDSQL (12 tests) have been addressed.

### Vendor Code Excluded from Coverage

The following are excluded via `c8 ignore` comments (intentional):

- `src/lib/vendor/AWS/*.ts` - AWS SDK wrappers (tested via integration)
- `src/lib/vendor/Drizzle/client.ts` - Database client (tested via integration)
- `src/lib/vendor/Powertools/**` - AWS Powertools (third-party)
- `src/lib/vendor/OpenTelemetry/**` - Telemetry (third-party)

---

## Recommendations

1. ~~**Add tests for CleanupExpiredRecords and MigrateDSQL Lambdas**~~ ✅ Complete
2. ~~**Migrate to aws-sdk-client-mock-vitest for type-safe AWS mocking**~~ ✅ Complete - Migrated SendPushNotification, infrastructure in place
3. **Enable EventBridge integration tests once LocalStack reliability improves**
4. **Increase test parallelization for faster CI execution**
5. **Continue migrating remaining Lambda tests to aws-sdk-client-mock pattern**
