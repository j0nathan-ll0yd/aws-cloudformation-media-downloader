# Lambda Reference Index

Complete reference for all 18 Lambda functions in the project.

## Quick Navigation

| Lambda | Trigger | Purpose |
|--------|---------|---------|
| [ApiGatewayAuthorizer](#apigateways-authorizer) | API Gateway | Authorize API requests |
| [CleanupExpiredRecords](#cleanupexpiredrecords) | CloudWatch Events | Clean expired database records |
| [CloudfrontMiddleware](#cloudfrontmiddleware) | CloudFront | Edge request processing |
| [DeviceEvent](#deviceevent) | API Gateway | Log client device events |
| [ListFiles](#listfiles) | API Gateway | List user's files |
| [LoginUser](#loginuser) | API Gateway | User authentication |
| [MigrateDSQL](#migratedsql) | Manual CLI | Run database migrations |
| [PruneDevices](#prunedevices) | CloudWatch Events | Clean inactive devices |
| [RefreshToken](#refreshtoken) | API Gateway | Refresh auth tokens |
| [RegisterDevice](#registerdevice) | API Gateway | Register iOS devices |
| [RegisterUser](#registeruser) | API Gateway | User registration |
| [S3ObjectCreated](#s3objectcreated) | S3 Event | Handle uploaded files |
| [SendPushNotification](#sendpushnotification) | SQS | Send APNS notifications |
| [StartFileUpload](#startfileupload) | SQS | Download videos to S3 |
| [UserDelete](#userdelete) | API Gateway | Delete user account |
| [UserSubscribe](#usersubscribe) | API Gateway | Manage subscriptions |
| [WebhookFeedly](#webhookfeedly) | API Gateway | Process Feedly articles |

---

## API Gateway Lambdas

### ApiGatewayAuthorizer

Custom authorizer for API Gateway using Better Auth sessions.

| Attribute | Value |
|-----------|-------|
| **Trigger** | API Gateway (Custom Authorizer) |
| **Input** | `APIGatewayRequestAuthorizerEvent` |
| **Output** | `CustomAuthorizerResult` (IAM policy) |
| **Source** | `src/lambdas/ApiGatewayAuthorizer/src/index.ts` |
| **Test** | `src/lambdas/ApiGatewayAuthorizer/test/index.test.ts` |
| **Integration Test** | Yes |

**Purpose**: Validates session tokens from Authorization header and generates IAM policies for API access.

---

### DeviceEvent

Logs client-side device events for telemetry.

| Attribute | Value |
|-----------|-------|
| **Trigger** | API Gateway (POST /events) |
| **Input** | `APIGatewayProxyEvent` |
| **Output** | `APIGatewayProxyResult` |
| **Source** | `src/lambdas/DeviceEvent/src/index.ts` |
| **Test** | `src/lambdas/DeviceEvent/test/index.test.ts` |
| **Integration Test** | No (low-risk telemetry) |

**Purpose**: Receives telemetry events from iOS app for analytics and debugging.

---

### ListFiles

Lists files available to the authenticated user.

| Attribute | Value |
|-----------|-------|
| **Trigger** | API Gateway (GET /files) |
| **Input** | `APIGatewayProxyEvent` (authenticated) |
| **Output** | `APIGatewayProxyResult` with file list |
| **Source** | `src/lambdas/ListFiles/src/index.ts` |
| **Test** | `src/lambdas/ListFiles/test/index.test.ts` |
| **Integration Test** | Yes |

**Purpose**: Returns paginated list of files associated with the user.

---

### LoginUser

Authenticates users via Better Auth.

| Attribute | Value |
|-----------|-------|
| **Trigger** | API Gateway (POST /auth/login) |
| **Input** | `APIGatewayProxyEvent` with credentials |
| **Output** | `APIGatewayProxyResult` with session token |
| **Source** | `src/lambdas/LoginUser/src/index.ts` |
| **Test** | `src/lambdas/LoginUser/test/index.test.ts` |
| **Integration Test** | Yes |

**Purpose**: Validates credentials and creates a new session.

---

### RefreshToken

Refreshes expired authentication tokens.

| Attribute | Value |
|-----------|-------|
| **Trigger** | API Gateway (POST /auth/refresh) |
| **Input** | `APIGatewayProxyEvent` with refresh token |
| **Output** | `APIGatewayProxyResult` with new tokens |
| **Source** | `src/lambdas/RefreshToken/src/index.ts` |
| **Test** | `src/lambdas/RefreshToken/test/index.test.ts` |
| **Integration Test** | Yes |

**Purpose**: Issues new access tokens using a valid refresh token.

---

### RegisterDevice

Registers iOS devices for push notifications.

| Attribute | Value |
|-----------|-------|
| **Trigger** | API Gateway (POST /devices) |
| **Input** | `APIGatewayProxyEvent` with device token |
| **Output** | `APIGatewayProxyResult` |
| **Source** | `src/lambdas/RegisterDevice/src/index.ts` |
| **Test** | `src/lambdas/RegisterDevice/test/index.test.ts` |
| **Integration Test** | Yes |

**Purpose**: Stores APNS device tokens for push notification delivery.

---

### RegisterUser

Creates new user accounts.

| Attribute | Value |
|-----------|-------|
| **Trigger** | API Gateway (POST /auth/register) |
| **Input** | `APIGatewayProxyEvent` with user data |
| **Output** | `APIGatewayProxyResult` with user info |
| **Source** | `src/lambdas/RegisterUser/src/index.ts` |
| **Test** | `src/lambdas/RegisterUser/test/index.test.ts` |
| **Integration Test** | Yes |

**Purpose**: Registers new users with Sign In with Apple integration.

---

### UserDelete

Deletes user accounts with cascade cleanup.

| Attribute | Value |
|-----------|-------|
| **Trigger** | API Gateway (DELETE /users) |
| **Input** | `APIGatewayProxyEvent` (authenticated) |
| **Output** | `APIGatewayProxyResult` |
| **Source** | `src/lambdas/UserDelete/src/index.ts` |
| **Test** | `src/lambdas/UserDelete/test/index.test.ts` |
| **Integration Test** | Yes |

**Purpose**: Removes user and all associated data (files, devices, sessions).

---

### UserSubscribe

Manages user topic subscriptions.

| Attribute | Value |
|-----------|-------|
| **Trigger** | API Gateway (POST /subscriptions) |
| **Input** | `APIGatewayProxyEvent` with subscription data |
| **Output** | `APIGatewayProxyResult` |
| **Source** | `src/lambdas/UserSubscribe/src/index.ts` |
| **Test** | `src/lambdas/UserSubscribe/test/index.test.ts` |
| **Integration Test** | Yes |

**Purpose**: Subscribes/unsubscribes users from content topics.

---

### WebhookFeedly

Processes articles from Feedly webhooks.

| Attribute | Value |
|-----------|-------|
| **Trigger** | API Gateway (POST /webhooks/feedly) |
| **Input** | `APIGatewayProxyEvent` with Feedly payload |
| **Output** | `APIGatewayProxyResult` |
| **Source** | `src/lambdas/WebhookFeedly/src/index.ts` |
| **Test** | `src/lambdas/WebhookFeedly/test/index.test.ts` |
| **Integration Test** | Yes |

**Purpose**: Receives Feedly articles, extracts video URLs, and queues downloads.

---

## Event-Driven Lambdas

### S3ObjectCreated

Handles S3 object creation events.

| Attribute | Value |
|-----------|-------|
| **Trigger** | S3 Event (s3:ObjectCreated) |
| **Input** | `S3Event` |
| **Output** | SQS message to SendPushNotification |
| **Source** | `src/lambdas/S3ObjectCreated/src/index.ts` |
| **Test** | `src/lambdas/S3ObjectCreated/test/index.test.ts` |
| **Integration Test** | Yes |

**Purpose**: Updates file status in database and triggers push notifications.

---

### SendPushNotification

Sends APNS push notifications.

| Attribute | Value |
|-----------|-------|
| **Trigger** | SQS (from S3ObjectCreated) |
| **Input** | `SQSEvent` with notification payload |
| **Output** | APNS delivery |
| **Source** | `src/lambdas/SendPushNotification/src/index.ts` |
| **Test** | `src/lambdas/SendPushNotification/test/index.test.ts` |
| **Integration Test** | Yes |

**Purpose**: Delivers push notifications to registered iOS devices.

---

### StartFileUpload

Downloads videos from YouTube to S3.

| Attribute | Value |
|-----------|-------|
| **Trigger** | SQS (DownloadQueue via EventBridge) |
| **Input** | `SQSEvent` with video URL |
| **Output** | S3 upload |
| **Source** | `src/lambdas/StartFileUpload/src/index.ts` |
| **Test** | `src/lambdas/StartFileUpload/test/index.test.ts` |
| **Integration Test** | Yes |

**Purpose**: Uses yt-dlp to download videos and uploads to S3 with transfer acceleration.

---

## Scheduled Lambdas

### CleanupExpiredRecords

Removes expired database records.

| Attribute | Value |
|-----------|-------|
| **Trigger** | CloudWatch Events (Daily at 3 AM UTC) |
| **Input** | `ScheduledEvent` |
| **Output** | Cleanup stats |
| **Source** | `src/lambdas/CleanupExpiredRecords/src/index.ts` |
| **Test** | `src/lambdas/CleanupExpiredRecords/test/index.test.ts` |
| **Integration Test** | Yes |

**Purpose**: Cleans up expired sessions, verification tokens, and stale records.

---

### PruneDevices

Removes inactive device registrations.

| Attribute | Value |
|-----------|-------|
| **Trigger** | CloudWatch Events (Daily schedule) |
| **Input** | `ScheduledEvent` |
| **Output** | Prune stats |
| **Source** | `src/lambdas/PruneDevices/src/index.ts` |
| **Test** | `src/lambdas/PruneDevices/test/index.test.ts` |
| **Integration Test** | Yes |

**Purpose**: Removes devices that haven't been active for extended periods.

---

## Edge Lambdas

### CloudfrontMiddleware

CloudFront edge processing.

| Attribute | Value |
|-----------|-------|
| **Trigger** | CloudFront (Edge requests) |
| **Input** | CloudFront request event |
| **Output** | Modified request/response |
| **Source** | `src/lambdas/CloudfrontMiddleware/src/index.ts` |
| **Test** | `src/lambdas/CloudfrontMiddleware/test/index.test.ts` |
| **Integration Test** | No (CloudFront@Edge limitations) |

**Purpose**: Processes requests at the CDN edge for performance optimization.

---

## Manual/CLI Lambdas

### MigrateDSQL

Runs Drizzle ORM migrations on Aurora DSQL.

| Attribute | Value |
|-----------|-------|
| **Trigger** | Manual CLI invocation |
| **Input** | None (CLI trigger) |
| **Output** | Migration results |
| **Source** | `src/lambdas/MigrateDSQL/src/index.ts` |
| **Test** | `src/lambdas/MigrateDSQL/test/index.test.ts` |
| **Integration Test** | No (validated via CI pipeline) |

**Purpose**: Applies database schema migrations to Aurora DSQL.

---

## Lambda Flow Diagram

```
                         ┌──────────────────┐
                         │   API Gateway    │
                         │  (Authorizer)    │
                         └────────┬─────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
          ▼                       ▼                       ▼
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│    LoginUser     │   │   WebhookFeedly  │   │    ListFiles     │
│   RegisterUser   │   │                  │   │   RegisterDevice │
│   RefreshToken   │   │                  │   │    UserDelete    │
└──────────────────┘   └────────┬─────────┘   └──────────────────┘
                                │
                                ▼
                      ┌──────────────────┐
                      │   EventBridge    │
                      └────────┬─────────┘
                               │
                               ▼
                      ┌──────────────────┐
                      │  DownloadQueue   │ (SQS)
                      └────────┬─────────┘
                               │
                               ▼
                      ┌──────────────────┐
                      │ StartFileUpload  │
                      └────────┬─────────┘
                               │
                               ▼
                      ┌──────────────────┐
                      │       S3         │
                      └────────┬─────────┘
                               │
                               ▼
                      ┌──────────────────┐
                      │ S3ObjectCreated  │
                      └────────┬─────────┘
                               │
                               ▼
                      ┌──────────────────┐
                      │  Notification    │ (SQS)
                      │     Queue        │
                      └────────┬─────────┘
                               │
                               ▼
                      ┌──────────────────┐
                      │SendPushNotification│
                      └────────┬─────────┘
                               │
                               ▼
                      ┌──────────────────┐
                      │      APNS        │
                      └──────────────────┘
```

## Integration Test Coverage

| Lambda | Has Tests | Integration Tested | Notes |
|--------|-----------|-------------------|-------|
| ApiGatewayAuthorizer | Yes | Yes | - |
| CleanupExpiredRecords | Yes | Yes | - |
| CloudfrontMiddleware | Yes | No | CloudFront@Edge limitations |
| DeviceEvent | Yes | No | Low-risk telemetry |
| ListFiles | Yes | Yes | - |
| LoginUser | Yes | Yes | - |
| MigrateDSQL | Yes | No | Validated via CI |
| PruneDevices | Yes | Yes | - |
| RefreshToken | Yes | Yes | - |
| RegisterDevice | Yes | Yes | - |
| RegisterUser | Yes | Yes | - |
| S3ObjectCreated | Yes | Yes | - |
| SendPushNotification | Yes | Yes | - |
| StartFileUpload | Yes | Yes | - |
| UserDelete | Yes | Yes | - |
| UserSubscribe | Yes | Yes | - |
| WebhookFeedly | Yes | Yes | - |

**Coverage**: 18/18 (100%) unit tests, 14/17 (82%) integration tests

## Related Documentation

- [Lambda Function Patterns](Lambda-Function-Patterns.md) - Handler patterns
- [Lambda Middleware Patterns](Lambda-Middleware-Patterns.md) - Wrapper functions
- [Integration Test Coverage](../Testing/Integration-Test-Coverage.md) - Test details
- [CloudWatch Logging](../AWS/CloudWatch-Logging.md) - Log groups
