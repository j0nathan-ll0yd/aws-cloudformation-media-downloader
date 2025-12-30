# Authentication Flow E2E Tests
# Tests the complete auth lifecycle: register -> login -> refresh -> delete
#
# Prerequisites:
# - LocalStack running (pnpm run localstack:start)
# - Environment variables set in vars.env or vars.local.env
#
# Run: hurl --test --variables-file test/e2e/hurl/vars.env test/e2e/hurl/auth-flow.hurl

# =============================================================================
# Test 1: User Registration (with mock Apple ID token)
# =============================================================================
# Note: In real testing, you need a valid Apple ID token.
# For LocalStack testing, we use a mock token that the test setup accepts.

POST {{BASE_URL}}/user/register?ApiKey={{API_KEY}}
Content-Type: application/json
{
  "idToken": "mock-apple-id-token-for-testing",
  "firstName": "Test",
  "lastName": "User"
}

HTTP 200
[Captures]
register_token: jsonpath "$.body.token"
register_user_id: jsonpath "$.body.userId"
register_session_id: jsonpath "$.body.sessionId"
register_expires_at: jsonpath "$.body.expiresAt"

[Asserts]
jsonpath "$.body.token" exists
jsonpath "$.body.userId" exists
jsonpath "$.body.sessionId" exists
jsonpath "$.body.expiresAt" isInteger
jsonpath "$.requestId" exists


# =============================================================================
# Test 2: User Login (existing user)
# =============================================================================
# After registration, login should work with the same token

POST {{BASE_URL}}/user/login?ApiKey={{API_KEY}}
Content-Type: application/json
{
  "idToken": "mock-apple-id-token-for-testing"
}

HTTP 200
[Captures]
login_token: jsonpath "$.body.token"
login_user_id: jsonpath "$.body.userId"

[Asserts]
jsonpath "$.body.token" exists
jsonpath "$.body.userId" == {{register_user_id}}
jsonpath "$.body.expiresAt" isInteger
jsonpath "$.requestId" exists


# =============================================================================
# Test 3: Token Refresh
# =============================================================================
# Extend the session expiration using the Bearer token

POST {{BASE_URL}}/user/refresh?ApiKey={{API_KEY}}
Authorization: Bearer {{login_token}}

HTTP 200
[Captures]
refresh_token: jsonpath "$.body.token"
refresh_expires_at: jsonpath "$.body.expiresAt"

[Asserts]
jsonpath "$.body.token" exists
jsonpath "$.body.expiresAt" isInteger
# New expiration should be greater than or equal to original
jsonpath "$.body.expiresAt" >= {{register_expires_at}}
jsonpath "$.requestId" exists


# =============================================================================
# Test 4: Invalid Token Refresh (should fail)
# =============================================================================

POST {{BASE_URL}}/user/refresh?ApiKey={{API_KEY}}
Authorization: Bearer invalid-token-that-does-not-exist

HTTP 401
[Asserts]
jsonpath "$.error.code" exists
jsonpath "$.error.message" exists


# =============================================================================
# Test 5: Missing Authorization Header (should fail)
# =============================================================================

POST {{BASE_URL}}/user/refresh?ApiKey={{API_KEY}}

HTTP 401
[Asserts]
jsonpath "$.error" exists


# =============================================================================
# Test 6: User Deletion (cleanup)
# =============================================================================
# Delete the test user - this cascades to all related data

DELETE {{BASE_URL}}/user?ApiKey={{API_KEY}}
Authorization: Bearer {{refresh_token}}

HTTP 204


# =============================================================================
# Test 7: Verify Deletion (login should fail after delete)
# =============================================================================
# Attempting to login after deletion should create a new user (different userId)
# or fail depending on implementation

POST {{BASE_URL}}/user/login?ApiKey={{API_KEY}}
Content-Type: application/json
{
  "idToken": "mock-apple-id-token-for-testing"
}

# After deletion, a new registration happens, so we get a new user
HTTP 200
[Asserts]
jsonpath "$.body.token" exists
# The user ID should be different (new user created)
jsonpath "$.body.userId" != {{register_user_id}}
