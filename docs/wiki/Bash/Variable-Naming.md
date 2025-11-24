# Variable Naming

## Quick Reference
- **When to use**: All Bash script variables
- **Enforcement**: Required - maintain consistency
- **Impact if violated**: MEDIUM - Confusion about variable scope and mutability

## Overview

Bash variables should use snake_case for regular variables and UPPER_CASE for constants, environment variables, and configuration values that don't change during script execution.

## The Rules

### 1. Use snake_case for Regular Variables

Local variables, temporary values, and mutable state use lowercase with underscores.

### 2. Use UPPER_CASE for Constants

Configuration, paths, and values that don't change use uppercase with underscores.

### 3. Use Descriptive Names

Variable names should clearly indicate their purpose.

### 4. Avoid Single-Letter Names

Exception: Loop counters like `i`, `j`.

## Examples

### ✅ Correct - snake_case for Regular Variables

```bash
#!/usr/bin/env bash

# Regular variables - snake_case
file_name="data.json"
temp_dir=$(mktemp -d)
api_response=$(curl -s "https://api.example.com/data")
user_count=0

# Function local variables
function process_file() {
    local input_file=$1
    local output_file=$2
    local line_count=0
    
    while IFS= read -r line; do
        ((line_count++))
    done < "${input_file}"
    
    echo "${line_count}"
}
```

### ✅ Correct - UPPER_CASE for Constants

```bash
#!/usr/bin/env bash

# Constants - UPPER_CASE
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BUILD_DIR="${PROJECT_ROOT}/build"
CONFIG_FILE="${PROJECT_ROOT}/config.json"

# Color constants
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration constants
MAX_RETRIES=3
TIMEOUT_SECONDS=300
DEFAULT_REGION="us-west-2"
```

### ✅ Correct - Environment Variables

```bash
# Reading from environment - UPPER_CASE
AWS_PROFILE=${AWS_PROFILE:-default}
AWS_REGION=${AWS_REGION:-us-west-2}
TABLE_NAME=${TABLE_NAME:-MediaDownloader}
ENABLE_XRAY=${ENABLE_XRAY:-true}

# Setting environment variables for child processes
export AWS_PROFILE
export AWS_REGION
export TABLE_NAME
```

### ❌ Incorrect - Inconsistent Naming

```bash
# ❌ WRONG - Mixed casing for regular variables
fileName="data.json"        # Should be file_name
TempDir=$(mktemp -d)        # Should be temp_dir
APIresponse=$(curl ...)     # Should be api_response
userCount=0                 # Should be user_count

# ❌ WRONG - snake_case for constants
script_dir="$(cd ...)"      # Should be SCRIPT_DIR
max_retries=3               # Should be MAX_RETRIES
red_color='\033[0;31m'      # Should be RED

# ❌ WRONG - UPPER_CASE for mutable variables
FILE_NAME="data.json"
FILE_NAME="other.json"      # Changed - should be snake_case
```

### ❌ Incorrect - Poor Variable Names

```bash
# ❌ WRONG - Non-descriptive names
f="data.json"               # What is f?
d=$(mktemp -d)              # What is d?
r=$(curl ...)               # What is r?
n=0                         # What is n?

# ✅ CORRECT - Descriptive names
file_name="data.json"
temp_dir=$(mktemp -d)
api_response=$(curl ...)
user_count=0
```

## Naming Patterns

### File and Path Variables

```bash
# Regular file variables - snake_case
input_file="/path/to/input.txt"
output_file="/path/to/output.txt"
log_file="/var/log/app.log"
temp_file=$(mktemp)

# Constant paths - UPPER_CASE
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SRC_DIR="${PROJECT_ROOT}/src"
BUILD_DIR="${PROJECT_ROOT}/build"
CONFIG_DIR="${PROJECT_ROOT}/config"
SECURE_DIR="${PROJECT_ROOT}/secure"
```

### AWS Resource Variables

```bash
# Regular resource identifiers - snake_case
function_name="ProcessFile"
bucket_name="my-media-files"
table_name="MediaDownloader"
queue_url="https://sqs.us-west-2.amazonaws.com/..."

# Constant resource names - UPPER_CASE
LAMBDA_FUNCTION="ProcessFile"
S3_BUCKET="my-media-files"
DYNAMODB_TABLE="MediaDownloader"
SQS_QUEUE_URL="https://sqs.us-west-2.amazonaws.com/..."
```

### Loop and Counter Variables

```bash
# Simple loop counters - single letter OK
for i in {1..10}; do
    echo "Iteration ${i}"
done

# Named loop variables - descriptive
for file_path in "${BUILD_DIR}"/*.zip; do
    echo "Processing ${file_path}"
done

# Enumeration - descriptive
for lambda_function in ProcessFile DownloadVideo RegisterDevice; do
    echo "Deploying ${lambda_function}"
done
```

### Boolean Flags

```bash
# Regular flags - snake_case
dry_run=false
verbose=false
force=false

# Constant flags - UPPER_CASE
DRY_RUN=${DRY_RUN:-false}
VERBOSE=${VERBOSE:-false}
DEBUG=${DEBUG:-false}

# Usage
if [[ "${dry_run}" == "true" ]]; then
    echo "[DRY RUN] Would execute command"
fi
```

### API and External Data

```bash
# API responses - snake_case
api_response=$(curl -s "https://api.example.com/data")
status_code=$(echo "${api_response}" | jq -r '.status')
error_message=$(echo "${api_response}" | jq -r '.error')

# Parsed data
user_id=$(echo "${api_response}" | jq -r '.userId')
file_count=$(echo "${api_response}" | jq -r '.files | length')
```

## Function Parameters

```bash
# Function with clear parameter names
function deploy_lambda() {
    local function_name=$1
    local zip_file_path=$2
    local environment=$3
    
    if [[ -z "${function_name}" ]]; then
        echo "Error: function_name required"
        return 1
    fi
    
    echo "Deploying ${function_name} from ${zip_file_path}"
    
    aws lambda update-function-code \
        --function-name "${function_name}" \
        --zip-file "fileb://${zip_file_path}"
}

# Call with descriptive arguments
deploy_lambda "ProcessFile" "${BUILD_DIR}/ProcessFile.zip" "production"
```

## Constants Pattern

```bash
#!/usr/bin/env bash

# Declare all constants at top of script
readonly SCRIPT_NAME=$(basename "$0")
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Color constants
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m'

# Configuration constants
readonly MAX_RETRIES=3
readonly TIMEOUT=300
readonly DEFAULT_REGION="us-west-2"

# Using readonly prevents accidental modification
# This will fail:
# MAX_RETRIES=5  # bash: MAX_RETRIES: readonly variable
```

## Rationale

### snake_case Benefits

1. **Standard Unix Convention** - Follows Bash and shell scripting norms
2. **Distinguishes from Environment** - Clear separation from env vars
3. **Readability** - Easy to read and type
4. **Tool Compatibility** - Works with shell completion

### UPPER_CASE Benefits

1. **Visibility** - Constants stand out
2. **Environment Variable Convention** - Matches system convention
3. **Immutability Signal** - Indicates value shouldn't change
4. **Cross-Script Consistency** - Easy to identify configuration

### Descriptive Names Benefits

1. **Self-Documenting** - Purpose clear from name
2. **Maintainability** - Easy for others to understand
3. **Debugging** - Clear what variable represents
4. **Searchability** - Easy to find usage

## Enforcement

### Code Review Checklist

- [ ] Regular variables use snake_case
- [ ] Constants and config use UPPER_CASE
- [ ] Environment variables use UPPER_CASE
- [ ] Variable names are descriptive
- [ ] No single-letter names (except loop counters)
- [ ] Path variables are clearly named
- [ ] Boolean flags clearly indicate purpose

### ShellCheck Integration

```bash
# Use shellcheck to catch common issues
shellcheck script.sh

# Check specific issues
shellcheck -e SC2034 script.sh  # Unused variables
shellcheck -e SC2154 script.sh  # Referenced but not assigned
```

### Verification Script

```bash
#!/usr/bin/env bash

# Check for uppercase regular variables (potential issues)
grep -n "^[A-Z][A-Z_]*=" script.sh | grep -v "readonly"

# Check for lowercase constants (potential issues)
grep -n "readonly.*[a-z]" script.sh
```

## Common Mistakes

### Mixing Case Styles

```bash
# ❌ WRONG - Inconsistent
FileName="data.json"
file_name="data.json"
FILENAME="data.json"

# ✅ CORRECT - Consistent
file_name="data.json"
```

### Using UPPER_CASE for Mutable Variables

```bash
# ❌ WRONG - Changes during execution
FILE_COUNT=0
for file in *.txt; do
    ((FILE_COUNT++))  # Mutates - should be snake_case
done

# ✅ CORRECT
file_count=0
for file in *.txt; do
    ((file_count++))
done
```

### Unclear Variable Purpose

```bash
# ❌ WRONG - What is it?
f="/path/to/file"
d=$(date)
r=$(curl ...)

# ✅ CORRECT - Clear purpose
config_file="/path/to/file"
current_date=$(date)
api_response=$(curl ...)
```

## Related Patterns

- [Script Patterns](Script-Patterns.md) - Overall script structure
- [Directory Resolution](Directory-Resolution.md) - BASH_SOURCE pattern
- [Naming Conventions](../Conventions/Naming-Conventions.md) - Cross-language naming

---

*Use snake_case for regular variables and UPPER_CASE for constants and environment variables. Choose descriptive names that clearly indicate purpose.*
