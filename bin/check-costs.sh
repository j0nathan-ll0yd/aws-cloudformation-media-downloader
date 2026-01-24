#!/usr/bin/env bash
#
# Check AWS monthly costs against budget threshold
# Usage: ./bin/check-costs.sh [--threshold AMOUNT]
#
# Default threshold: $10/month (both environments combined)
#
# Requires AWS CLI with Cost Explorer permissions:
#   ce:GetCostAndUsage

set -euo pipefail

THRESHOLD="${1:-10}"

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

echo "Checking AWS costs from $START_DATE to $END_DATE..."

# Get cost from AWS Cost Explorer
COST=$(aws ce get-cost-and-usage \
  --time-period "Start=$START_DATE,End=$END_DATE" \
  --granularity MONTHLY \
  --metrics "UnblendedCost" \
  --query 'ResultsByTime[0].Total.UnblendedCost.Amount' \
  --output text 2>/dev/null || echo "ERROR")

if [[ "$COST" == "ERROR" || "$COST" == "None" ]]; then
  echo "Warning: Could not retrieve cost data (may need Cost Explorer permissions)"
  exit 0
fi

# Format cost to 2 decimal places
COST_FORMATTED=$(printf "%.2f" "$COST")

echo "Monthly cost: \$$COST_FORMATTED"
echo "Budget threshold: \$$THRESHOLD"

# Compare cost to threshold
if (( $(echo "$COST > $THRESHOLD" | bc -l) )); then
  echo ""
  echo "WARNING: Monthly cost (\$$COST_FORMATTED) exceeds \$$THRESHOLD budget!"
  echo ""
  echo "Breakdown by service:"
  aws ce get-cost-and-usage \
    --time-period "Start=$START_DATE,End=$END_DATE" \
    --granularity MONTHLY \
    --metrics "UnblendedCost" \
    --group-by Type=DIMENSION,Key=SERVICE \
    --query 'ResultsByTime[0].Groups[?Amount>`0.01`].{Service:Keys[0],Cost:Metrics.UnblendedCost.Amount}' \
    --output table 2>/dev/null || echo "(Could not get breakdown)"
  exit 1
fi

echo "Cost is within budget."
