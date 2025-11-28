# Directory Resolution

## Quick Reference
- **When to use**: All Bash scripts that need to know their location
- **Enforcement**: Required - ensures scripts work from any directory
- **Impact if violated**: HIGH - Scripts fail when run from different locations

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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Now we can reliably reference project files
SOURCE_DIR="${PROJECT_ROOT}/src"
BUILD_DIR="${PROJECT_ROOT}/build"

cd "${PROJECT_ROOT}"
npm run build
```

### ❌ Incorrect - Using $0 or Relative Paths

```bash
# ❌ WRONG - Fails when script is sourced
script_dir="$(cd "$(dirname "$0")" && pwd)"

# ❌ WRONG - Breaks when run from different directory
cd ../src
npm run build

# ✅ CORRECT
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}/src"
```

## Why This Pattern Works

### BASH_SOURCE[0] vs $0

- `$0` fails when script is sourced (returns shell name)
- `$0` doesn't resolve symlinks properly
- `BASH_SOURCE[0]` works in all contexts (direct, sourced, symlinked)

### Quotes Handle Spaces

```bash
# ❌ WRONG - Breaks with spaces in path
SCRIPT_DIR=$(cd $(dirname ${BASH_SOURCE[0]}) && pwd)

# ✅ CORRECT - Handles spaces
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
```

## Common Use Cases

### Scripts in bin/

```bash
#!/usr/bin/env bash
# bin/deploy.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

SRC_DIR="${PROJECT_ROOT}/src"
TERRAFORM_DIR="${PROJECT_ROOT}/terraform"
```

### Loading Configuration

```bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Load config from same directory as script
if [[ -f "${SCRIPT_DIR}/config.sh" ]]; then
    source "${SCRIPT_DIR}/config.sh"
fi

# Load from project root
if [[ -f "${PROJECT_ROOT}/.env" ]]; then
    source "${PROJECT_ROOT}/.env"
fi
```

### Sourcing Utilities

```bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "${SCRIPT_DIR}/../lib/colors.sh"
source "${SCRIPT_DIR}/../lib/aws-helpers.sh"
```

## Template for New Scripts

```bash
#!/usr/bin/env bash

set -e  # Exit on error

# Directory resolution
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Constants
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

# Main script logic
echo "Project root: ${PROJECT_ROOT}"
```

## Enforcement

### Code Review Checklist

- [ ] All scripts use BASH_SOURCE[0]
- [ ] Directory resolution at top of script
- [ ] All paths quoted to handle spaces
- [ ] No relative paths without resolution

## Related Patterns

- [Variable Naming](Variable-Naming.md) - UPPER_CASE for path constants
- [Script Patterns](Script-Patterns.md) - Overall script structure

---

*Always use BASH_SOURCE[0] with cd and pwd for directory resolution. This ensures scripts work correctly regardless of how they're invoked or where they're run from.*
