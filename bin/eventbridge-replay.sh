#!/bin/bash
# EventBridge Event Replay Helper Script
# Provides convenient commands for replaying archived events

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
EVENT_BUS_NAME="${EVENT_BUS_NAME:-MediaDownloaderEvents}"
ARCHIVE_NAME="${ARCHIVE_NAME:-MediaDownloaderArchive}"
AWS_REGION="${AWS_REGION:-us-west-2}"

function print_usage() {
    cat << EOF
Usage: $0 <command> [options]

Commands:
    list-archives           List all event archives
    replay                  Start an event replay
    check-replay <name>     Check replay status
    stop-replay <name>      Stop a running replay
    list-replays            List all replays (active and completed)

Replay Options:
    --start <datetime>      Start time (ISO 8601 format: 2025-11-23T10:00:00Z)
    --end <datetime>        End time (ISO 8601 format: 2025-11-23T11:00:00Z)
    --destination <bus>     Destination event bus (default: $EVENT_BUS_NAME)
    --name <replay-name>    Replay name (default: auto-generated)

Examples:
    # Replay last hour of events
    $0 replay --start "\$(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ)" --end "\$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    
    # Replay specific time period
    $0 replay --start 2025-11-23T10:00:00Z --end 2025-11-23T11:00:00Z
    
    # Replay to different event bus (e.g., dev)
    $0 replay --start 2025-11-23T10:00:00Z --end 2025-11-23T11:00:00Z --destination MediaDownloaderEvents-Dev
    
    # Check replay status
    $0 check-replay MyReplay
    
    # Stop replay
    $0 stop-replay MyReplay

Environment Variables:
    EVENT_BUS_NAME          Event bus name (default: MediaDownloaderEvents)
    ARCHIVE_NAME            Archive name (default: MediaDownloaderArchive)
    AWS_REGION              AWS region (default: us-west-2)
    AWS_PROFILE             AWS profile to use

EOF
}

function error() {
    echo -e "${RED}Error: $1${NC}" >&2
    exit 1
}

function success() {
    echo -e "${GREEN}$1${NC}"
}

function warning() {
    echo -e "${YELLOW}$1${NC}"
}

function get_account_id() {
    aws sts get-caller-identity --query Account --output text
}

function get_archive_arn() {
    local account_id=$(get_account_id)
    echo "arn:aws:events:${AWS_REGION}:${account_id}:archive/${ARCHIVE_NAME}"
}

function get_event_bus_arn() {
    local account_id=$(get_account_id)
    echo "arn:aws:events:${AWS_REGION}:${account_id}:event-bus/${EVENT_BUS_NAME}"
}

function list_archives() {
    echo "Listing event archives in region ${AWS_REGION}..."
    aws events list-archives \
        --region "$AWS_REGION" \
        --query 'Archives[*].[ArchiveName, State, CreationTime, RetentionDays]' \
        --output table
}

function list_replays() {
    echo "Listing event replays in region ${AWS_REGION}..."
    aws events list-replays \
        --region "$AWS_REGION" \
        --query 'Replays[*].[ReplayName, State, EventSourceArn, ReplayStartTime, ReplayEndTime]' \
        --output table
}

function start_replay() {
    local start_time=""
    local end_time=""
    local destination="$EVENT_BUS_NAME"
    local replay_name=""
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --start)
                start_time="$2"
                shift 2
                ;;
            --end)
                end_time="$2"
                shift 2
                ;;
            --destination)
                destination="$2"
                shift 2
                ;;
            --name)
                replay_name="$2"
                shift 2
                ;;
            *)
                error "Unknown option: $1"
                ;;
        esac
    done
    
    # Validate required parameters
    if [[ -z "$start_time" ]]; then
        error "Missing required parameter: --start"
    fi
    
    if [[ -z "$end_time" ]]; then
        error "Missing required parameter: --end"
    fi
    
    # Generate replay name if not provided
    if [[ -z "$replay_name" ]]; then
        replay_name="Replay-$(date +%Y%m%d-%H%M%S)"
    fi
    
    # Get ARNs
    local archive_arn=$(get_archive_arn)
    local destination_arn="arn:aws:events:${AWS_REGION}:$(get_account_id):event-bus/${destination}"
    
    echo "Starting event replay..."
    echo "  Replay Name: $replay_name"
    echo "  Archive: $ARCHIVE_NAME"
    echo "  Start Time: $start_time"
    echo "  End Time: $end_time"
    echo "  Destination: $destination"
    echo ""
    
    # Start replay
    local result=$(aws events start-replay \
        --region "$AWS_REGION" \
        --replay-name "$replay_name" \
        --event-source-arn "$archive_arn" \
        --event-start-time "$start_time" \
        --event-end-time "$end_time" \
        --destination "EventBusArn=${destination_arn}" \
        --output json)
    
    local replay_arn=$(echo "$result" | jq -r '.ReplayArn')
    local state=$(echo "$result" | jq -r '.State')
    local state_reason=$(echo "$result" | jq -r '.StateReason')
    
    success "Replay started successfully!"
    echo "  Replay ARN: $replay_arn"
    echo "  State: $state"
    
    if [[ "$state_reason" != "null" ]]; then
        echo "  Reason: $state_reason"
    fi
    
    echo ""
    echo "To check replay status, run:"
    echo "  $0 check-replay $replay_name"
}

function check_replay() {
    local replay_name="$1"
    
    if [[ -z "$replay_name" ]]; then
        error "Missing replay name. Usage: $0 check-replay <name>"
    fi
    
    echo "Checking replay status: $replay_name"
    echo ""
    
    local result=$(aws events describe-replay \
        --region "$AWS_REGION" \
        --replay-name "$replay_name" \
        --output json)
    
    local state=$(echo "$result" | jq -r '.State')
    local start_time=$(echo "$result" | jq -r '.EventStartTime')
    local end_time=$(echo "$result" | jq -r '.EventEndTime')
    local started_time=$(echo "$result" | jq -r '.ReplayStartTime')
    local ended_time=$(echo "$result" | jq -r '.ReplayEndTime')
    local state_reason=$(echo "$result" | jq -r '.StateReason')
    
    echo "Replay Details:"
    echo "  Name: $replay_name"
    echo "  State: $state"
    echo "  Event Start: $start_time"
    echo "  Event End: $end_time"
    
    if [[ "$started_time" != "null" ]]; then
        echo "  Replay Started: $started_time"
    fi
    
    if [[ "$ended_time" != "null" ]]; then
        echo "  Replay Ended: $ended_time"
    fi
    
    if [[ "$state_reason" != "null" ]]; then
        echo "  Reason: $state_reason"
    fi
    
    # Show color-coded status
    case "$state" in
        STARTING|RUNNING)
            warning "\nReplay is in progress..."
            ;;
        COMPLETED)
            success "\nReplay completed successfully!"
            ;;
        FAILED)
            error "\nReplay failed!"
            ;;
        CANCELLED)
            warning "\nReplay was cancelled."
            ;;
    esac
}

function stop_replay() {
    local replay_name="$1"
    
    if [[ -z "$replay_name" ]]; then
        error "Missing replay name. Usage: $0 stop-replay <name>"
    fi
    
    echo "Stopping replay: $replay_name"
    
    aws events cancel-replay \
        --region "$AWS_REGION" \
        --replay-name "$replay_name" \
        --output text
    
    success "Replay stopped successfully!"
}

# Main command routing
case "${1:-}" in
    list-archives)
        list_archives
        ;;
    list-replays)
        list_replays
        ;;
    replay)
        shift
        start_replay "$@"
        ;;
    check-replay)
        check_replay "$2"
        ;;
    stop-replay)
        stop_replay "$2"
        ;;
    -h|--help|help|"")
        print_usage
        ;;
    *)
        error "Unknown command: $1\n$(print_usage)"
        ;;
esac
