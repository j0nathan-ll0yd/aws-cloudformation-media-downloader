# End-to-End Testing Strategy

## Executive Summary

This document outlines a comprehensive strategy for enabling full end-to-end testing of the AWS Media Downloader application in production. Currently, only 2 of 8 API endpoints are testable without an iOS device. The primary blocker is Apple Sign-In with Apple (SIWA) authentication, which uses public key cryptography that cannot be bypassed without code changes.

## Current State

### Testing Coverage
- **Testable Endpoints** (2/8):
  - `GET /files` - Works with anonymous users
  - `POST /feedly` - Uses `isRemoteTestRequest()` bypass

- **Blocked Endpoints** (6/8):
  - `POST /registerDevice` - Requires iOS device token
  - `POST /userSubscribe` - Requires registered device
  - `POST /registerUser` - Requires Apple auth code
  - `POST /loginUser` - Requires Apple auth code
  - `POST /logEvent` - Requires authentication
  - `DELETE /userDelete` - Requires authentication

### Existing Testing Infrastructure

#### Unit Tests
- **Framework**: Jest with ES modules
- **Coverage**: All Lambda functions and utilities
- **Pattern**: Comprehensive mocking of AWS SDK and external dependencies
- **Location**: `src/lambdas/*/test/index.test.ts`

#### LocalStack Integration Tests
- **Framework**: Jest + LocalStack (Docker)
- **Coverage**: AWS service orchestration
- **Services**: S3, DynamoDB, SNS, SQS, Lambda, CloudWatch, API Gateway
- **Location**: `test/integration/workflows/*.workflow.integration.test.ts`

#### Production Remote Tests
- **Available Scripts**:
  ```bash
  npm run test-remote-list  # Anonymous file listing
  npm run test-remote-hook  # Feedly webhook with bypass
  ```

### Test Bypass Mechanism

The API Gateway Authorizer includes a test bypass:

```typescript
function isRemoteTestRequest(event): boolean {
  const reservedIp = process.env.ReservedClientIp     // "104.1.88.244"
  const userAgent = event.headers['User-Agent']
  const clientIp = event.requestContext.identity.sourceIp

  return clientIp === reservedIp && userAgent === 'localhost@lifegames'
}

// When triggered, returns fake userId: '123e4567-e89b-12d3-a456-426614174000'
```

## The Apple Authentication Barrier

### Why We Cannot Bypass Without Code Changes

Apple's authentication is **cryptographically secure**:

1. **Authorization Code Flow**:
   ```
   iOS App → Apple Auth → Authorization Code → Lambda
   ```

2. **Token Exchange** (`validateAuthCodeForToken`):
   ```typescript
   // Makes real HTTPS call to Apple
   POST https://appleid.apple.com/auth/token
   Body: { code: authCode, client_id, client_secret }
   Response: { id_token: JWT signed by Apple }
   ```

3. **JWT Verification** (`verifyAppleToken`):
   ```typescript
   // Fetches Apple's public keys at runtime
   GET https://appleid.apple.com/auth/keys

   // Cryptographically verifies signature
   jose.jwtVerify(token, applePublicKey)
   ```

4. **Mathematical Impossibility**:
   - JWTs are signed with Apple's **private key** (which we don't have)
   - Verification uses Apple's **public key** (fetched at runtime)
   - Without the private key, we cannot create valid signatures
   - This is the foundation of public key cryptography

### APNS Token Validation

Similarly, device tokens face validation:

```typescript
// AWS SNS validates token format with APNS
const response = await createPlatformEndpoint({
  PlatformApplicationArn: "arn:aws:sns:...:APNS_SANDBOX/...",
  Token: deviceToken  // Must be valid APNS format
})
```

## Proposed Solution

### Three-Phase Approach

Given the cryptographic constraints, we propose a three-phase solution:

### Phase 1: Extend Test Bypass Mechanism (Essential)

Add controlled test mode bypasses to enable E2E testing without modifying production logic.

#### Implementation

1. **Environment Variables**:
   ```hcl
   # terraform/api_gateway_authorizer.tf
   environment {
     variables = {
       TestModeEnabled  = var.enable_test_mode ? "true" : "false"
       TestUserId       = "123e4567-e89b-12d3-a456-426614174000"
       ReservedClientIp = "104.1.88.244"
     }
   }
   ```

2. **Test Constants**:
   ```typescript
   const TEST_AUTH_CODE = "TEST_APPLE_AUTH_CODE"
   const TEST_DEVICE_TOKEN = "TEST_APNS_DEVICE_TOKEN"
   const TEST_USER_AGENT = "test-runner@lifegames"
   ```

3. **Mock Apple Authentication**:
   ```typescript
   // src/util/secretsmanager-helpers.ts
   export async function validateAuthCodeForToken(authCode: string) {
     // Test mode bypass
     if (process.env.TestModeEnabled === 'true' &&
         authCode === TEST_AUTH_CODE) {
       return {
         id_token: await createMockAppleToken(),
         access_token: 'test-access-token',
         refresh_token: 'test-refresh-token',
         token_type: 'Bearer',
         expires_in: 3600
       }
     }

     // Production flow unchanged
     const response = await axios.post('https://appleid.apple.com/auth/token', ...)
     return response.data
   }
   ```

4. **Mock APNS Registration**:
   ```typescript
   // src/lambdas/RegisterDevice/src/index.ts
   async function createPlatformEndpointFromToken(token: string) {
     // Test mode bypass
     if (process.env.TestModeEnabled === 'true' &&
         token === TEST_DEVICE_TOKEN) {
       return {
         EndpointArn: `arn:aws:sns:us-west-2:test:endpoint/${Date.now()}`
       }
     }

     // Production flow unchanged
     return await createPlatformEndpoint({...})
   }
   ```

#### Test Scripts

Create comprehensive test scripts:

```bash
# bin/test-e2e-production.sh
#!/usr/bin/env bash

# 1. Test user registration
curl -X POST "$API_URL/registerUser" \
  -H "User-Agent: test-runner@lifegames" \
  -H "X-Forwarded-For: 104.1.88.244" \
  -d '{"authorizationCode": "TEST_APPLE_AUTH_CODE"}'

# 2. Test device registration
curl -X POST "$API_URL/registerDevice" \
  -H "User-Agent: test-runner@lifegames" \
  -H "X-Forwarded-For: 104.1.88.244" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"token": "TEST_APNS_DEVICE_TOKEN", "deviceId": "test-device"}'

# 3. Test file listing
curl -X GET "$API_URL/files" \
  -H "Authorization: Bearer $TOKEN"
```

### Phase 2: LocalStack Full Workflow Tests

Extend existing LocalStack tests to cover complete user journeys.

#### New Test Files

1. **User Registration Workflow**:
   ```typescript
   // test/integration/workflows/userRegistration.workflow.integration.test.ts
   test('should complete full registration flow', async () => {
     // Register user
     const registerResult = await registerUserHandler(
       createRegisterUserEvent('MOCK_AUTH_CODE'),
       mockContext
     )
     const {token} = JSON.parse(registerResult.body).body

     // Register device
     const deviceResult = await registerDeviceHandler(
       createRegisterDeviceEvent('MOCK_DEVICE_TOKEN', token),
       mockContext
     )
     const {endpointArn} = JSON.parse(deviceResult.body).body

     // Subscribe to notifications
     const subscribeResult = await userSubscribeHandler(
       createUserSubscribeEvent(endpointArn, topicArn),
       mockContext
     )

     // Verify user can list files
     const listResult = await listFilesHandler(
       createListFilesEvent(token),
       mockContext
     )
     expect(listResult.statusCode).toBe(200)
   })
   ```

2. **File Download Workflow**:
   ```typescript
   // test/integration/workflows/fileDownload.workflow.integration.test.ts
   test('should complete file download flow', async () => {
     // Trigger webhook
     const webhookResult = await webhookFeedlyHandler(
       createWebhookEvent(videoUrl),
       mockContext
     )

     // Start file upload
     const uploadResult = await startFileUploadHandler(
       createFileUploadEvent(fileId),
       mockContext
     )

     // Verify file in S3
     const s3Objects = await listS3Objects()
     expect(s3Objects).toContain(fileId)

     // Verify file in listing
     const listResult = await listFilesHandler(
       createListFilesEvent(token),
       mockContext
     )
     const files = JSON.parse(listResult.body).body.contents
     expect(files).toContainEqual(expect.objectContaining({fileId}))
   })
   ```

### Phase 3: Dedicated Test Environment (Optional)

Create isolated AWS infrastructure for comprehensive testing.

#### Infrastructure

```hcl
# terraform/environments/test/main.tf
module "media_downloader_test" {
  source = "../../"

  environment_name    = "test"
  enable_test_mode    = true
  test_allowed_ips    = ["104.1.88.244"]
  apns_platform       = "APNS_SANDBOX"

  # Use test-prefixed resources
  dynamodb_table_prefix = "test-"
  s3_bucket_prefix      = "test-"
  api_gateway_stage     = "test"
}
```

#### CI/CD Integration

```yaml
# .github/workflows/e2e-test.yml
name: E2E Tests
on: [push, pull_request]

jobs:
  e2e-test:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy test environment
        run: |
          cd terraform/environments/test
          tofu apply -auto-approve

      - name: Run E2E tests
        run: |
          export TEST_API_URL=$(tofu output api_gateway_url)
          npm run test:e2e

      - name: Teardown test environment
        if: always()
        run: |
          cd terraform/environments/test
          tofu destroy -auto-approve
```

## Implementation Timeline

### Week 1: Test Bypasses
- [ ] Add test mode environment variables
- [ ] Implement Apple auth bypass
- [ ] Implement APNS registration bypass
- [ ] Create basic E2E test script
- [ ] Document test mode usage

### Week 2-3: LocalStack Tests
- [ ] Create user registration workflow test
- [ ] Create device management workflow test
- [ ] Create file download workflow test
- [ ] Add mock external service helpers
- [ ] Achieve 80% workflow coverage

### Month 2: Test Environment (Optional)
- [ ] Create test OpenTofu module
- [ ] Set up CI/CD pipeline
- [ ] Add E2E test suite
- [ ] Create test data management scripts
- [ ] Document test environment setup

## Security Considerations

### IP Restriction
- Test mode ONLY activates from reserved IP (104.1.88.244)
- Additional User-Agent validation required
- Cannot be triggered from arbitrary locations

### Environment Isolation
- Test mode controlled by environment variable
- Default is disabled in production
- Separate test environment recommended for safety

### Audit Trail
- All test requests logged with special marker
- Can trace test vs production traffic
- Clear separation in CloudWatch logs

## Testing Scenarios

### Scenario 1: Complete User Journey
```bash
# 1. Anonymous file listing (should show default file)
GET /files

# 2. Register new user
POST /registerUser
Body: {authorizationCode: "TEST_APPLE_AUTH_CODE"}
Response: {token: "jwt-token"}

# 3. Register device
POST /registerDevice
Headers: Authorization: Bearer jwt-token
Body: {token: "TEST_APNS_DEVICE_TOKEN", deviceId: "test-device-001"}
Response: {endpointArn: "arn:aws:sns:..."}

# 4. Subscribe to notifications
POST /userSubscribe
Body: {endpointArn: "...", topicArn: "..."}

# 5. Trigger file download
POST /feedly
Body: {url: "https://youtube.com/watch?v=..."}

# 6. List files (should show downloaded file)
GET /files
Headers: Authorization: Bearer jwt-token
```

### Scenario 2: Error Handling
```bash
# Invalid auth code
POST /registerUser
Body: {authorizationCode: "INVALID_CODE"}
Expected: 401 Unauthorized

# Expired token
GET /files
Headers: Authorization: Bearer expired-token
Expected: 401 Unauthorized

# Missing APNS configuration
POST /registerDevice
Body: {token: "TEST_APNS_DEVICE_TOKEN"}
Expected: 503 Service Unavailable (if APNS not configured)
```

## Success Metrics

### Coverage Goals
- **Endpoint Coverage**: 8/8 endpoints testable (100%)
- **Workflow Coverage**: All critical user paths tested
- **LocalStack Coverage**: 80% of AWS service interactions
- **CI/CD Integration**: E2E tests run on every PR

### Performance Goals
- **Test Execution**: < 5 minutes for full suite
- **Setup Time**: < 2 minutes for test environment
- **Parallel Execution**: Support concurrent test runs

### Quality Goals
- **False Positive Rate**: < 1%
- **Test Stability**: 99% success rate for valid code
- **Error Detection**: Catch 90% of integration issues

## Alternatives Considered

### Option 1: Real iOS Device Farm
- **Pros**: Tests actual Apple authentication
- **Cons**: Expensive, slow, complex setup
- **Decision**: Not practical for regular testing

### Option 2: Proxy Apple's APIs
- **Pros**: Could intercept and mock responses
- **Cons**: Complex, fragile, security concerns
- **Decision**: Too risky and maintenance-heavy

### Option 3: Alternative Authentication Only
- **Pros**: No test mode needed
- **Cons**: Doesn't test Apple auth path
- **Decision**: Implement separately (see Alternative Authentication plan)

## Related Documentation

- [Alternative Authentication Implementation](./implement-alternative-authentication.md)
- [Conditional Functionality Implementation](./conditional-functionality-implementation.md)
- [LocalStack Integration Tests](../../test/integration/README.md)

## Conclusion

While we cannot bypass Apple's cryptographic authentication without code changes, the proposed test mode solution provides a secure, controlled way to achieve comprehensive E2E testing. The three-phase approach balances immediate needs with long-term sustainability, enabling full testing coverage while maintaining production security.

## Next Steps

1. **Immediate**: Implement Phase 1 test bypasses (16 hours)
2. **Short-term**: Extend LocalStack tests (24 hours)
3. **Long-term**: Consider dedicated test environment (40 hours)
4. **Parallel**: Implement alternative authentication for true production testing without bypasses