---
last_updated: 2026-01-03
next_review: 2026-07-03
status: current
---

# Semantic Search Quality Evaluation

**Generated**: 2026-01-03T20:08:53.361Z
**Queries Evaluated**: 10

## Summary Metrics

| Metric | Baseline | Improved | Change |
|--------|----------|----------|--------|
| Average Precision@5 | 64.0% | **78.0%** | +14.0% |
| Average First Relevant Rank | 1.70 | **1.00** | -0.70 (better) |
| Average Coverage | 56.7% | **63.3%** | +6.6% |

## Key Improvements

1. **Query Expansion**: Conceptual queries like "cascade deletion" now find relevant code by expanding to technical terms (Promise.allSettled, UserDelete, etc.)
2. **Enhanced Context Headers**: File path hints improve semantic matching (for example, "User deletion with cascade delete pattern")
3. **Type Boosting**: Functions are prioritized over variables for better relevance
4. **Distance Filtering**: Results above threshold are filtered out

### Most Improved Queries

| Query | Baseline Precision | Improved Precision |
|-------|-------------------|-------------------|
| cascade deletion | 0% | **80%** |
| push notification | 40% | **80%** |
| API response format | 40% | **80%** |

## Query-by-Query Analysis

### "error handling patterns"

**Metrics:**
- Precision@5: 100%
- First Relevant Rank: 1
- Coverage: 25%
- Avg Distance (Relevant): 0.2109
- Avg Distance (Irrelevant): 0.0000
- Distance Gap: -0.2109

**Expected Patterns:** src/lib/system/errors.ts, src/lib/lambda/responses.ts, src/lib/lambda/middleware/api.ts, error-classifier.ts

**Results:**
| Rank | File | Name | Type | Distance | Relevant |
|------|------|------|------|----------|----------|
| 1 | src/lib/system/errors.ts | CustomLambdaError | class | 0.1580 | Yes |
| 2 | src/lib/system/errors.ts | UnexpectedError | class | 0.2030 | Yes |
| 3 | src/lib/system/errors.ts | ValidationError | class | 0.2059 | Yes |
| 4 | src/lib/system/errors.ts | NotFoundError | class | 0.2249 | Yes |
| 5 | src/lib/system/errors.ts | ForbiddenError | class | 0.2626 | Yes |

### "authentication flow"

**Metrics:**
- Precision@5: 60%
- First Relevant Rank: 1
- Coverage: 33%
- Avg Distance (Relevant): 0.2825
- Avg Distance (Irrelevant): 0.3096
- Distance Gap: 0.0271

**Expected Patterns:** ApiGatewayAuthorizer, session-service.ts, LoginUser, RegisterUser, RefreshToken, BetterAuth

**Results:**
| Rank | File | Name | Type | Distance | Relevant |
|------|------|------|------|----------|----------|
| 1 | src/lambdas/ApiGatewayAuthorizer/src/index.ts | getUserIdFromAuthenticationHeader | function | 0.2482 | Yes |
| 2 | src/lambdas/ApiGatewayAuthorizer/src/index.ts | fetchApiKeys | function | 0.2964 | Yes |
| 3 | src/lib/domain/auth/session-service.ts | validateSessionToken | function | 0.3028 | Yes |
| 4 | src/lib/lambda/middleware/api.ts | wrapOptionalAuthHandler | function | 0.3076 | No |
| 5 | src/lib/lambda/context.ts | getUserDetailsFromEvent | function | 0.3117 | No |

### "S3 upload logic"

**Metrics:**
- Precision@5: 60%
- First Relevant Rank: 1
- Coverage: 75%
- Avg Distance (Relevant): 0.2812
- Avg Distance (Irrelevant): 0.2836
- Distance Gap: 0.0024

**Expected Patterns:** StartFileUpload, src/lib/vendor/AWS/S3.ts, YouTube.ts, S3ObjectCreated

**Results:**
| Rank | File | Name | Type | Distance | Relevant |
|------|------|------|------|----------|----------|
| 1 | src/lib/vendor/AWS/S3.ts | createS3Upload | function | 0.2052 | Yes |
| 2 | src/lambdas/StartFileUpload/src/index.ts | downloadVideoToS3Traced | function | 0.2936 | Yes |
| 3 | src/types/events.ts | DownloadCompletedDetail | interface | 0.2825 | No |
| 4 | src/types/notification-types.d.ts | DownloadReadyNotification | interface | 0.2848 | No |
| 5 | src/lambdas/S3ObjectCreated/src/index.ts | getFileByFilename | function | 0.3449 | Yes |

### "device registration"

**Metrics:**
- Precision@5: 100%
- First Relevant Rank: 1
- Coverage: 100%
- Avg Distance (Relevant): 0.2800
- Avg Distance (Irrelevant): 0.0000
- Distance Gap: -0.2800

**Expected Patterns:** RegisterDevice, device-queries.ts, device-service.ts, Device

**Results:**
| Rank | File | Name | Type | Distance | Relevant |
|------|------|------|------|----------|----------|
| 1 | src/lambdas/RegisterDevice/src/index.ts | upsertUserDevices | function | 0.2709 | Yes |
| 2 | src/entities/queries/device-queries.ts | upsertDevice | function | 0.2871 | Yes |
| 3 | src/lib/domain/device/device-service.ts | getUserDevices | function | 0.2871 | Yes |
| 4 | src/lib/domain/device/device-service.ts | deleteUserDevice | function | 0.2916 | Yes |
| 5 | tsp/models/models.tsp | DeviceRegistrationRequest | typespec-model | 0.2632 | Yes |

### "cascade deletion"

**Metrics:**
- Precision@5: 80%
- First Relevant Rank: 1
- Coverage: 50%
- Avg Distance (Relevant): 0.2905
- Avg Distance (Irrelevant): 0.2891
- Distance Gap: -0.0014

**Expected Patterns:** UserDelete, relationship-queries.ts, Promise.allSettled, deleteUser

**Results:**
| Rank | File | Name | Type | Distance | Relevant |
|------|------|------|------|----------|----------|
| 1 | src/lambdas/UserDelete/src/index.ts | deleteUserDevicesRelations | function | 0.2631 | Yes |
| 2 | src/lambdas/UserDelete/src/index.ts | deleteUser | function | 0.2668 | Yes |
| 3 | src/lambdas/UserDelete/src/index.ts | deleteUserFiles | function | 0.3012 | Yes |
| 4 | src/entities/queries/user-queries.ts | deleteUser | function | 0.3308 | Yes |
| 5 | src/mcp/validation/rules/cascade-safety.ts | cascadeSafetyRule | variable | 0.2891 | No |

### "push notification"

**Metrics:**
- Precision@5: 80%
- First Relevant Rank: 1
- Coverage: 100%
- Avg Distance (Relevant): 0.2950
- Avg Distance (Irrelevant): 0.2669
- Distance Gap: -0.0280

**Expected Patterns:** SendPushNotification, device-service.ts, APNS, notification

**Results:**
| Rank | File | Name | Type | Distance | Relevant |
|------|------|------|------|----------|----------|
| 1 | src/lib/domain/notification/transformers.ts | transformToAPNSNotification | function | 0.2794 | Yes |
| 2 | src/lambdas/SendPushNotification/src/index.ts | getDevice | function | 0.2856 | Yes |
| 3 | src/types/domain-models.d.ts | Device | interface | 0.2669 | No |
| 4 | src/lib/domain/device/device-service.ts | unsubscribeEndpointToTopic | function | 0.3073 | Yes |
| 5 | src/lib/domain/device/device-service.ts | subscribeEndpointToTopic | function | 0.3076 | Yes |

### "video download retry"

**Metrics:**
- Precision@5: 60%
- First Relevant Rank: 1
- Coverage: 75%
- Avg Distance (Relevant): 0.2031
- Avg Distance (Irrelevant): 0.2291
- Distance Gap: 0.0260

**Expected Patterns:** StartFileUpload, errorClassifier.ts, retry.ts, VideoError

**Results:**
| Rank | File | Name | Type | Distance | Relevant |
|------|------|------|------|----------|----------|
| 1 | src/lambdas/StartFileUpload/src/index.ts | fetchVideoInfoTraced | function | 0.1523 | Yes |
| 2 | src/lib/domain/video/errorClassifier.ts | classifyVideoError | function | 0.2171 | Yes |
| 3 | src/lib/vendor/YouTube.ts | fetchVideoInfo | function | 0.2374 | No |
| 4 | src/lambdas/StartFileUpload/src/index.ts | handleDownloadFailure | function | 0.2399 | Yes |
| 5 | src/types/events.ts | DownloadFailedDetail | interface | 0.2208 | No |

### "API response format"

**Metrics:**
- Precision@5: 80%
- First Relevant Rank: 1
- Coverage: 50%
- Avg Distance (Relevant): 0.2782
- Avg Distance (Irrelevant): 0.2737
- Distance Gap: -0.0045

**Expected Patterns:** src/lib/lambda/responses.ts, src/lib/lambda/middleware/api.ts, formatResponse, buildResponse

**Results:**
| Rank | File | Name | Type | Distance | Relevant |
|------|------|------|------|----------|----------|
| 1 | src/lib/lambda/responses.ts | formatUnknownError | function | 0.2570 | Yes |
| 2 | src/lib/lambda/responses.ts | formatResponse | function | 0.2680 | Yes |
| 3 | src/lib/lambda/responses.ts | buildErrorResponse | function | 0.2852 | Yes |
| 4 | src/lib/lambda/responses.ts | getErrorMessage | function | 0.3025 | Yes |
| 5 | src/types/infrastructure.d.ts | Default00GatewayResponse | interface | 0.2737 | No |

### "user session management"

**Metrics:**
- Precision@5: 60%
- First Relevant Rank: 1
- Coverage: 75%
- Avg Distance (Relevant): 0.2229
- Avg Distance (Irrelevant): 0.2881
- Distance Gap: 0.0652

**Expected Patterns:** sessionService.ts, sessionQueries.ts, Session, validateSessionToken

**Results:**
| Rank | File | Name | Type | Distance | Relevant |
|------|------|------|------|----------|----------|
| 1 | src/lib/domain/auth/sessionService.ts | validateSessionToken | function | 0.1955 | Yes |
| 2 | src/lib/domain/auth/sessionService.ts | refreshSession | function | 0.1975 | Yes |
| 3 | src/lambdas/RefreshToken/src/index.ts | handler | variable | 0.2489 | No |
| 4 | src/types/util.ts | SessionPayload | interface | 0.2756 | Yes |
| 5 | src/lambdas/ApiGatewayAuthorizer/src/index.ts | getUserIdFromAuthenticationHeader | function | 0.3273 | No |

### "file entity queries"

**Metrics:**
- Precision@5: 100%
- First Relevant Rank: 1
- Coverage: 50%
- Avg Distance (Relevant): 0.4192
- Avg Distance (Irrelevant): 0.0000
- Distance Gap: -0.4192

**Expected Patterns:** fileQueries.ts, relationshipQueries.ts, getFile, UserFiles

**Results:**
| Rank | File | Name | Type | Distance | Relevant |
|------|------|------|------|----------|----------|
| 1 | src/entities/queries/fileQueries.ts | upsertFile | function | 0.4124 | Yes |
| 2 | src/entities/queries/fileQueries.ts | getFile | function | 0.4130 | Yes |
| 3 | src/entities/queries/fileQueries.ts | getFileStatus | function | 0.4133 | Yes |
| 4 | src/entities/queries/fileQueries.ts | updateFile | function | 0.4258 | Yes |
| 5 | src/entities/queries/fileQueries.ts | updateFileDownload | function | 0.4314 | Yes |

## Recommendations

Based on this evaluation:

1. **Low Precision Queries**: None
2. **Missing First Rank**: None
3. **Low Coverage**: "error handling patterns" and "authentication flow"
