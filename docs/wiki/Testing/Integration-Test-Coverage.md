# Integration Test Coverage Map

This document provides a comprehensive mapping of Lambda function integration test coverage, including trigger types, test files, and justifications for coverage gaps.

## Lambda Trigger Coverage Summary

**Coverage Rate**: 82% (14/17 Lambdas tested)

| Trigger Type | Covered | Total | Status |
|--------------|---------|-------|--------|
| API Gateway | 9 | 10 | DeviceEvent untested |
| CloudWatch Schedule | 2 | 2 | Complete |
| S3 Event | 1 | 1 | Complete |
| SQS | 2 | 2 | Complete |
| EventBridge | 1 | 1 | Complete |
| CloudFront Edge | 0 | 1 | CloudfrontMiddleware untested |
| Manual CLI | 0 | 1 | MigrateDSQL (intentional) |

## Complete Lambda Coverage Table

| Lambda | Trigger Type | Test File | Status |
|--------|-------------|-----------|--------|
| ApiGatewayAuthorizer | API Gateway | `apiGatewayAuthorizer.dedicated.integration.test.ts`, `apiGatewayAuth.workflow.integration.test.ts` | Tested |
| CleanupExpiredRecords | CloudWatch Schedule | `cleanupExpiredRecords.workflow.integration.test.ts` | Tested |
| CloudfrontMiddleware | CloudFront Edge | N/A | Not Tested |
| DeviceEvent | API Gateway | N/A | Not Tested |
| ListFiles | API Gateway | `listFiles.workflow.integration.test.ts` | Tested |
| LoginUser | API Gateway | `auth.flow.integration.test.ts` | Tested |
| MigrateDSQL | Manual CLI | N/A | Not Tested |
| PruneDevices | CloudWatch Schedule | `pruneDevices.workflow.integration.test.ts` | Tested |
| RefreshToken | API Gateway | `refreshToken.workflow.integration.test.ts` | Tested |
| RegisterDevice | API Gateway | `deviceRegistration.integration.test.ts` | Tested |
| RegisterUser | API Gateway | `auth.flow.integration.test.ts` | Tested |
| S3ObjectCreated | S3 Event | `s3ObjectCreated.workflow.integration.test.ts` | Tested |
| SendPushNotification | SQS | `sendPushNotification.workflow.integration.test.ts` | Tested |
| StartFileUpload | SQS (via EventBridge) | `startFileUpload.workflow.integration.test.ts` | Tested |
| UserDelete | API Gateway | `userDelete.cascade.integration.test.ts` | Tested |
| UserSubscribe | API Gateway | `userSubscribe.workflow.integration.test.ts` | Tested |
| WebhookFeedly | API Gateway | `webhookFeedly.workflow.integration.test.ts` | Tested |

## Additional Integration Test Files

These tests validate cross-cutting concerns and multi-service orchestration:

| Test File | Purpose | Services Covered |
|-----------|---------|------------------|
| `betterAuth.entities.integration.test.ts` | Better Auth entity operations | PostgreSQL (Users, Sessions, Accounts) |
| `eventChain.e2e.integration.test.ts` | Event-driven pipeline | EventBridge, SQS |
| `database.failure.integration.test.ts` | Database failure scenarios | PostgreSQL error handling |
| `externalServices.failure.integration.test.ts` | External service failures | S3, SNS error handling |

## Coverage Gaps Justification

### CloudfrontMiddleware

**Reason**: CloudFront@Edge functions cannot be tested via LocalStack.

CloudFront Lambda@Edge functions execute at AWS edge locations with specific constraints:
- No VPC access
- Limited runtime (viewer request/response: 5 s, origin request/response: 30 s)
- Region-specific deployment (us-east-1 only)
- Edge-specific event structure

LocalStack does not emulate CloudFront edge behavior. Testing options:
1. **Unit tests** - Mock CloudFront event payloads (current approach)
2. **Deploy-time validation** - Test against real AWS in staging environment
3. **Synthetic monitoring** - CloudWatch Synthetics after deployment

### DeviceEvent

**Reason**: Low-risk telemetry endpoint intentionally untested.

DeviceEvent is an API Gateway-triggered Lambda for logging client-side device events. This Lambda:
- Receives telemetry data from iOS app
- Writes events to CloudWatch Logs
- Does not affect core application functionality
- Has no side effects on user data or application state

The risk of bugs in this Lambda is low and impact is limited to observability. Integration testing effort is better spent on user-facing functionality.

### MigrateDSQL

**Reason**: Manual CLI trigger validated through CI migration process.

MigrateDSQL is a utility Lambda invoked manually via CLI to run Drizzle migrations on Aurora DSQL. It is:
- Not triggered by any AWS event source
- Invoked exclusively by developers during deployment
- Validated by CI pipeline which runs migrations on test database

Integration testing is not applicable because:
1. The Lambda is never triggered automatically
2. CI validates migration correctness before deployment
3. Rollback procedures are tested separately

## Schema Isolation Mechanism

Integration tests use worker-specific PostgreSQL schemas for parallel execution:

```
worker_1/
  users, files, devices, sessions, ...
worker_2/
  users, files, devices, sessions, ...
...
worker_8/
  users, files, devices, sessions, ...
```

### CI Isolation

When running in GitHub Actions, schemas are prefixed with `GITHUB_RUN_ID`:
```
run_12345_worker_1/
run_12345_worker_2/
...
```

This prevents interference between parallel CI runs.

### Aurora DSQL Adaptations

The following Aurora DSQL-specific syntax is adapted for PostgreSQL compatibility:

| Aurora DSQL | PostgreSQL | Location |
|-------------|------------|----------|
| `CREATE INDEX ASYNC` | `CREATE INDEX` | globalSetup.ts |
| `UUID PRIMARY KEY DEFAULT gen_random_uuid()` | `TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text` | globalSetup.ts |
| `UUID NOT NULL` | `TEXT NOT NULL` | globalSetup.ts |

## Test Quality Metrics

### Strengths

1. **Real infrastructure**: Tests use LocalStack for SQS, SNS, S3, EventBridge
2. **Database integrity**: Entity relationship tests validate cascade behavior
3. **Error handling**: Tests include auth failures, missing fields, expired sessions
4. **Event chain testing**: E2E test validates EventBridge to SQS routing
5. **Scheduled job testing**: Both scheduled Lambdas have cleanup scenarios

### Areas for Improvement

1. **AWS SDK client cleanup**: SDK clients should be destroyed after tests
2. **Resource naming**: Use worker-aware names to prevent queue collisions
3. **End-to-end workflows**: Add complete request-to-notification chain tests
4. **Performance testing**: No load testing for batch operations

## Related Documentation

- [LocalStack Testing](./LocalStack-Testing.md) - LocalStack configuration
- [Vitest Mocking Strategy](Vitest-Mocking-Strategy.md) - Unit test mocking patterns
- [Test Suite Audit](Test-Suite-Audit.md) - Comprehensive test analysis
