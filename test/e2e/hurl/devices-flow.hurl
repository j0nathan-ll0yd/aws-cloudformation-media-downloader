# Device Registration Flow E2E Tests
# Tests device registration and push notification setup
#
# Prerequisites:
# - LocalStack running (pnpm run localstack:start)
# - SNS platform application configured
#
# Run: hurl --test --variables-file test/e2e/hurl/vars.env test/e2e/hurl/devices-flow.hurl

# =============================================================================
# Test 1: Setup - Register Test User
# =============================================================================

POST {{BASE_URL}}/user/register?ApiKey={{API_KEY}}
Content-Type: application/json
{
  "idToken": "mock-apple-id-token-device-test",
  "firstName": "Device",
  "lastName": "Tester"
}

HTTP 200
[Captures]
user_token: jsonpath "$.body.token"
user_id: jsonpath "$.body.userId"


# =============================================================================
# Test 2: Register Device (Authenticated)
# =============================================================================
# Register an iOS device for push notifications

POST {{BASE_URL}}/device/register?ApiKey={{API_KEY}}
Authorization: Bearer {{user_token}}
Content-Type: application/json
{
  "deviceId": "{{TEST_DEVICE_ID}}",
  "name": "{{TEST_DEVICE_NAME}}",
  "systemName": "iOS",
  "systemVersion": "17.0",
  "token": "{{TEST_DEVICE_TOKEN}}"
}

HTTP 200
[Captures]
endpoint_arn: jsonpath "$.body.endpointArn"

[Asserts]
jsonpath "$.body.endpointArn" exists
jsonpath "$.body.endpointArn" matches "^arn:aws:sns:"
jsonpath "$.requestId" exists


# =============================================================================
# Test 3: Re-register Same Device (Should Update)
# =============================================================================
# Registering the same device again should return 201 (update existing)

POST {{BASE_URL}}/device/register?ApiKey={{API_KEY}}
Authorization: Bearer {{user_token}}
Content-Type: application/json
{
  "deviceId": "{{TEST_DEVICE_ID}}",
  "name": "{{TEST_DEVICE_NAME}} Updated",
  "systemName": "iOS",
  "systemVersion": "17.1",
  "token": "{{TEST_DEVICE_TOKEN}}-updated"
}

HTTP 201
[Asserts]
jsonpath "$.body.endpointArn" exists
jsonpath "$.requestId" exists


# =============================================================================
# Test 4: Anonymous Device Registration
# =============================================================================
# Device registration works without authentication (anonymous mode)

POST {{BASE_URL}}/device/register?ApiKey={{API_KEY}}
Content-Type: application/json
{
  "deviceId": "anonymous-device-uuid",
  "name": "Anonymous iPhone",
  "systemName": "iOS",
  "systemVersion": "17.0",
  "token": "anonymous-apns-token"
}

HTTP 200
[Asserts]
jsonpath "$.body.endpointArn" exists
jsonpath "$.requestId" exists


# =============================================================================
# Test 5: Device Event Logging
# =============================================================================
# Log a device event (no auth required, just API key)

POST {{BASE_URL}}/device/event?ApiKey={{API_KEY}}
Content-Type: application/json
x-device-uuid: {{TEST_DEVICE_ID}}
{
  "event": "app_launch",
  "timestamp": "2024-01-15T10:30:00Z",
  "metadata": {
    "app_version": "1.0.0",
    "os_version": "17.0"
  }
}

HTTP 204


# =============================================================================
# Test 6: Subscribe to Push Notifications
# =============================================================================
# Subscribe the device endpoint to the notification topic

POST {{BASE_URL}}/user/subscribe?ApiKey={{API_KEY}}
Authorization: Bearer {{user_token}}
Content-Type: application/json
{
  "endpointArn": "{{endpoint_arn}}",
  "topicArn": "arn:aws:sns:us-west-2:000000000000:push-notifications"
}

HTTP 201
[Asserts]
jsonpath "$.body.subscriptionArn" exists
jsonpath "$.requestId" exists


# =============================================================================
# Test 7: Invalid Device Registration (Missing Fields)
# =============================================================================

POST {{BASE_URL}}/device/register?ApiKey={{API_KEY}}
Authorization: Bearer {{user_token}}
Content-Type: application/json
{
  "deviceId": "incomplete-device"
}

HTTP 400
[Asserts]
jsonpath "$.error" exists


# =============================================================================
# Cleanup: Delete Test User
# =============================================================================

DELETE {{BASE_URL}}/user?ApiKey={{API_KEY}}
Authorization: Bearer {{user_token}}

HTTP 204
