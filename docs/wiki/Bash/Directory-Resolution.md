# Directory Resolution

## Quick Reference
- **When to use**: All Bash scripts that need to know their location
- **Enforcement**: Required - ensures scripts work from any directory
- **Impact if violated**: HIGH - Scripts fail when run from different locations

## Overview

Always use `BASH_SOURCE[0]` with `cd` and `pwd` to get the absolute path of the script directory. This works correctly regardless of how the script is invoked (directly, via symlink, or sourced).

## The Rule

Use this standard pattern at the top of every script:

```bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
```

## Examples

### ✅ Correct - Standard Pattern

```bash
#!/usr/bin/env bash

# Get script directory - works from anywhere
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Now we can reliably reference project files
SOURCE_DIR="${PROJECT_ROOT}/src"
BUILD_DIR="${PROJECT_ROOT}/build"
CONFIG_FILE="${PROJECT_ROOT}/config.json"

echo "Script located at: ${SCRIPT_DIR}"
echo "Project root: ${PROJECT_ROOT}"

# Safe to change directory
cd "${PROJECT_ROOT}"
npm run build
```

### ✅ Correct - Multi-Level Navigation

```bash
#!/usr/bin/env bash

# Script in bin/deploy.sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Navigate to subdirectories
TERRAFORM_DIR="${PROJECT_ROOT}/terraform"
LAMBDA_DIR="${PROJECT_ROOT}/src/lambdas"

cd "${TERRAFORM_DIR}"
tofu apply -auto-approve

cd "${LAMBDA_DIR}"
for lambda in */; do
    echo "Processing ${lambda}"
done
```

### ✅ Correct - Sourced Script Support

```bash
#!/usr/bin/env bash

# This works even if script is sourced
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load configuration from same directory as script
source "${SCRIPT_DIR}/config.sh"

# Or from relative to script
source "${SCRIPT_DIR}/../lib/utils.sh"
```

### ❌ Incorrect - Using $0

```bash
# ❌ WRONG - Fails when script is sourced
script_dir="$(cd "$(dirname "$0")" && pwd)"

# Problem: $0 gives shell name when sourced
# When you run: source ./script.sh
# $0 = "bash" or "zsh", not "./script.sh"

# ✅ CORRECT - Use BASH_SOURCE[0]
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
```

### ❌ Incorrect - Relative Paths

```bash
# ❌ WRONG - Breaks when run from different directory
cd ../src
npm run build

# If run from /home/user/project/bin:  cd ../src → /home/user/project/src ✓
# If run from /home/user:              cd ../src → /home/src ✗

# ✅ CORRECT - Absolute paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}/src"
npm run build
```

### ❌ Incorrect - Assuming Current Directory

```bash
# ❌ WRONG - Assumes script run from project root
if [[ -f "config.json" ]]; then
    config=$(cat config.json)
fi

# Fails if run from subdirectory or different location

# ✅ CORRECT - Use absolute path
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [[ -f "${PROJECT_ROOT}/config.json" ]]; then
    config=$(cat "${PROJECT_ROOT}/config.json")
fi
```

## Why This Pattern Works

### BASH_SOURCE[0] vs $0

```bash
#!/usr/bin/env bash

# $0 behavior:
# - Direct execution: ./script.sh → $0 = "./script.sh"
# - Sourced: source ./script.sh → $0 = "bash" (or current shell)
# - Symlink: ./link → $0 = "./link" (not real path)

# BASH_SOURCE[0] behavior:
# - Direct execution: ./script.sh → BASH_SOURCE[0] = "./script.sh"
# - Sourced: source ./script.sh → BASH_SOURCE[0] = "./script.sh" ✓
# - Symlink: ./link → BASH_SOURCE[0] = resolved path ✓

# Always use BASH_SOURCE[0]
```

### dirname and cd

```bash
# Get directory containing script
dirname "${BASH_SOURCE[0]}"  # Returns relative path

# cd to resolve relative path and symlinks
cd "$(dirname "${BASH_SOURCE[0]}")" && pwd

# Why && pwd:
# - cd changes directory
# - pwd prints absolute path
# - && ensures pwd only runs if cd succeeds
# - $() captures output
```

### Handling Spaces in Paths

```bash
# ❌ WRONG - Breaks with spaces
SCRIPT_DIR=$(cd $(dirname ${BASH_SOURCE[0]}) && pwd)

# If path is "/home/my folder/scripts/deploy.sh"
# Breaks because: dirname /home/my → tries to process "folder/scripts/deploy.sh" separately

# ✅ CORRECT - Quotes handle spaces
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Now works with "/home/my folder/scripts/deploy.sh"
```

## Project Structure Patterns

### Typical Project Layout

```
project/
├── bin/              # Scripts
│   ├── deploy.sh
│   ├── test.sh
│   └── build.sh
├── src/              # Source code
├── terraform/        # Infrastructure
├── config/           # Configuration
└── package.json
```

### Scripts in bin/

```bash
#!/usr/bin/env bash
# bin/deploy.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# PROJECT_ROOT = /path/to/project
# SCRIPT_DIR = /path/to/project/bin

SRC_DIR="${PROJECT_ROOT}/src"
TERRAFORM_DIR="${PROJECT_ROOT}/terraform"
CONFIG_DIR="${PROJECT_ROOT}/config"
```

### Scripts in Subdirectories

```bash
#!/usr/bin/env bash
# scripts/deploy/lambda.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PROJECT_ROOT="$(cd "${SCRIPTS_DIR}/.." && pwd)"

# SCRIPT_DIR = /path/to/project/scripts/deploy
# SCRIPTS_DIR = /path/to/project/scripts
# PROJECT_ROOT = /path/to/project
```

### Scripts at Project Root

```bash
#!/usr/bin/env bash
# deploy.sh (at project root)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# SCRIPT_DIR = /path/to/project (script IS project root)

# Access subdirectories
SRC_DIR="${SCRIPT_DIR}/src"
BUILD_DIR="${SCRIPT_DIR}/build"
```

## Common Use Cases

### Loading Configuration Files

```bash
#!/usr/bin/env bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Load config from same directory as script
if [[ -f "${SCRIPT_DIR}/config.sh" ]]; then
    source "${SCRIPT_DIR}/config.sh"
fi

# Load config from project root
if [[ -f "${PROJECT_ROOT}/.env" ]]; then
    source "${PROJECT_ROOT}/.env"
fi
```

### Sourcing Utility Scripts

```bash
#!/usr/bin/env bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load utilities from lib/
source "${SCRIPT_DIR}/../lib/colors.sh"
source "${SCRIPT_DIR}/../lib/aws-helpers.sh"
source "${SCRIPT_DIR}/../lib/error-handling.sh"

# Now can use functions from utility scripts
print_success "Deployment started"
```

### Accessing Project Files

```bash
#!/usr/bin/env bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Read package.json
package_version=$(cat "${PROJECT_ROOT}/package.json" | jq -r '.version')

# Copy files
cp "${PROJECT_ROOT}/README.md" "${PROJECT_ROOT}/build/"

# Run from specific directory
cd "${PROJECT_ROOT}"
npm run build
```

### Working with Symlinks

```bash
#!/usr/bin/env bash

# This script might be symlinked
# e.g., /usr/local/bin/deploy -> /home/user/project/bin/deploy.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Even with symlink, SCRIPT_DIR resolves to real path:
# SCRIPT_DIR = /home/user/project/bin

PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
# PROJECT_ROOT = /home/user/project

# Script works correctly regardless of symlink
```

## Rationale

### Why Absolute Paths

1. **Portability** - Script works from any directory
2. **Predictability** - Always references same files
3. **Robustness** - No assumptions about current directory
4. **Debugging** - Clear what files are being accessed

### Why BASH_SOURCE[0]

1. **Sourcing Support** - Works when sourced
2. **Symlink Resolution** - Resolves to real path
3. **Reliability** - More robust than $0
4. **Consistency** - Same behavior in all contexts

### Why cd and pwd

1. **Symlink Resolution** - cd resolves symlinks
2. **Absolute Paths** - pwd gives absolute path
3. **Cleanup** - Removes ./ and ../
4. **Reliability** - Standard POSIX approach

## Enforcement

### Code Review Checklist

- [ ] All scripts use BASH_SOURCE[0]
- [ ] Directory resolution at top of script
- [ ] All paths quoted to handle spaces
- [ ] No relative paths without resolution
- [ ] No assumptions about current directory

### Template for New Scripts

```bash
#!/usr/bin/env bash

# script-name.sh
# Description of what this script does
# Usage: ./script-name.sh [options]

set -e  # Exit on error

# Directory resolution
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Constants
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

# Main script logic
echo "Running from: ${SCRIPT_DIR}"
echo "Project root: ${PROJECT_ROOT}"

# Rest of script...
```

## Testing Directory Resolution

```bash
# Test script from different locations

# From project root
./bin/deploy.sh

# From bin directory
cd bin && ./deploy.sh

# From random location
cd /tmp && /path/to/project/bin/deploy.sh

# Via symlink
ln -s /path/to/project/bin/deploy.sh /usr/local/bin/deploy
deploy

# All should work correctly with BASH_SOURCE[0] pattern
```

## Related Patterns

- [Variable Naming](Variable-Naming.md) - UPPER_CASE for path constants
- [Script Patterns](Script-Patterns.md) - Overall script structure
- [Error Handling](Error-Handling.md) - set -e for cd failures

---

*Always use BASH_SOURCE[0] with cd and pwd for directory resolution. This ensures scripts work correctly regardless of how they're invoked or where they're run from.*
