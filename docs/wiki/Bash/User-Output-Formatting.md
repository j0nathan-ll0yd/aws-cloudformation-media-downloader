# User Output Formatting

## Quick Reference
- **When to use**: All user-facing script output
- **Enforcement**: Recommended
- **Impact if violated**: LOW - Less readable output

## Color Definitions

```bash
#!/usr/bin/env bash

# Define at script top
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'  # No Color - always reset
```

## Output Functions

```bash
# Success message
success() {
  echo -e "${GREEN}✓${NC} $1"
}

# Error message
error() {
  echo -e "${RED}✗${NC} $1" >&2
}

# Warning message
warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

# Info message
info() {
  echo -e "${BLUE}➜${NC} $1"
}

# Usage
success "Build completed"
error "Build failed"
warning "Using default config"
info "Starting deployment"
```

## Progress Indicators

```bash
# Step counter
STEP=1
TOTAL=5

step() {
  echo -e "${BLUE}[${STEP}/${TOTAL}]${NC} $1"
  ((STEP++))
}

# Usage
step "Installing dependencies"
step "Running tests"
step "Building project"
```

## Semantic Formatting

| Type | Color | Symbol | Usage |
|------|-------|--------|-------|
| Success | Green | ✓ | Operation completed |
| Error | Red | ✗ | Operation failed |
| Warning | Yellow | ⚠ | Caution needed |
| Info | Blue | ➜ | General information |

## AWS CLI Output

```bash
# Format AWS output
echo -e "${GREEN}✓${NC} Lambda deployed: ${BLUE}${function_name}${NC}"
echo -e "${GREEN}✓${NC} S3 bucket: ${BLUE}${bucket_name}${NC}"
```

## Best Practices

✅ Define colors once at top
✅ Always reset color with `${NC}`
✅ Use stderr for errors: `>&2`
✅ Be consistent with symbols
✅ Keep messages concise

## Related Patterns

- [Error Handling](Error-Handling.md)
- [Script Patterns](Script-Patterns.md)

---

*Use colors and symbols for clear, scannable output.*