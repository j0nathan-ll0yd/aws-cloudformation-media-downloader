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

## Related Patterns

- [Error Handling](Error-Handling.md)
- [Directory Resolution](Directory-Resolution.md)
- [Variable Naming](Variable-Naming.md)

---

*Consistent bash scripts with proper error handling and clear output.*