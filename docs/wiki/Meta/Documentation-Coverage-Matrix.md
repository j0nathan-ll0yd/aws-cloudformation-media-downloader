# Documentation Coverage Matrix

This document provides a comprehensive overview of documentation coverage across the codebase, generated from the January 2026 documentation audit.

## Lambda Function Coverage

All 18 Lambda functions have TSDoc comments in their handlers. Wiki references are primarily in `Testing/Integration-Test-Coverage.md`.

| Lambda | TSDoc | Wiki Refs | Test File | Integration Test |
|--------|-------|-----------|-----------|------------------|
| ApiGatewayAuthorizer | Yes | Integration-Test-Coverage | Yes | Yes |
| CleanupExpiredRecords | Yes | Integration-Test-Coverage | Yes | Yes |
| CloudfrontMiddleware | Yes | Integration-Test-Coverage | Yes | No (Edge) |
| DeviceEvent | Yes | Integration-Test-Coverage | Yes | No (Telemetry) |
| ListFiles | Yes | Integration-Test-Coverage, Lambda-Function-Patterns | Yes | Yes |
| LoginUser | Yes | Integration-Test-Coverage | Yes | Yes |
| MigrateDSQL | Yes | Integration-Test-Coverage | Yes | No (Manual CLI) |
| PruneDevices | Yes | Integration-Test-Coverage | Yes | Yes |
| RefreshToken | Yes | Integration-Test-Coverage | Yes | Yes |
| RegisterDevice | Yes | Integration-Test-Coverage | Yes | Yes |
| RegisterUser | Yes | Integration-Test-Coverage | Yes | Yes |
| S3ObjectCreated | Yes | Integration-Test-Coverage | Yes | Yes |
| SendPushNotification | Yes | Integration-Test-Coverage, Security-Audit-Report | Yes | Yes |
| StartFileUpload | Yes | Integration-Test-Coverage, Lambda-Middleware-Patterns | Yes | Yes |
| UserDelete | Yes | Integration-Test-Coverage | Yes | Yes |
| UserSubscribe | Yes | Integration-Test-Coverage | Yes | Yes |
| WebhookFeedly | Yes | Integration-Test-Coverage, Security-Audit-Report | Yes | Yes |

**Summary**: 18/18 (100%) have TSDoc, 18/18 (100%) have wiki references, 14/17 (82%) have integration tests.

## Wiki Category Coverage

| Category | Files | Quality Score | Key Pages |
|----------|-------|---------------|-----------|
| Conventions | 11 | 9/10 | Vendor-Encapsulation-Policy, Git-Workflow, Naming-Conventions |
| Testing | 16 | 9/10 | Vitest-Mocking-Strategy, Integration-Test-Coverage, Coverage-Philosophy |
| TypeScript | 12 | 8.5/10 | Lambda-Function-Patterns, Drizzle-Patterns, Type-Definitions |
| Meta | 10 | 9/10 | Conventions-Tracking, Convention-Capture-System, Documentation-Structure |
| Infrastructure | 5 | 9/10 | OpenTofu-Patterns, CI-Workflow-Reference |
| MCP | 5 | 8/10 | Convention-Tools, MCP-Setup-Guide |
| AWS | 3 | 8.5/10 | CloudWatch-Logging, Lambda-Environment-Variables, X-Ray-Integration |
| Bash | 6 | 5/10 | Script-Patterns (needs expansion), Variable-Naming |
| Architecture | 2 | 7/10 | Domain-Layer (needs expansion), Code-Organization |
| Methodologies | 4 | 8/10 | Convention-Over-Configuration, Library-Migration-Checklist |
| Integration | 1 | 8/10 | LocalStack-Testing |
| Security | 1 | 8/10 | Security-Audit-Report |
| iOS | 1 | 8/10 | Apple-Sign-In-ID-Token-Migration |
| Authentication | 1 | 8/10 | Better-Auth-Architecture |

**Total**: 79 wiki pages across 14 categories

## Source Code Documentation Status

### Entity Query Functions (`src/entities/queries/`)

| File | Functions | TSDoc | Wiki Page |
|------|-----------|-------|-----------|
| user-queries.ts | 8 | Yes | None (GAP) |
| file-queries.ts | 14 | Yes | None (GAP) |
| device-queries.ts | 8 | Yes | None (GAP) |
| session-queries.ts | 20 | Yes | None (GAP) |
| relationship-queries.ts | 17 | Yes | None (GAP) |

**Recommendation**: Create `TypeScript/Entity-Query-Patterns.md`

### System Library (`src/lib/system/`)

| File | Purpose | TSDoc | Wiki Page |
|------|---------|-------|-----------|
| circuit-breaker.ts | Resilience pattern | Yes | Resilience-Patterns (partial) |
| retry.ts | Retry utilities | Yes | None (GAP) |
| errors.ts | Error types | Yes | TypeScript-Error-Handling (partial) |
| env.ts | Environment utilities | Yes | Lambda-Environment-Variables (partial) |
| observability.ts | Observability helpers | Yes | None (GAP) |
| logging.ts | Logging functions | Yes | PII-Protection (partial) |

**Recommendation**: Create `TypeScript/System-Library.md`

### Lambda Middleware (`src/lib/lambda/middleware/`)

| File | Purpose | Wiki Coverage |
|------|---------|---------------|
| api.ts | API handler wrapper | Lambda-Function-Patterns |
| api-gateway.ts | API Gateway types | Lambda-Function-Patterns |
| validation.ts | Request validation | Lambda-Middleware-Patterns (partial) |
| sanitization.ts | Input sanitization | Lambda-Middleware-Patterns (partial) |
| security-headers.ts | Security headers | Lambda-Middleware-Patterns (partial) |
| sqs.ts | SQS handler wrapper | Lambda-Function-Patterns |
| powertools.ts | AWS Powertools | Lambda-Function-Patterns |
| correlation.ts | Correlation IDs | None (GAP) |
| internal.ts | Internal handlers | None (GAP) |
| legacy.ts | Legacy patterns | None (GAP) |

**Recommendation**: Expand `TypeScript/Lambda-Middleware-Patterns.md`

### Test Helpers (`test/helpers/`)

| File | Purpose | Wiki Coverage |
|------|---------|---------------|
| entity-fixtures.ts | Mock entity data | Vitest-Mocking-Strategy |
| aws-sdk-mock.ts | AWS SDK mocks | Vitest-Mocking-Strategy |
| drizzle-mock.ts | Drizzle mocks | Test-Suite-Audit |
| better-auth-mock.ts | Better Auth mocks | Test-Suite-Audit |
| event-factories.ts | Event factories | Vitest-Mocking-Strategy (partial) |
| aws-response-factories.ts | AWS response factories | None (GAP) |

**Recommendation**: Add aws-response-factories section to Vitest-Mocking-Strategy

### Vendor Wrappers (`src/lib/vendor/`)

| Directory/File | Purpose | Wiki Coverage |
|----------------|---------|---------------|
| AWS/ (8 files) | AWS SDK wrappers | Vendor-Encapsulation-Policy |
| Drizzle/ | Drizzle ORM config | Drizzle-Patterns |
| BetterAuth/ | Auth configuration | Lambda-Function-Patterns (partial) |
| YouTube.ts | YouTube/yt-dlp | None (GAP) |

**Recommendation**: Create `TypeScript/External-Integrations.md`

### External Integrations (`src/lib/integrations/`)

| Directory | Purpose | Wiki Coverage |
|-----------|---------|---------------|
| github/ | GitHub issue service | None (GAP) |

**Recommendation**: Include in `TypeScript/External-Integrations.md`

## Coverage Summary

| Area | Documented | Total | Coverage |
|------|------------|-------|----------|
| Lambda TSDoc | 18 | 18 | 100% |
| Lambda Wiki Refs | 18 | 18 | 100% |
| Entity Queries | 0 | 5 | 0% |
| System Library | 3 (partial) | 6 | 50% |
| Middleware | 5 | 10 | 50% |
| Test Helpers | 5 | 6 | 83% |
| Vendor Wrappers | 3 | 4 | 75% |

## Related Documentation

- [Documentation Gap Analysis](Documentation-Gap-Analysis.md)
- [Documentation Structure](Documentation-Structure.md)
- [Conventions Tracking](Conventions-Tracking.md)
