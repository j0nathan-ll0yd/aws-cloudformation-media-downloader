#!/usr/bin/env bash
# Extract test fixtures from CloudWatch logs
# Usage: ./bin/extract-fixtures.sh [days-back] [output-dir]

set -euo pipefail

# Configuration
DAYS_BACK=${1:-7}
OUTPUT_DIR=${2:-test/fixtures/raw}
START_TIME=$(($(date +%s) - (DAYS_BACK * 86400)))000

# Lambda functions to extract fixtures from (only instrumented Lambdas)
LAMBDA_FUNCTIONS=(
  "WebhookFeedly"
  "ListFiles"
  "LoginUser"
  "RefreshToken"
  "RegisterDevice"
  "UserDelete"
  "UserSubscribe"
)

# Create output directory
mkdir -p "${OUTPUT_DIR}"

echo "Extracting fixtures from CloudWatch logs (last ${DAYS_BACK} days)..."
echo "Output directory: ${OUTPUT_DIR}"
echo ""

# Extract fixtures for each Lambda function
for LAMBDA_NAME in "${LAMBDA_FUNCTIONS[@]}"; do
  echo "Processing ${LAMBDA_NAME}..."

  LOG_GROUP="/aws/lambda/${LAMBDA_NAME}"
  OUTPUT_FILE="${OUTPUT_DIR}/${LAMBDA_NAME}-$(date +%Y%m%d).json"

  # Check if log group exists
  if ! aws logs describe-log-groups --log-group-name-prefix "${LOG_GROUP}" --query 'logGroups[0].logGroupName' --output text 2> /dev/null | grep -q "${LOG_GROUP}"; then
    echo "  ⚠️  Log group ${LOG_GROUP} not found, skipping..."
    continue
  fi

  # Extract fixture markers from CloudWatch
  aws logs filter-log-events \
    --log-group-name "${LOG_GROUP}" \
    --filter-pattern '__FIXTURE_MARKER__' \
    --start-time "${START_TIME}" \
    --query 'events[*].message' \
    --output json |
    jq -r '.[] | fromjson' \
      > "${OUTPUT_FILE}" 2> /dev/null || true

  # Count extracted fixtures
  FIXTURE_COUNT=$(jq -s 'length' "${OUTPUT_FILE}" 2> /dev/null || echo "0")

  if [ "${FIXTURE_COUNT}" -eq 0 ]; then
    echo "  ℹ️  No fixtures found"
    rm -f "${OUTPUT_FILE}"
  else
    echo "  ✅ Extracted ${FIXTURE_COUNT} fixtures → ${OUTPUT_FILE}"
  fi
done

echo ""
echo "Extraction complete. Next step: pnpm run process-fixtures"
