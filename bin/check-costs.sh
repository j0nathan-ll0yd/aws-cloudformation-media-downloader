#!/usr/bin/env bash
#
# Check AWS monthly costs against budget threshold
#
# Usage:
#   ./bin/check-costs.sh                              # Check total costs (both environments)
#   ./bin/check-costs.sh --env staging                # Check staging environment only
#   ./bin/check-costs.sh --env production             # Check production environment only
#   ./bin/check-costs.sh --threshold 20               # Set custom threshold
#   ./bin/check-costs.sh --env staging --threshold 5  # Combine options
#
# Arguments:
#   --env <environment>    Optional. Filter by 'staging' or 'production'
#   --threshold <amount>   Optional. Budget threshold in USD (default: $10)
#
# Default threshold: $10/month (per environment or total)
#
# Requires AWS CLI with Cost Explorer permissions:
#   ce:GetCostAndUsage

set -euo pipefail

# Parse arguments
ENVIRONMENT=""
THRESHOLD="10"

while [[ $# -gt 0 ]]; do
  case $1 in
    --env)
      ENVIRONMENT="$2"
      shift 2
      ;;
    --threshold)
      THRESHOLD="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: ./bin/check-costs.sh [--env <staging|production>] [--threshold AMOUNT]"
      exit 1
      ;;
  esac
done

# Validate environment if provided
if [[ -n "$ENVIRONMENT" && "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
  echo "ERROR: Environment must be 'staging' or 'production', got: ${ENVIRONMENT}"
  exit 1
fi

# Calculate date range (last 30 days)
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  START_DATE=$(date -v-30d +%Y-%m-%d)
  END_DATE=$(date +%Y-%m-%d)
else
  # Linux
  START_DATE=$(date -d "30 days ago" +%Y-%m-%d)
  END_DATE=$(date +%Y-%m-%d)
fi

echo "AWS Cost Report"
echo "==============="
echo "Period: $START_DATE to $END_DATE"
if [[ -n "$ENVIRONMENT" ]]; then
  echo "Environment: $ENVIRONMENT"
fi
echo "Threshold: \$$THRESHOLD"
echo ""

# Function to get costs with optional environment filter
get_costs() {
  local filter_args=""

  if [[ -n "$ENVIRONMENT" ]]; then
    # Filter by Environment tag
    filter_args='--filter {"Tags":{"Key":"Environment","Values":["'"$ENVIRONMENT"'"]}}'
  fi

  if [[ -n "$filter_args" ]]; then
    aws ce get-cost-and-usage \
      --time-period "Start=$START_DATE,End=$END_DATE" \
      --granularity MONTHLY \
      --metrics "UnblendedCost" \
      --filter '{"Tags":{"Key":"Environment","Values":["'"$ENVIRONMENT"'"]}}' \
      --query 'ResultsByTime[0].Total.UnblendedCost.Amount' \
      --output text 2>/dev/null || echo "ERROR"
  else
    aws ce get-cost-and-usage \
      --time-period "Start=$START_DATE,End=$END_DATE" \
      --granularity MONTHLY \
      --metrics "UnblendedCost" \
      --query 'ResultsByTime[0].Total.UnblendedCost.Amount' \
      --output text 2>/dev/null || echo "ERROR"
  fi
}

# Get costs by environment breakdown (always show this)
echo "Cost by Environment:"
echo "--------------------"

# Get staging costs
STAGING_COST=$(aws ce get-cost-and-usage \
  --time-period "Start=$START_DATE,End=$END_DATE" \
  --granularity MONTHLY \
  --metrics "UnblendedCost" \
  --filter '{"Tags":{"Key":"Environment","Values":["staging"]}}' \
  --query 'ResultsByTime[0].Total.UnblendedCost.Amount' \
  --output text 2>/dev/null || echo "0")

# Get production costs
PRODUCTION_COST=$(aws ce get-cost-and-usage \
  --time-period "Start=$START_DATE,End=$END_DATE" \
  --granularity MONTHLY \
  --metrics "UnblendedCost" \
  --filter '{"Tags":{"Key":"Environment","Values":["production"]}}' \
  --query 'ResultsByTime[0].Total.UnblendedCost.Amount' \
  --output text 2>/dev/null || echo "0")

# Get total costs
TOTAL_COST=$(aws ce get-cost-and-usage \
  --time-period "Start=$START_DATE,End=$END_DATE" \
  --granularity MONTHLY \
  --metrics "UnblendedCost" \
  --query 'ResultsByTime[0].Total.UnblendedCost.Amount' \
  --output text 2>/dev/null || echo "ERROR")

# Handle errors
if [[ "$TOTAL_COST" == "ERROR" || "$TOTAL_COST" == "None" ]]; then
  echo "Warning: Could not retrieve cost data (may need Cost Explorer permissions)"
  exit 0
fi

# Format costs
STAGING_FORMATTED=$(printf "%.2f" "${STAGING_COST:-0}" 2>/dev/null || echo "0.00")
PRODUCTION_FORMATTED=$(printf "%.2f" "${PRODUCTION_COST:-0}" 2>/dev/null || echo "0.00")
TOTAL_FORMATTED=$(printf "%.2f" "$TOTAL_COST")

echo "  Staging:    \$$STAGING_FORMATTED"
echo "  Production: \$$PRODUCTION_FORMATTED"
echo "  Total:      \$$TOTAL_FORMATTED"
echo ""

# Determine which cost to check against threshold
if [[ -n "$ENVIRONMENT" ]]; then
  if [[ "$ENVIRONMENT" == "staging" ]]; then
    CHECK_COST="$STAGING_COST"
    CHECK_LABEL="Staging"
  else
    CHECK_COST="$PRODUCTION_COST"
    CHECK_LABEL="Production"
  fi
else
  CHECK_COST="$TOTAL_COST"
  CHECK_LABEL="Total"
fi

CHECK_FORMATTED=$(printf "%.2f" "${CHECK_COST:-0}" 2>/dev/null || echo "0.00")

# Compare cost to threshold
if (( $(echo "$CHECK_COST > $THRESHOLD" | bc -l) )); then
  echo "WARNING: $CHECK_LABEL cost (\$$CHECK_FORMATTED) exceeds \$$THRESHOLD budget!"
  echo ""
  echo "Breakdown by service:"

  if [[ -n "$ENVIRONMENT" ]]; then
    aws ce get-cost-and-usage \
      --time-period "Start=$START_DATE,End=$END_DATE" \
      --granularity MONTHLY \
      --metrics "UnblendedCost" \
      --filter '{"Tags":{"Key":"Environment","Values":["'"$ENVIRONMENT"'"]}}' \
      --group-by Type=DIMENSION,Key=SERVICE \
      --query 'ResultsByTime[0].Groups[?to_number(Metrics.UnblendedCost.Amount)>`0.01`].{Service:Keys[0],Cost:Metrics.UnblendedCost.Amount}' \
      --output table 2>/dev/null || echo "(Could not get breakdown)"
  else
    aws ce get-cost-and-usage \
      --time-period "Start=$START_DATE,End=$END_DATE" \
      --granularity MONTHLY \
      --metrics "UnblendedCost" \
      --group-by Type=DIMENSION,Key=SERVICE \
      --query 'ResultsByTime[0].Groups[?to_number(Metrics.UnblendedCost.Amount)>`0.01`].{Service:Keys[0],Cost:Metrics.UnblendedCost.Amount}' \
      --output table 2>/dev/null || echo "(Could not get breakdown)"
  fi
  exit 1
fi

echo "$CHECK_LABEL cost (\$$CHECK_FORMATTED) is within \$$THRESHOLD budget."
