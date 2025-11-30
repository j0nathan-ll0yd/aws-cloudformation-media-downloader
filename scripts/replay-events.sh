#!/usr/bin/env bash
# Event Replay Helper for MediaDownloaderEvents
#
# Usage:
#   ./scripts/replay-events.sh <event-type> <hours-ago>
#
# Examples:
#   ./scripts/replay-events.sh FileDownloadFailed 24    # Replay failed downloads from last 24h
#   ./scripts/replay-events.sh FileWebhookReceived 1    # Replay webhooks from last hour
#   ./scripts/replay-events.sh "" 6                     # Replay ALL events from last 6 hours
#
# Environment:
#   AWS_REGION - AWS region (default: us-west-2)
#   AWS_PROFILE - AWS profile to use (optional)

set -euo pipefail

# Configuration
EVENT_TYPE="${1:-}"
HOURS_AGO="${2:-24}"
REGION="${AWS_REGION:-us-west-2}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
if [[ -z "$ACCOUNT_ID" ]]; then
    echo -e "${RED}Error: Failed to get AWS account ID. Check AWS credentials.${NC}"
    exit 1
fi

# Calculate time range
# macOS uses -v flag, Linux uses -d flag for date arithmetic
if [[ "$(uname)" == "Darwin" ]]; then
    START_TIME=$(date -u -v-"${HOURS_AGO}"H +%Y-%m-%dT%H:%M:%SZ)
else
    START_TIME=$(date -u -d "${HOURS_AGO} hours ago" +%Y-%m-%dT%H:%M:%SZ)
fi
END_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Build replay name
if [[ -n "$EVENT_TYPE" ]]; then
    REPLAY_NAME="replay-${EVENT_TYPE}-$(date +%Y%m%d%H%M%S)"
else
    REPLAY_NAME="replay-all-$(date +%Y%m%d%H%M%S)"
fi

# Build event pattern
if [[ -n "$EVENT_TYPE" ]]; then
    EVENT_PATTERN="{\"detail-type\":[\"${EVENT_TYPE}\"]}"
else
    EVENT_PATTERN="{}"
fi

# Event bus ARN
BUS_ARN="arn:aws:events:${REGION}:${ACCOUNT_ID}:event-bus/MediaDownloaderEvents"

echo -e "${YELLOW}EventBridge Replay Configuration${NC}"
echo "=================================="
echo "  Replay Name: ${REPLAY_NAME}"
echo "  Event Type:  ${EVENT_TYPE:-ALL EVENTS}"
echo "  Time Range:  ${START_TIME} to ${END_TIME}"
echo "  Hours Ago:   ${HOURS_AGO}"
echo "  Region:      ${REGION}"
echo "  Account:     ${ACCOUNT_ID}"
echo ""

# Confirm before proceeding
read -p "Start replay? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Replay cancelled.${NC}"
    exit 0
fi

echo ""
echo -e "${GREEN}Starting replay...${NC}"

# Start the replay
aws events start-replay \
    --replay-name "${REPLAY_NAME}" \
    --event-source-arn "${BUS_ARN}" \
    --destination "${BUS_ARN}" \
    --event-start-time "${START_TIME}" \
    --event-end-time "${END_TIME}" \
    --event-pattern "${EVENT_PATTERN}" \
    --region "${REGION}"

echo ""
echo -e "${GREEN}Replay started successfully!${NC}"
echo ""
echo "Monitor replay status with:"
echo -e "  ${YELLOW}aws events describe-replay --replay-name ${REPLAY_NAME} --region ${REGION}${NC}"
echo ""
echo "Cancel replay with:"
echo -e "  ${YELLOW}aws events cancel-replay --replay-name ${REPLAY_NAME} --region ${REGION}${NC}"
