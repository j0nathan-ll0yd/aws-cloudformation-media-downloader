# Variable Naming

## Quick Reference
- **When to use**: All Bash script variables
- **Enforcement**: Required - maintain consistency
- **Impact if violated**: MEDIUM - Confusion about variable scope and mutability

## The Rules

1. **snake_case** for regular variables (mutable, local)
2. **UPPER_CASE** for constants (immutable, configuration, paths)
3. **Descriptive names** that indicate purpose
4. **Avoid single letters** except loop counters

## Examples

### ✅ Correct

```bash
#!/usr/bin/env bash

# Constants - UPPER_CASE
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BUILD_DIR="${PROJECT_ROOT}/build"
MAX_RETRIES=3
RED='\033[0;31m'
GREEN='\033[0;32m'

# Environment variables - UPPER_CASE
AWS_PROFILE=${AWS_PROFILE:-default}
AWS_REGION=${AWS_REGION:-us-west-2}

# Regular variables - snake_case
file_name="data.json"
temp_dir=$(mktemp -d)
api_response=$(curl -s "https://api.example.com/data")
user_count=0

# Function with clear parameters
function deploy_lambda() {
    local function_name=$1
    local zip_file_path=$2

    echo "Deploying ${function_name} from ${zip_file_path}"
}
```

### ❌ Incorrect

```bash
# ❌ WRONG - Mixed casing
fileName="data.json"        # Should be file_name
TempDir=$(mktemp -d)        # Should be temp_dir
script_dir="$(cd ...)"      # Should be SCRIPT_DIR
max_retries=3               # Should be MAX_RETRIES

# ❌ WRONG - UPPER_CASE for mutable
FILE_COUNT=0
for file in *.txt; do
    ((FILE_COUNT++))        # Should be snake_case
done

# ❌ WRONG - Non-descriptive
f="data.json"               # What is f?
d=$(mktemp -d)              # What is d?
```

## Common Patterns

### Constants with readonly

```bash
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
readonly MAX_RETRIES=3
```

### Loop Variables

```bash
# Simple counters - single letter OK
for i in {1..10}; do
    echo "Iteration ${i}"
done

# Named variables - descriptive
for file_path in "${BUILD_DIR}"/*.zip; do
    echo "Processing ${file_path}"
done
```

### Boolean Flags

```bash
# Regular flags - snake_case
dry_run=false
verbose=false

# Constant flags - UPPER_CASE
DRY_RUN=${DRY_RUN:-false}
DEBUG=${DEBUG:-false}
```

## Enforcement

### Code Review Checklist

- [ ] Regular variables use snake_case
- [ ] Constants use UPPER_CASE
- [ ] Variable names are descriptive
- [ ] No single-letter names (except counters)

## Related Patterns

- [Script Patterns](Script-Patterns.md) - Overall script structure
- [Directory Resolution](Directory-Resolution.md) - BASH_SOURCE pattern

---

*Use snake_case for regular variables and UPPER_CASE for constants. Choose descriptive names that clearly indicate purpose.*
