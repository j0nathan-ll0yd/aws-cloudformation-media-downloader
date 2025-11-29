#!/usr/bin/env bash

# test-all.sh
# Runs ALL tests (unit + integration) with merged coverage reporting
# Usage: pnpm run test:all or ./bin/test-all.sh

set -e # Exit on error

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

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --cleanup)
      cleanup_after=true
      shift
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Usage: $0 [--cleanup]"
      echo "  --cleanup: Stop LocalStack after tests complete"
      exit 1
      ;;
  esac
done

echo -e "${GREEN}Complete Test Suite Runner${NC}"
echo "============================"
echo ""
echo "This will run:"
echo "  1. Unit tests (with mocked AWS services)"
echo "  2. Integration tests (against LocalStack)"
echo "  3. Generate merged coverage report"
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

      # Show service status if jq is available
      if command -v jq &> /dev/null; then
        health_status=$(curl -s "$LOCALSTACK_HEALTH_URL" | jq -r '.services | to_entries | map("\(.key): \(.value)") | join(", ")')
        echo -e "${BLUE}Services: $health_status${NC}"
      fi
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

# Start LocalStack
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
  echo "  1. Check LocalStack logs: pnpm run localstack:logs"
  echo "  2. Restart LocalStack: pnpm run localstack:stop && pnpm run localstack:start"
  echo "  3. Check Docker resources (memory, CPU)"
  exit 1
fi

# Run complete test suite with merged coverage
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}Running Complete Test Suite${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""

cd "$PROJECT_ROOT"

# Set environment variable for integration tests
export USE_LOCALSTACK=true

# Run ALL tests (unit + integration) with merged coverage
# This uses jest.all.config.mjs which runs both test suites as projects
echo -e "${BLUE}📋 Running unit tests...${NC}"
echo -e "${BLUE}📋 Running integration tests...${NC}"
echo -e "${BLUE}📊 Collecting coverage...${NC}"
echo ""

if node --no-warnings --experimental-vm-modules ./node_modules/.bin/jest --silent --config config/jest.all.config.mjs; then
  test_exit_code=0
  echo ""
  echo -e "${GREEN}✅ All tests passed!${NC}"
else
  test_exit_code=$?
  echo ""
  echo -e "${RED}❌ Some tests failed${NC}"
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
  echo "To stop: pnpm run localstack:stop"
  echo "To view logs: pnpm run localstack:logs"
  echo ""
fi

# Summary
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}Test Run Complete${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo "📍 Coverage report: coverage/index.html"
echo "📊 Coverage includes:"
echo "   • Application logic (from unit tests)"
echo "   • Vendor wrappers (from integration tests)"
echo "   • Complete merged coverage metrics"
echo ""
echo "📋 Exit code: $test_exit_code"
echo ""

if [ $test_exit_code -eq 0 ]; then
  echo "Next steps:"
  echo "  • Open coverage report: open coverage/index.html"
  echo "  • Review merged coverage metrics"
  echo "  • Celebrate comprehensive test coverage! 🎉"
else
  echo "Troubleshooting:"
  echo "  • Check test output above for failures"
  echo "  • Check LocalStack logs: pnpm run localstack:logs"
  echo "  • Verify LocalStack services: pnpm run localstack:health"
  echo "  • Run tests individually:"
  echo "    - Unit tests only: pnpm test"
  echo "    - Integration tests only: pnpm run test:integration:with-lifecycle"
fi

echo ""

exit $test_exit_code
