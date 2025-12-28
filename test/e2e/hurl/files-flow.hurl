# Files Flow E2E Tests
# Tests file listing for both authenticated and anonymous users
#
# Prerequisites:
# - LocalStack running (pnpm run localstack:start)
# - Environment variables set in vars.env
#
# Run: hurl --test --variables-file test/e2e/hurl/vars.env test/e2e/hurl/files-flow.hurl

# =============================================================================
# Test 1: Anonymous File Listing (Demo Mode)
# =============================================================================
# Without authentication, users see a demo file

GET {{BASE_URL}}/files?ApiKey={{API_KEY}}

HTTP 200
[Asserts]
jsonpath "$.body.contents" isCollection
jsonpath "$.body.keyCount" isInteger
jsonpath "$.requestId" exists


# =============================================================================
# Test 2: Setup - Register Test User
# =============================================================================

POST {{BASE_URL}}/user/register?ApiKey={{API_KEY}}
Content-Type: application/json
{
  "idToken": "mock-apple-id-token-files-test",
  "firstName": "Files",
  "lastName": "Tester"
}

HTTP 200
[Captures]
user_token: jsonpath "$.body.token"
user_id: jsonpath "$.body.userId"


# =============================================================================
# Test 3: Authenticated File Listing (Empty for New User)
# =============================================================================
# A newly registered user should have no files

GET {{BASE_URL}}/files?ApiKey={{API_KEY}}
Authorization: Bearer {{user_token}}

HTTP 200
[Asserts]
jsonpath "$.body.contents" isCollection
jsonpath "$.body.keyCount" == 0
jsonpath "$.requestId" exists


# =============================================================================
# Test 4: File Listing with Invalid Token
# =============================================================================
# Should return 401 Unauthorized

GET {{BASE_URL}}/files?ApiKey={{API_KEY}}
Authorization: Bearer invalid-bearer-token

HTTP 401
[Asserts]
jsonpath "$.error" exists


# =============================================================================
# Test 5: File Listing without API Key
# =============================================================================
# Should return 403 Forbidden (API key required)

GET {{BASE_URL}}/files
Authorization: Bearer {{user_token}}

HTTP 403


# =============================================================================
# Cleanup: Delete Test User
# =============================================================================

DELETE {{BASE_URL}}/user?ApiKey={{API_KEY}}
Authorization: Bearer {{user_token}}

HTTP 204
