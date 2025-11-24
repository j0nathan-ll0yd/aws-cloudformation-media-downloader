# Bash Script Patterns

This document defines the coding standards and patterns for Bash scripts in this project.

## File Structure

### Shebang

Always use `#!/usr/bin/env bash` for portability:

```bash
#!/usr/bin/env bash
```

**Why**: `env` searches PATH for bash, making scripts work across different systems where bash may be installed in different locations.

### File Header

Include a descriptive header comment:

```bash
#!/usr/bin/env bash

# script-name.sh
# Brief description of what this script does
# Usage: npm run script-name
```

### Error Handling

Use `set -e` to exit immediately on command failure:

```bash
#!/usr/bin/env bash

set -e  # Exit on error
```

For commands that may legitimately fail, handle explicitly:

```bash
command_that_might_fail || {
    echo -e "${RED}Error: Operation failed${NC}"
    exit 1
}
```

## Variable Naming Conventions

### Regular Variables (snake_case)

Use lowercase with underscores for regular variables:

```bash
bin_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
test_file_path="${bin_dir}/../src/pipeline/test.ts"
api_key="$(tofu output api_gateway_api_key | tr -d '"')"
```

### Constants (UPPER_CASE)

Use uppercase for constants and environment-like variables:

```bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SECURE_DIR="${PROJECT_ROOT}/secure/cookies"

# Color constants
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color
```

**Pattern**: If a variable represents a path or configuration that doesn't change, use UPPER_CASE.

## Directory Resolution

### Standard Pattern

Always use this pattern to get the script's directory:

```bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
```

**Why**:
- `${BASH_SOURCE[0]}` works even when script is sourced
- `cd` + `pwd` resolves symlinks and gives absolute path
- Quotes handle spaces in paths

### Legacy Pattern (Still Acceptable)

```bash
bin_dir="$(cd "$(dirname "$0")" && pwd)"
```

**Note**: Prefer `${BASH_SOURCE[0]}` for consistency and sourcing support.

## Command Output Formatting

### Status Messages

Use color-coded messages for user feedback:

```bash
# Define colors at script top
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Success message
echo -e "${GREEN}✓ Operation completed successfully${NC}"

# Warning message
echo -e "${YELLOW}⚠ Warning: Configuration may be outdated${NC}"

# Error message
echo -e "${RED}✗ Error: Failed to connect to service${NC}"
```

### Progress Output

Show what the script is doing:

```bash
echo "Building Lambda functions..."
npm run build

echo "Deploying infrastructure..."
tofu apply -auto-approve

echo -e "${GREEN}✓ Deployment complete${NC}"
```

## AWS CLI Commands

### Output Processing

Use `--output json` and `jq` for structured data:

```bash
# Get specific field from JSON output
lambda_arn=$(aws lambda get-function \
    --function-name MyFunction \
    --query 'Configuration.FunctionArn' \
    --output text)

# Process JSON array
aws s3api list-buckets --output json | jq -r '.Buckets[].Name'
```

### Error Handling

Check AWS CLI command success:

```bash
if ! aws s3 cp file.txt s3://bucket/; then
    echo -e "${RED}✗ Failed to upload file${NC}"
    exit 1
fi
```

## File Operations

### Safe File Paths

Always quote variables containing paths:

```bash
# Good
cp "${source_file}" "${dest_dir}/"
rm -f "${temp_file}"

# Bad - breaks with spaces
cp $source_file $dest_dir/
```

### Checking File Existence

```bash
if [[ ! -f "${config_file}" ]]; then
    echo -e "${RED}✗ Configuration file not found: ${config_file}${NC}"
    exit 1
fi

if [[ -d "${build_dir}" ]]; then
    echo "Cleaning build directory..."
    rm -rf "${build_dir}"
fi
```

## Functions

### Function Naming

Use lowercase with underscores:

```bash
function validate_environment() {
    if [[ -z "${AWS_PROFILE}" ]]; then
        echo -e "${RED}✗ AWS_PROFILE not set${NC}"
        return 1
    fi
}

function deploy_lambda() {
    local function_name=$1
    local zip_file=$2

    aws lambda update-function-code \
        --function-name "${function_name}" \
        --zip-file "fileb://${zip_file}"
}
```

## Script Arguments

### Processing Arguments

```bash
# Simple argument check
if [[ $# -eq 0 ]]; then
    echo "Usage: $0 <environment>"
    exit 1
fi

ENVIRONMENT=$1

# Option parsing
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done
```

## Common Patterns

### Retrying Commands

```bash
function retry_command() {
    local max_attempts=3
    local attempt=1

    while [[ $attempt -le $max_attempts ]]; do
        if "$@"; then
            return 0
        fi

        echo "Attempt $attempt failed. Retrying..."
        ((attempt++))
        sleep 2
    done

    echo -e "${RED}✗ Command failed after $max_attempts attempts${NC}"
    return 1
}

# Usage
retry_command aws s3 cp large-file.zip s3://bucket/
```

### Cleanup on Exit

```bash
# Define cleanup function
cleanup() {
    echo "Cleaning up temporary files..."
    rm -f "${TEMP_FILE}"
    rm -rf "${TEMP_DIR}"
}

# Register cleanup on script exit
trap cleanup EXIT

# Script continues...
TEMP_FILE=$(mktemp)
TEMP_DIR=$(mktemp -d)
```

## Testing Scripts

### Dry Run Mode

```bash
DRY_RUN=${DRY_RUN:-false}

if [[ "$DRY_RUN" == "true" ]]; then
    echo "[DRY RUN] Would execute: aws lambda invoke ..."
else
    aws lambda invoke ...
fi
```

### Debug Mode

```bash
# Enable debug output with DEBUG=true
if [[ "${DEBUG}" == "true" ]]; then
    set -x  # Print commands as they execute
fi
```

## Examples

### Complete Script Template

```bash
#!/usr/bin/env bash

# deploy.sh
# Deploy Lambda functions and infrastructure
# Usage: ./deploy.sh [--dry-run]

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Directory setup
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Parse arguments
DRY_RUN=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--dry-run]"
            exit 1
            ;;
    esac
done

# Main execution
echo "Starting deployment..."

if [[ "$DRY_RUN" == "true" ]]; then
    echo -e "${YELLOW}Running in DRY RUN mode${NC}"
fi

# Build
echo "Building Lambda functions..."
if [[ "$DRY_RUN" != "true" ]]; then
    npm run build
fi

# Deploy
echo "Deploying infrastructure..."
if [[ "$DRY_RUN" != "true" ]]; then
    cd "${PROJECT_ROOT}/terraform"
    tofu apply -auto-approve
fi

echo -e "${GREEN}✓ Deployment complete${NC}"
```

## Anti-Patterns to Avoid

### Don't Use

```bash
# ❌ Unquoted variables
rm -rf $TEMP_DIR/*

# ❌ Missing error handling
aws lambda invoke function.json

# ❌ Hardcoded paths
cd /home/user/project

# ❌ No shebang
echo "Missing shebang line"

# ❌ Using backticks for command substitution
dir=`pwd`
```

### Do Use

```bash
# ✅ Quoted variables
rm -rf "${TEMP_DIR}"/*

# ✅ Error handling
aws lambda invoke function.json || exit 1

# ✅ Relative/resolved paths
cd "${PROJECT_ROOT}"

# ✅ Proper shebang
#!/usr/bin/env bash

# ✅ Modern command substitution
dir=$(pwd)
```