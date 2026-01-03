# Bash Script Patterns

## Quick Reference
- **When to use**: All bash scripts
- **Enforcement**: Required
- **Impact if violated**: MEDIUM - Inconsistent scripts

## Script Structure

```bash
#!/usr/bin/env bash
set -euo pipefail

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

# Directory resolution
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Main logic
main() {
  echo -e "${GREEN}✓${NC} Starting..."
  # Script logic here
}

# Run main
main "$@"
```

## Error Handling

```bash
set -euo pipefail  # Exit on error, undefined vars, pipe failures

# Error function
error() {
  echo -e "${RED}✗${NC} Error: $1" >&2
  exit "${2:-1}"
}

# Usage
command || error "Command failed" 2
```

## Variable Naming

```bash
# Regular variables - snake_case
local file_path="./data.json"
local user_count=0

# Environment/Constants - UPPER_SNAKE_CASE
export AWS_REGION="us-west-2"
readonly MAX_RETRIES=3

# Colors - UPPERCASE
RED='\033[0;31m'
GREEN='\033[0;32m'
```

## Function Patterns

```bash
# Function naming - snake_case
deploy_lambda() {
  local function_name="$1"
  local zip_file="$2"

  echo -e "${BLUE}➜${NC} Deploying ${function_name}..."

  aws lambda update-function-code \
    --function-name "$function_name" \
    --zip-file "fileb://${zip_file}" \
    || error "Lambda deployment failed"

  echo -e "${GREEN}✓${NC} Deployed successfully"
}
```

## Common Patterns

### Check Dependencies
```bash
command -v aws >/dev/null || error "AWS CLI not installed"
command -v npm >/dev/null || error "npm not installed"
```

### Parse Arguments
```bash
while [[ $# -gt 0 ]]; do
  case $1 in
    --env) ENV="$2"; shift 2 ;;
    --help) show_help; exit 0 ;;
    *) error "Unknown option: $1" ;;
  esac
done
```

## Best Practices

✅ Use `set -euo pipefail` always
✅ Define colors once at top
✅ Resolve directories properly
✅ Check dependencies first
✅ Use functions for reusable logic

---

## Project Scripts Reference

The project has 20+ scripts in `bin/` covering CI, testing, documentation, and maintenance:

### CI & Validation Scripts

| Script | Purpose | Key Features |
|--------|---------|--------------|
| `ci-local.sh` | Fast local CI runner | 15 steps, skips integration tests |
| `ci-local-full.sh` | Complete local CI | Includes LocalStack integration |
| `cleanup.sh` | Comprehensive cleanup | `--fast`, `--check` modes |
| `pre-deploy-check.sh` | Pre-deployment validation | Terraform, types, tests |
| `validate-docs.sh` | Documentation validation | Script existence checks |
| `validate-doc-sync.sh` | Doc-code sync | Convention compliance |
| `validate-graphrag.sh` | GraphRAG validation | Knowledge graph integrity |
| `verify-state.sh` | State verification | Check all systems |

### Test Scripts

| Script | Purpose | Key Features |
|--------|---------|--------------|
| `test-integration.sh` | Integration tests | LocalStack, DynamoDB, S3 |
| `test-hook.sh` | Webhook testing | Remote Feedly endpoint |
| `test-list.sh` | File listing test | Remote API testing |
| `test-registerDevice.sh` | Device registration | APNS token testing |

### Documentation Scripts

| Script | Purpose | Key Features |
|--------|---------|--------------|
| `document-api.sh` | API documentation | TypeSpec to OpenAPI |
| `document-source.sh` | Source documentation | TypeDoc generation |

### Maintenance Scripts

| Script | Purpose | Key Features |
|--------|---------|--------------|
| `update-youtube-cookies.sh` | Cookie refresh | Interactive, AWS Secrets |
| `update-yt-dlp.sh` | yt-dlp updates | Lambda layer management |
| `update-agents-prs.sh` | AI agent context | PR history for AGENTS.md |

---

## Real Examples from Project

### Progress Tracking Pattern (`cleanup.sh`)

```bash
# Step counter with colored output
TOTAL=30
STEP=0
ERRORS=0

log_step() { echo -e "\n${BLUE}[$1/$TOTAL]${NC} $2"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_error() {
  echo -e "${RED}✗${NC} $1"
  ERRORS=$((ERRORS + 1))
}

run_cmd() {
  local desc="$1"
  shift
  if "$@" > /dev/null 2>&1; then
    log_success "$desc"
    return 0
  else
    log_error "$desc"
    return 1
  fi
}

# Usage
log_step $((++STEP)) "Installing dependencies..."
run_cmd "Dependencies installed" pnpm install --frozen-lockfile
```

### Prerequisite Checking (`ci-local.sh`)

```bash
# Check Node.js version
REQUIRED_NODE_MAJOR=24
CURRENT_NODE_VERSION=$(node -v | sed 's/v//' | cut -d'.' -f1)
if [ "$CURRENT_NODE_VERSION" -lt "$REQUIRED_NODE_MAJOR" ]; then
  echo -e "${RED}Error: Node.js $REQUIRED_NODE_MAJOR+ required (found: $(node -v))${NC}"
  exit 1
fi
echo "  Node.js $(node -v)"

# Check required tools
if ! command -v hcl2json &> /dev/null; then
  echo -e "${RED}Error: hcl2json is not installed${NC}"
  echo "Install with: brew install hcl2json"
  exit 1
fi
```

### Mode Flags Pattern (`cleanup.sh`)

```bash
# Parse arguments
FAST_MODE=false
CHECK_ONLY=false
for arg in "$@"; do
  case $arg in
    --fast)
      FAST_MODE=true
      ;;
    --check)
      CHECK_ONLY=true
      ;;
  esac
done

# Conditional execution
if [ "$CHECK_ONLY" = true ]; then
  run_cmd "Code formatting valid" pnpm run --silent format:check
else
  run_cmd "Code formatted" pnpm run --silent format
fi
```

### Output Validation Pattern (`ci-local.sh`)

```bash
# Capture output for post-processing
TEST_OUTPUT=$(pnpm test 2>&1)
TEST_EXIT_CODE=$?
echo "$TEST_OUTPUT"

# Validate output is clean
TEST_ISSUES=0

if echo "$TEST_OUTPUT" | grep -q "DEPRECATED"; then
  echo -e "${RED}  Error: Found Vitest deprecation warnings${NC}"
  TEST_ISSUES=$((TEST_ISSUES + 1))
fi

if [ $TEST_ISSUES -gt 0 ]; then
  echo -e "${RED}  Test output validation failed${NC}"
  exit 1
fi
```

### LocalStack Wait Pattern (`cleanup.sh`)

```bash
# Wait for service to be ready
RETRIES=30
while [ $RETRIES -gt 0 ]; do
  if curl -s http://localhost:4566/_localstack/health | grep -q '"ready"' 2> /dev/null; then
    break
  fi
  RETRIES=$((RETRIES - 1))
  sleep 1
done

if [ $RETRIES -eq 0 ]; then
  log_error "LocalStack failed to become ready"
fi
```

### Summary Block Pattern

```bash
# Calculate duration
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

# Summary
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}Local CI Complete${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo "All checks passed in ${MINUTES}m ${SECONDS}s"
```

---

## Related Patterns

- [Error Handling](Bash-Error-Handling.md)
- [Directory Resolution](Directory-Resolution.md)
- [Variable Naming](Variable-Naming.md)

---

*Consistent bash scripts with proper error handling and clear output.*