#!/usr/bin/env bash

# extract-fixtures.sh
# Extracts fixture markers from CloudWatch Logs for Lambda functions
# Usage: ./bin/extract-fixtures.sh [lambda-name] [days-back]
# Example: ./bin/extract-fixtures.sh WebhookFeedly 7

set -e

# Constants
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
OUTPUT_DIR="${PROJECT_ROOT}/fixtures/extracted"

# Color constants
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default parameters
lambda_name="${1:-}"
days_back="${2:-7}"

# Function to display usage
usage() {
  echo "Usage: $0 [lambda-name] [days-back]"
  echo ""
  echo "Arguments:"
  echo "  lambda-name    Lambda function name (e.g., WebhookFeedly, ListFiles)"
  echo "                 If not provided, extracts from all Lambda functions"
  echo "  days-back      Number of days to look back in CloudWatch (default: 7)"
  echo ""
  echo "Examples:"
  echo "  $0 WebhookFeedly 7    # Extract WebhookFeedly fixtures from last 7 days"
  echo "  $0 ListFiles 14       # Extract ListFiles fixtures from last 14 days"
  echo "  $0                    # Extract fixtures from all Lambda functions"
  exit 1
}

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
  echo -e "${RED}Error: AWS CLI not found. Please install it first.${NC}"
  exit 1
fi

# Check if jq is installed
if ! command -v jq &> /dev/null; then
  echo -e "${RED}Error: jq not found. Please install it first.${NC}"
  exit 1
fi

# Create output directory
mkdir -p "${OUTPUT_DIR}"

# Calculate start time (in milliseconds since epoch)
start_time=$(($(date +%s) - (days_back * 86400)))
start_time_ms=$((start_time * 1000))

echo -e "${GREEN}Extracting fixtures from CloudWatch Logs${NC}"
echo "Lambda: ${lambda_name:-all}"
echo "Looking back: ${days_back} days"
echo "Output directory: ${OUTPUT_DIR}"
echo ""

# Function to extract fixtures for a specific Lambda
extract_lambda_fixtures() {
  local func_name="$1"
  local log_group="/aws/lambda/${func_name}"
  
  echo -e "${YELLOW}Processing ${func_name}...${NC}"
  
  # Check if log group exists
  if ! aws logs describe-log-groups --log-group-name-prefix "${log_group}" --query 'logGroups[0].logGroupName' --output text 2>/dev/null | grep -q "${log_group}"; then
    echo -e "${RED}  Warning: Log group ${log_group} not found. Skipping.${NC}"
    return
  fi
  
  # Query for FIXTURE markers
  local query_id
  query_id=$(aws logs start-query \
    --log-group-name "${log_group}" \
    --start-time "${start_time_ms}" \
    --end-time "$(date +%s)000" \
    --query-string 'fields @timestamp, @message | filter @message like /FIXTURE:(INCOMING|OUTGOING|INTERNAL)/ | sort @timestamp desc' \
    --query 'queryId' \
    --output text)
  
  if [[ -z "${query_id}" ]]; then
    echo -e "${RED}  Error: Failed to start query for ${func_name}${NC}"
    return
  fi
  
  # Wait for query to complete
  echo "  Query ID: ${query_id}"
  echo -n "  Waiting for query to complete"
  
  local status="Running"
  while [[ "${status}" == "Running" || "${status}" == "Scheduled" ]]; do
    sleep 2
    echo -n "."
    status=$(aws logs get-query-results --query-id "${query_id}" --query 'status' --output text)
  done
  echo ""
  
  if [[ "${status}" != "Complete" ]]; then
    echo -e "${RED}  Error: Query failed with status: ${status}${NC}"
    return
  fi
  
  # Get query results
  local results_file="${OUTPUT_DIR}/${func_name}_raw.json"
  aws logs get-query-results --query-id "${query_id}" > "${results_file}"
  
  # Count results
  local count
  count=$(jq '.results | length' "${results_file}")
  
  if [[ "${count}" -eq 0 ]]; then
    echo -e "${YELLOW}  No fixture markers found for ${func_name}${NC}"
    rm "${results_file}"
    return
  fi
  
  echo -e "${GREEN}  Found ${count} fixture markers${NC}"
  echo "  Raw results saved to: ${results_file}"
  echo "  Run process-fixture-markers.js to parse and save fixtures"
}

# Main execution
if [[ "$1" == "-h" || "$1" == "--help" ]]; then
  usage
fi

if [[ -n "${lambda_name}" ]]; then
  # Extract specific Lambda
  extract_lambda_fixtures "${lambda_name}"
else
  # Extract all Lambda functions
  echo -e "${YELLOW}Extracting fixtures from all Lambda functions...${NC}"
  echo ""
  
  # Get list of Lambda functions from terraform output or AWS CLI
  if [[ -f "${PROJECT_ROOT}/terraform" ]]; then
    cd "${PROJECT_ROOT}/terraform"
    lambda_functions=$(tofu output -json lambda_function_names 2>/dev/null | jq -r '.[]' || echo "")
  fi
  
  # Fallback to AWS CLI if terraform output fails
  if [[ -z "${lambda_functions}" ]]; then
    lambda_functions=$(aws lambda list-functions --query 'Functions[].FunctionName' --output text | tr '\t' '\n')
  fi
  
  for func in ${lambda_functions}; do
    extract_lambda_fixtures "${func}"
    echo ""
  done
fi

echo -e "${GREEN}Extraction complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Review raw fixture data in ${OUTPUT_DIR}/"
echo "  2. Run: node bin/process-fixture-markers.js"
echo "  3. Extracted fixtures will be saved to Lambda test/fixtures/ directories"
