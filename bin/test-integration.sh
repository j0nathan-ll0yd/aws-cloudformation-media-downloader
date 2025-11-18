#!/usr/bin/env bash

# test-integration.sh
# Runs integration tests against LocalStack
# Usage: npm run test:integration or ./bin/test-integration.sh

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.localstack.yml"
LOCALSTACK_HEALTH_URL="http://localhost:4566/_localstack/health"
MAX_HEALTH_RETRIES=30
HEALTH_RETRY_DELAY=1

# Color constants
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Flags
cleanup_after=false
start_localstack=true

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --cleanup)
      cleanup_after=true
      shift
      ;;
    --no-start)
      start_localstack=false
      shift
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Usage: $0 [--cleanup] [--no-start]"
      echo "  --cleanup: Stop LocalStack after tests complete"
      echo "  --no-start: Don't start LocalStack (assume it's already running)"
      exit 1
      ;;
  esac
done

echo -e "${GREEN}Integration Test Runner${NC}"
echo "======================="
echo ""

# Check required commands
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: docker is not installed${NC}"
    echo "Please install Docker Desktop: https://www.docker.com/products/docker-desktop"
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo -e "${RED}Error: docker compose is not available${NC}"
    echo "Please install Docker with Compose plugin or docker-compose standalone"
    exit 1
fi

echo "✅ Docker and docker compose are available"
echo ""

# Function to check LocalStack health
check_localstack_health() {
  local retry_count=0

  echo -e "${YELLOW}Waiting for LocalStack to be ready...${NC}"

  while [ $retry_count -lt $MAX_HEALTH_RETRIES ]; do
    if curl -sf "$LOCALSTACK_HEALTH_URL" > /dev/null 2>&1; then
      echo -e "${GREEN}✅ LocalStack is healthy${NC}"

      # Show service status
      health_status=$(curl -s "$LOCALSTACK_HEALTH_URL" | jq -r '.services | to_entries | map("\(.key): \(.value)") | join(", ")')
      echo -e "${BLUE}Services: $health_status${NC}"
      echo ""
      return 0
    fi

    retry_count=$((retry_count + 1))

    if [ $retry_count -lt $MAX_HEALTH_RETRIES ]; then
      echo -n "."
      sleep $HEALTH_RETRY_DELAY
    fi
  done

  echo ""
  echo -e "${RED}Error: LocalStack failed to become healthy after ${MAX_HEALTH_RETRIES} seconds${NC}"
  return 1
}

# Start LocalStack if requested
if [ "$start_localstack" = true ]; then
  echo -e "${YELLOW}Starting LocalStack...${NC}"

  # Check if LocalStack is already running
  if docker ps | grep -q "aws-media-downloader-localstack"; then
    echo "📦 LocalStack is already running"
    echo ""
  else
    echo "🚀 Starting LocalStack container..."
    docker compose -f "$COMPOSE_FILE" up -d
    echo ""
  fi

  # Wait for LocalStack to be healthy
  if ! check_localstack_health; then
    echo -e "${RED}LocalStack health check failed${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check LocalStack logs: npm run localstack:logs"
    echo "  2. Restart LocalStack: npm run localstack:stop && npm run localstack:start"
    echo "  3. Check Docker resources (memory, CPU)"
    exit 1
  fi
else
  echo -e "${YELLOW}Skipping LocalStack startup (--no-start flag)${NC}"
  echo ""

  # Verify LocalStack is running
  if ! docker ps | grep -q "aws-media-downloader-localstack"; then
    echo -e "${RED}Error: LocalStack is not running${NC}"
    echo "Start LocalStack with: npm run localstack:start"
    exit 1
  fi

  # Check health
  if ! check_localstack_health; then
    echo -e "${RED}LocalStack is running but not healthy${NC}"
    exit 1
  fi
fi

# Run integration tests
echo -e "${YELLOW}Running integration tests...${NC}"
echo ""

cd "$PROJECT_ROOT"

# Set environment variable for integration tests
export USE_LOCALSTACK=true

# Run Jest with integration config
if node --no-warnings --experimental-vm-modules ./node_modules/.bin/jest --config config/jest.integration.config.mjs; then
  test_exit_code=0
  echo ""
  echo -e "${GREEN}✅ All integration tests passed!${NC}"
else
  test_exit_code=$?
  echo ""
  echo -e "${RED}❌ Integration tests failed${NC}"
fi

echo ""

# Cleanup if requested
if [ "$cleanup_after" = true ]; then
  echo -e "${YELLOW}Stopping LocalStack...${NC}"
  docker compose -f "$COMPOSE_FILE" down
  echo -e "${GREEN}✅ LocalStack stopped${NC}"
  echo ""
else
  echo -e "${BLUE}ℹ️  LocalStack is still running${NC}"
  echo "To stop: npm run localstack:stop"
  echo "To view logs: npm run localstack:logs"
  echo ""
fi

# Summary
echo -e "${GREEN}Test Run Complete${NC}"
echo "=================="
echo ""
echo "📍 Test location: test/integration/"
echo "📊 Exit code: $test_exit_code"
echo ""

if [ $test_exit_code -eq 0 ]; then
  echo "Next steps:"
  echo "  • Review test coverage"
  echo "  • Add more integration tests as needed"
  echo "  • Run unit tests: npm test"
else
  echo "Troubleshooting:"
  echo "  • Check LocalStack logs: npm run localstack:logs"
  echo "  • Review test output above"
  echo "  • Verify LocalStack services are healthy: npm run localstack:health"
fi

echo ""

exit $test_exit_code
