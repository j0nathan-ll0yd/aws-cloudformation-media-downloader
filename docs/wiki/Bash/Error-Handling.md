# Error Handling

## Quick Reference
- **When to use**: All Bash scripts
- **Enforcement**: Required - prevents silent failures
- **Impact if violated**: CRITICAL - Scripts continue after errors, data corruption possible

## Overview

Use `set -e` to exit immediately on command failures, explicitly handle commands that may legitimately fail, and provide clear error messages with context.

## The Rules

### 1. Always Use set -e

Exit immediately if any command fails.

### 2. Handle Expected Failures Explicitly

Use `|| true` or conditional logic for commands that may fail.

### 3. Provide Context in Error Messages

Include what failed, why, and how to fix it.

### 4. Clean Up on Exit

Use `trap` to ensure cleanup happens even on failure.

## Examples

### ✅ Correct - Basic Error Handling

```bash
#!/usr/bin/env bash

# Exit on error
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "Building application..."
npm run build  # Fails if build breaks - script stops

echo "Running tests..."
npm test  # Fails if tests break - script stops

echo -e "${GREEN}✓ All steps completed successfully${NC}"
```

### ✅ Correct - Explicit Failure Handling

```bash
#!/usr/bin/env bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Command that might legitimately fail
if ! aws lambda get-function --function-name ProcessFile &>/dev/null; then
    echo -e "${YELLOW}⚠ Function doesn't exist yet, creating...${NC}"
    aws lambda create-function \
        --function-name ProcessFile \
        --runtime nodejs22.x \
        --handler index.handler
fi

echo -e "${GREEN}✓ Function ready${NC}"
```

### ✅ Correct - Error Messages with Context

```bash
#!/usr/bin/env bash

set -e

RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

TABLE_NAME="MediaDownloader"

# Check if table exists
if ! aws dynamodb describe-table --table-name "${TABLE_NAME}" &>/dev/null; then
    echo -e "${RED}✗ DynamoDB table not found: ${TABLE_NAME}${NC}" >&2
    echo -e "${YELLOW}  Run: tofu apply${NC}" >&2
    echo -e "${YELLOW}  Or check AWS_REGION and AWS_PROFILE${NC}" >&2
    exit 1
fi

# Check if file exists
CONFIG_FILE="${PROJECT_ROOT}/config.json"
if [[ ! -f "${CONFIG_FILE}" ]]; then
    echo -e "${RED}✗ Configuration file not found${NC}" >&2
    echo -e "${YELLOW}  Expected: ${CONFIG_FILE}${NC}" >&2
    echo -e "${YELLOW}  Create the file or check PROJECT_ROOT${NC}" >&2
    exit 1
fi

# Validate environment variable
if [[ -z "${AWS_PROFILE}" ]]; then
    echo -e "${RED}✗ AWS_PROFILE environment variable not set${NC}" >&2
    echo -e "${YELLOW}  Run: export AWS_PROFILE=your-profile${NC}" >&2
    exit 1
fi
```

### ✅ Correct - Cleanup on Exit

```bash
#!/usr/bin/env bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

# Create temporary resources
TEMP_FILE=$(mktemp)
TEMP_DIR=$(mktemp -d)
CONTAINER_ID=""

# Cleanup function
cleanup() {
    local exit_code=$?
    
    if [[ ${exit_code} -ne 0 ]]; then
        echo -e "${RED}✗ Script failed, cleaning up...${NC}" >&2
    else
        echo "Cleaning up..."
    fi
    
    # Remove temporary files
    rm -f "${TEMP_FILE}"
    rm -rf "${TEMP_DIR}"
    
    # Stop container if started
    if [[ -n "${CONTAINER_ID}" ]]; then
        docker stop "${CONTAINER_ID}" &>/dev/null || true
    fi
    
    if [[ ${exit_code} -ne 0 ]]; then
        echo -e "${RED}✗ Cleanup complete${NC}" >&2
    fi
}

# Register cleanup on exit (success or failure)
trap cleanup EXIT

# Script logic
echo "Starting process..."
CONTAINER_ID=$(docker run -d nginx)
echo "Processing data..." > "${TEMP_FILE}"

# If any command fails, cleanup runs automatically
aws s3 cp "${TEMP_FILE}" s3://bucket/

echo -e "${GREEN}✓ Process complete${NC}"
```

### ✅ Correct - Retry Logic

```bash
#!/usr/bin/env bash

set -e

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

MAX_RETRIES=3

function retry_command() {
    local attempt=1
    
    while [[ ${attempt} -le ${MAX_RETRIES} ]]; do
        if "$@"; then
            return 0
        fi
        
        if [[ ${attempt} -lt ${MAX_RETRIES} ]]; then
            echo -e "${YELLOW}⚠ Attempt ${attempt} failed, retrying...${NC}" >&2
            sleep $((attempt * 2))  # Exponential backoff
        fi
        
        ((attempt++))
    done
    
    echo -e "${RED}✗ Command failed after ${MAX_RETRIES} attempts${NC}" >&2
    return 1
}

# Usage
retry_command aws s3 cp large-file.zip s3://bucket/
echo -e "${GREEN}✓ Upload successful${NC}"
```

### ❌ Incorrect - No Error Handling

```bash
#!/usr/bin/env bash

# ❌ WRONG - No set -e, continues after failures

echo "Building..."
npm run build  # Might fail, but script continues

echo "Deploying..."
aws lambda update-function-code  # Deploys broken code!

echo "Complete"  # Shows "Complete" even if everything failed!
```

### ❌ Incorrect - Silent Failures

```bash
#!/usr/bin/env bash

set -e

# ❌ WRONG - Error output suppressed
npm run build &>/dev/null

# User has no idea what went wrong if build fails

# ✅ CORRECT - Show errors
npm run build
```

### ❌ Incorrect - Poor Error Messages

```bash
#!/usr/bin/env bash

set -e

# ❌ WRONG - Unhelpful error
if [[ ! -f "config.json" ]]; then
    echo "File not found"
    exit 1
fi

# ✅ CORRECT - Helpful error with context
CONFIG_FILE="${PROJECT_ROOT}/config.json"
if [[ ! -f "${CONFIG_FILE}" ]]; then
    echo -e "${RED}✗ Configuration file not found: ${CONFIG_FILE}${NC}" >&2
    echo -e "${YELLOW}  Create it with: cp config.example.json config.json${NC}" >&2
    exit 1
fi
```

## Error Handling Patterns

### Validation at Script Start

```bash
#!/usr/bin/env bash

set -e

RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Validate environment before doing anything
function validate_environment() {
    local errors=0
    
    # Check required commands
    for cmd in aws jq npm; do
        if ! command -v ${cmd} &>/dev/null; then
            echo -e "${RED}✗ Required command not found: ${cmd}${NC}" >&2
            ((errors++))
        fi
    done
    
    # Check required environment variables
    for var in AWS_PROFILE AWS_REGION TABLE_NAME; do
        if [[ -z "${!var}" ]]; then
            echo -e "${RED}✗ Required environment variable not set: ${var}${NC}" >&2
            ((errors++))
        fi
    done
    
    # Check required files
    for file in config.json package.json; do
        if [[ ! -f "${PROJECT_ROOT}/${file}" ]]; then
            echo -e "${RED}✗ Required file not found: ${file}${NC}" >&2
            ((errors++))
        fi
    done
    
    if [[ ${errors} -gt 0 ]]; then
        echo -e "${RED}✗ Validation failed with ${errors} error(s)${NC}" >&2
        exit 1
    fi
    
    echo -e "${GREEN}✓ Environment validation passed${NC}"
}

validate_environment

# Continue with main script logic
```

### Exit Codes

```bash
#!/usr/bin/env bash

set -e

# Exit codes
EXIT_SUCCESS=0
EXIT_VALIDATION_FAILED=1
EXIT_BUILD_FAILED=2
EXIT_DEPLOY_FAILED=3
EXIT_TEST_FAILED=4

# Validation
if ! validate_environment; then
    exit ${EXIT_VALIDATION_FAILED}
fi

# Build
if ! npm run build; then
    echo -e "${RED}✗ Build failed${NC}" >&2
    exit ${EXIT_BUILD_FAILED}
fi

# Test
if ! npm test; then
    echo -e "${RED}✗ Tests failed${NC}" >&2
    exit ${EXIT_TEST_FAILED}
fi

# Deploy
if ! deploy_to_aws; then
    echo -e "${RED}✗ Deployment failed${NC}" >&2
    exit ${EXIT_DEPLOY_FAILED}
fi

exit ${EXIT_SUCCESS}
```

### Error Output to stderr

```bash
#!/usr/bin/env bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

# ✅ Success to stdout
echo -e "${GREEN}✓ Operation successful${NC}"

# ✅ Errors to stderr
echo -e "${RED}✗ Operation failed${NC}" >&2

# This allows:
# ./script.sh > output.log 2> errors.log
# Successes in output.log, errors in errors.log
```

### set Options

```bash
#!/usr/bin/env bash

# Common set options for robust scripts

set -e  # Exit on error
set -u  # Exit on undefined variable
set -o pipefail  # Exit on pipe failures

# Example of pipefail
curl https://api.example.com/data | jq '.result'

# Without pipefail: if curl fails, script continues (jq processes empty input)
# With pipefail: if curl fails, entire pipeline fails, script exits
```

### Command-Specific Error Handling

```bash
#!/usr/bin/env bash

set -e

RED='\033[0;31m'
NC='\033[0m'

# Allow specific command to fail
docker stop my-container || true

# Conditional execution
if docker ps | grep -q my-container; then
    docker stop my-container
fi

# Capture and check exit code
if ! aws lambda invoke --function-name ProcessFile output.json; then
    echo -e "${RED}✗ Lambda invocation failed${NC}" >&2
    exit 1
fi

# Turn off exit-on-error temporarily
set +e
optional_command_that_might_fail
set -e
```

## Rationale

### set -e Benefits

1. **Fail Fast** - Stop before damage is done
2. **Explicit Failures** - Must handle expected failures
3. **Debugging** - Clear which command failed
4. **Safety** - Prevents cascading failures

### Context in Errors Benefits

1. **Faster Resolution** - Users know what to do
2. **Less Support** - Self-service problem solving
3. **Learning** - Users understand the system
4. **Professional** - Shows attention to detail

### Cleanup Benefits

1. **No Resource Leaks** - Temp files always removed
2. **Clean State** - System left in known state
3. **Reliability** - Works even on failure
4. **Best Practice** - Professional script behavior

## Enforcement

### Code Review Checklist

- [ ] Script starts with `set -e`
- [ ] Expected failures handled explicitly
- [ ] Error messages go to stderr (>&2)
- [ ] Error messages include context and hints
- [ ] Cleanup registered with trap EXIT
- [ ] Validation at script start
- [ ] Meaningful exit codes

### Template

```bash
#!/usr/bin/env bash

# script-name.sh
# Description
# Usage: ./script-name.sh

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Directory resolution
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Cleanup function
cleanup() {
    local exit_code=$?
    # Cleanup logic here
}
trap cleanup EXIT

# Validation
function validate_environment() {
    # Validation logic here
}

# Main function
function main() {
    validate_environment
    
    # Main script logic
    
    echo -e "${GREEN}✓ Script completed successfully${NC}"
}

# Run main function
main "$@"
```

## Related Patterns

- [Script Patterns](Script-Patterns.md) - Overall script structure
- [User Output Formatting](User-Output-Formatting.md) - Error message formatting
- [Directory Resolution](Directory-Resolution.md) - Reliable path handling

---

*Always use set -e to exit on errors, explicitly handle expected failures, provide helpful error messages with context, and clean up resources with trap EXIT.*
