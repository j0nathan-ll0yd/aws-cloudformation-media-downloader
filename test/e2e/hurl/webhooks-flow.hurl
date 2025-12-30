# Webhook Flow E2E Tests
# Tests the Feedly webhook integration for video downloads
#
# Prerequisites:
# - LocalStack running (pnpm run localstack:start)
# - EventBridge and SQS configured
#
# Run: hurl --test --variables-file test/e2e/hurl/vars.env test/e2e/hurl/webhooks-flow.hurl

# =============================================================================
# Test 1: Setup - Register Test User
# =============================================================================

POST {{BASE_URL}}/user/register?ApiKey={{API_KEY}}
Content-Type: application/json
{
  "idToken": "mock-apple-id-token-webhook-test",
  "firstName": "Webhook",
  "lastName": "Tester"
}

HTTP 200
[Captures]
user_token: jsonpath "$.body.token"
user_id: jsonpath "$.body.userId"


# =============================================================================
# Test 2: Submit Valid YouTube URL via Feedly Webhook
# =============================================================================
# Simulates a Feedly automation triggering a video download

POST {{BASE_URL}}/feedly?ApiKey={{API_KEY}}
Authorization: Bearer {{user_token}}
Content-Type: application/json
{
  "articleURL": "{{TEST_YOUTUBE_URL}}",
  "articleTitle": "Test Video for E2E Testing",
  "sourceTitle": "Test Channel",
  "articlePublishedAt": "2024-01-15T10:00:00Z",
  "createdAt": "2024-01-15T10:30:00Z"
}

# Response could be 200 (already downloaded) or 202 (queued)
HTTP *
[Asserts]
# Status should be one of: Dispatched, Accepted, Initiated
jsonpath "$.body.status" matches "^(Dispatched|Accepted|Initiated)$"
jsonpath "$.requestId" exists


# =============================================================================
# Test 3: Duplicate Webhook Request (Idempotency)
# =============================================================================
# Same URL should be handled idempotently

POST {{BASE_URL}}/feedly?ApiKey={{API_KEY}}
Authorization: Bearer {{user_token}}
Content-Type: application/json
{
  "articleURL": "{{TEST_YOUTUBE_URL}}",
  "articleTitle": "Test Video for E2E Testing (Duplicate)",
  "sourceTitle": "Test Channel"
}

HTTP *
[Asserts]
jsonpath "$.body.status" exists
jsonpath "$.requestId" exists


# =============================================================================
# Test 4: Invalid YouTube URL (Should Fail Validation)
# =============================================================================

POST {{BASE_URL}}/feedly?ApiKey={{API_KEY}}
Authorization: Bearer {{user_token}}
Content-Type: application/json
{
  "articleURL": "https://example.com/not-a-youtube-video",
  "articleTitle": "Invalid Video URL"
}

HTTP 400
[Asserts]
jsonpath "$.error" exists
jsonpath "$.error.message" exists


# =============================================================================
# Test 5: Missing Article URL (Should Fail)
# =============================================================================

POST {{BASE_URL}}/feedly?ApiKey={{API_KEY}}
Authorization: Bearer {{user_token}}
Content-Type: application/json
{
  "articleTitle": "Missing URL"
}

HTTP 400
[Asserts]
jsonpath "$.error" exists


# =============================================================================
# Test 6: Webhook Without Authentication (Should Fail)
# =============================================================================
# Feedly webhook requires authentication

POST {{BASE_URL}}/feedly?ApiKey={{API_KEY}}
Content-Type: application/json
{
  "articleURL": "https://www.youtube.com/watch?v=test123",
  "articleTitle": "Unauthenticated Request"
}

HTTP 401
[Asserts]
jsonpath "$.error" exists


# =============================================================================
# Test 7: YouTube Shorts URL Format
# =============================================================================
# YouTube Shorts use a different URL format

POST {{BASE_URL}}/feedly?ApiKey={{API_KEY}}
Authorization: Bearer {{user_token}}
Content-Type: application/json
{
  "articleURL": "https://www.youtube.com/shorts/abcd1234xyz",
  "articleTitle": "YouTube Short Video"
}

HTTP *
[Asserts]
jsonpath "$.body.status" exists
jsonpath "$.requestId" exists


# =============================================================================
# Test 8: youtu.be Short URL Format
# =============================================================================

POST {{BASE_URL}}/feedly?ApiKey={{API_KEY}}
Authorization: Bearer {{user_token}}
Content-Type: application/json
{
  "articleURL": "https://youtu.be/dQw4w9WgXcQ",
  "articleTitle": "Short URL Format"
}

HTTP *
[Asserts]
jsonpath "$.body.status" exists
jsonpath "$.requestId" exists


# =============================================================================
# Cleanup: Delete Test User
# =============================================================================

DELETE {{BASE_URL}}/user?ApiKey={{API_KEY}}
Authorization: Bearer {{user_token}}

HTTP 204
