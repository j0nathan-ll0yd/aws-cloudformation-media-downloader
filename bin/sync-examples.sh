#!/bin/bash

# Sync Examples Script
# This script syncs test fixtures to TypeSpec examples directory
# ensuring documentation stays in sync with actual test data

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
EXAMPLES_DIR="$PROJECT_DIR/tsp/examples"

echo "🔄 Syncing test fixtures to TypeSpec examples..."
echo ""

# Create examples directory if it doesn't exist
mkdir -p "$EXAMPLES_DIR"

# Extract RegisterDevice request body from API Gateway event
echo "📝 Syncing RegisterDevice request..."
jq -r '.body' "$PROJECT_DIR/src/lambdas/RegisterDevice/test/fixtures/APIGatewayEvent.json" | jq . > "$EXAMPLES_DIR/register-device-request.json"

# Create ListFiles response from fixture data
echo "📝 Syncing ListFiles response..."
# The fixture is DynamoDB response, transform to API response format
cat > "$EXAMPLES_DIR/list-files-response.json" << 'EOF'
{
  "contents": [
    {
      "fileId": "PaZ1EmPOE_k",
      "key": "20150826-[The School of Life].mp4",
      "title": "On Feeling Melancholy",
      "status": "Downloaded",
      "size": 12023572,
      "contentType": "video/mp4",
      "authorName": "The School of Life"
    }
  ],
  "keyCount": 1
}
EOF

# Copy Feedly webhook fixture
echo "📝 Syncing Feedly webhook request..."
cp "$PROJECT_DIR/src/lambdas/WebhookFeedly/test/fixtures/handleFeedlyEvent-200-OK.json" "$EXAMPLES_DIR/feedly-webhook-request.json"

# Create additional example responses
echo "📝 Creating example responses..."

cat > "$EXAMPLES_DIR/register-device-response.json" << 'EOF'
{
  "endpointArn": "arn:aws:sns:us-west-2:123456789012:endpoint/APNS/MyApp/abcd1234-5678-90ab-cdef-1234567890ab"
}
EOF

cat > "$EXAMPLES_DIR/feedly-webhook-response.json" << 'EOF'
{
  "status": "Dispatched"
}
EOF

cat > "$EXAMPLES_DIR/user-login-request.json" << 'EOF'
{
  "authorizationCode": "c1234567890abcdef.0.a.b1234567890abcdef"
}
EOF

cat > "$EXAMPLES_DIR/user-register-request.json" << 'EOF'
{
  "authorizationCode": "c1234567890abcdef.0.a.b1234567890abcdef",
  "firstName": "John",
  "lastName": "Doe"
}
EOF

cat > "$EXAMPLES_DIR/auth-response.json" << 'EOF'
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
EOF

echo ""
echo "✅ Examples synced successfully!"
echo ""
echo "📍 Examples location: $EXAMPLES_DIR"
echo "📊 Files synced:"
ls -lh "$EXAMPLES_DIR" | tail -n +2 | awk '{print "   -", $9, "("$5")"}'
echo ""
echo "💡 To regenerate TypeSpec documentation with updated examples:"
echo "   npm run document-api"
