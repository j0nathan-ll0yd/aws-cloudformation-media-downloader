# User Output Formatting

## Quick Reference
- **When to use**: All user-facing script output
- **Enforcement**: Recommended - improves user experience
- **Impact if violated**: LOW - Output still works but less readable

## Overview

Use color coding and symbols (✓, ✗, ⚠) to provide clear visual feedback. Structure output to make script progress and status easy to understand at a glance.

## The Rules

### 1. Define Colors as Constants

Define all color codes at the top of the script.

### 2. Use Semantic Color Coding

- Green for success
- Red for errors
- Yellow for warnings
- Default for informational

### 3. Include Visual Symbols

Use ✓, ✗, ⚠ symbols to reinforce status.

### 4. Reset Color After Each Message

Always include `${NC}` (No Color) to prevent color bleeding.

## Color Definitions

### Standard Colors

```bash
#!/usr/bin/env bash

# Define colors at script top
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'  # No Color - always reset

# Bold variants
BOLD_RED='\033[1;31m'
BOLD_GREEN='\033[1;32m'
BOLD_YELLOW='\033[1;33m'
```

### Usage Examples

```bash
# Success message
echo -e "${GREEN}✓ Deployment completed successfully${NC}"

# Error message
echo -e "${RED}✗ Failed to connect to database${NC}"

# Warning message
echo -e "${YELLOW}⚠ Configuration file not found, using defaults${NC}"

# Info message
echo -e "${BLUE}ℹ Starting deployment process${NC}"
```

## Examples

### ✅ Correct - Semantic Color Usage

```bash
#!/usr/bin/env bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Starting Lambda deployment...${NC}"

# Build step
echo "Building Lambda functions..."
if npm run build; then
    echo -e "${GREEN}✓ Build completed${NC}"
else
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi

# Deploy step
echo "Deploying to AWS..."
if aws lambda update-function-code --function-name ProcessFile; then
    echo -e "${GREEN}✓ Deployment successful${NC}"
else
    echo -e "${RED}✗ Deployment failed${NC}"
    exit 1
fi

# Warning about configuration
if [[ ! -f "config.json" ]]; then
    echo -e "${YELLOW}⚠ No config.json found, using defaults${NC}"
fi

echo -e "${GREEN}✓ All operations completed${NC}"
```

### ✅ Correct - Progress Indication

```bash
#!/usr/bin/env bash

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}=== Lambda Deployment ===${NC}"
echo ""

# Step 1
echo -e "${CYAN}[1/3]${NC} Building functions..."
npm run build
echo -e "${GREEN}✓ Build complete${NC}"
echo ""

# Step 2
echo -e "${CYAN}[2/3]${NC} Packaging functions..."
zip -r build.zip build/
echo -e "${GREEN}✓ Packaging complete${NC}"
echo ""

# Step 3
echo -e "${CYAN}[3/3]${NC} Deploying to AWS..."
aws lambda update-function-code --zip-file fileb://build.zip
echo -e "${GREEN}✓ Deployment complete${NC}"
echo ""

echo -e "${GREEN}=== Deployment Successful ===${NC}"
```

### ✅ Correct - Error Context

```bash
#!/usr/bin/env bash

RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

function deploy_lambda() {
    local function_name=$1
    
    if ! aws lambda get-function --function-name "${function_name}" &>/dev/null; then
        echo -e "${RED}✗ Lambda function not found: ${function_name}${NC}"
        echo -e "${YELLOW}  Hint: Create the function first or check the name${NC}"
        return 1
    fi
    
    if ! aws lambda update-function-code --function-name "${function_name}"; then
        echo -e "${RED}✗ Failed to update function: ${function_name}${NC}"
        echo -e "${YELLOW}  Check AWS credentials and permissions${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✓ Successfully deployed: ${function_name}${NC}"
}
```

### ❌ Incorrect - No Colors or Symbols

```bash
# ❌ WRONG - Plain text, hard to scan
echo "Building Lambda functions..."
npm run build
echo "Build completed"

echo "Deploying to AWS..."
aws lambda update-function-code
echo "Deployment completed"

# ✅ CORRECT - Clear visual feedback
echo -e "${BLUE}Building Lambda functions...${NC}"
npm run build
echo -e "${GREEN}✓ Build completed${NC}"

echo -e "${BLUE}Deploying to AWS...${NC}"
aws lambda update-function-code
echo -e "${GREEN}✓ Deployment completed${NC}"
```

### ❌ Incorrect - Color Bleeding

```bash
# ❌ WRONG - Doesn't reset color
echo -e "${GREEN}✓ Step 1 complete"
echo "Step 2 starting"  # Still green!
echo "Step 3 starting"  # Still green!

# ✅ CORRECT - Reset after each message
echo -e "${GREEN}✓ Step 1 complete${NC}"
echo "Step 2 starting"
echo "Step 3 starting"
```

## Status Message Patterns

### Operation Status

```bash
# Success
echo -e "${GREEN}✓ Operation successful${NC}"

# Failure
echo -e "${RED}✗ Operation failed${NC}"

# In progress
echo -e "${BLUE}→ Processing...${NC}"

# Skipped
echo -e "${YELLOW}⊘ Skipped (already exists)${NC}"

# Warning
echo -e "${YELLOW}⚠ Warning: Non-critical issue${NC}"
```

### Multi-Step Operations

```bash
#!/usr/bin/env bash

GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

total_steps=5
current_step=0

function run_step() {
    local step_name=$1
    ((current_step++))
    
    echo -e "${CYAN}[${current_step}/${total_steps}]${NC} ${step_name}..."
}

function step_complete() {
    echo -e "${GREEN}✓ Complete${NC}"
    echo ""
}

run_step "Installing dependencies"
npm install
step_complete

run_step "Building application"
npm run build
step_complete

run_step "Running tests"
npm test
step_complete

run_step "Packaging artifacts"
zip -r dist.zip dist/
step_complete

run_step "Deploying to production"
aws lambda update-function-code
step_complete
```

### Verbose Output Control

```bash
#!/usr/bin/env bash

VERBOSE=${VERBOSE:-false}

GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

function verbose() {
    if [[ "${VERBOSE}" == "true" ]]; then
        echo -e "${CYAN}[VERBOSE]${NC} $*"
    fi
}

function info() {
    echo -e "${CYAN}ℹ${NC} $*"
}

function success() {
    echo -e "${GREEN}✓${NC} $*"
}

# Usage
info "Starting deployment"
verbose "Using AWS profile: ${AWS_PROFILE}"
verbose "Region: ${AWS_REGION}"

aws lambda update-function-code
success "Deployment completed"

verbose "Function ARN: ${function_arn}"
```

## Table Output

```bash
#!/usr/bin/env bash

CYAN='\033[0;36m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${CYAN}Lambda Functions:${NC}"
echo "----------------------------------------"
printf "%-20s %-15s %-10s\n" "Name" "Runtime" "Status"
echo "----------------------------------------"

printf "%-20s %-15s ${GREEN}%-10s${NC}\n" "ProcessFile" "nodejs22.x" "Active"
printf "%-20s %-15s ${GREEN}%-10s${NC}\n" "DownloadVideo" "nodejs22.x" "Active"
printf "%-20s %-15s ${GREEN}%-10s${NC}\n" "RegisterDevice" "nodejs22.x" "Active"

echo "----------------------------------------"
```

## Spinner/Progress Indicators

```bash
#!/usr/bin/env bash

function show_spinner() {
    local pid=$1
    local delay=0.1
    local spinstr='|/-\'
    
    while kill -0 "$pid" 2>/dev/null; do
        local temp=${spinstr#?}
        printf " [%c]  " "$spinstr"
        local spinstr=$temp${spinstr%"$temp"}
        sleep $delay
        printf "\b\b\b\b\b\b"
    done
    printf "    \b\b\b\b"
}

# Usage
long_running_command &
show_spinner $!
echo -e "${GREEN}✓ Complete${NC}"
```

## Box Drawing

```bash
#!/usr/bin/env bash

GREEN='\033[0;32m'
NC='\033[0m'

function print_box() {
    local message=$1
    local length=${#message}
    local border=$(printf '%*s' $((length + 4)) '' | tr ' ' '=')
    
    echo -e "${GREEN}${border}${NC}"
    echo -e "${GREEN}  ${message}  ${NC}"
    echo -e "${GREEN}${border}${NC}"
}

print_box "Deployment Successful"
```

## Rationale

### Color Coding Benefits

1. **Quick Scanning** - Users instantly see success/failure
2. **Visual Hierarchy** - Important messages stand out
3. **Error Detection** - Red errors immediately visible
4. **Professional** - Polished, modern appearance

### Symbol Benefits

1. **Language Independent** - ✓ and ✗ understood universally
2. **Status at a Glance** - No need to read full message
3. **Consistency** - Same symbols mean same things
4. **Accessibility** - Works with color blindness

### Reset Color Benefits

1. **No Bleeding** - Colors don't affect other output
2. **Clean Terminal** - Prompt returns to normal
3. **Predictable** - Each message controls its own color
4. **Compatibility** - Works with different terminals

## Enforcement

### Code Review Checklist

- [ ] Colors defined as constants at script top
- [ ] Success messages use green
- [ ] Error messages use red
- [ ] Warnings use yellow
- [ ] Info messages use blue/cyan
- [ ] All colored messages reset with ${NC}
- [ ] Symbols (✓, ✗, ⚠) used consistently
- [ ] Multi-step operations show progress

### Helper Functions

```bash
# lib/colors.sh

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

function print_success() {
    echo -e "${GREEN}✓${NC} $*"
}

function print_error() {
    echo -e "${RED}✗${NC} $*" >&2
}

function print_warning() {
    echo -e "${YELLOW}⚠${NC} $*"
}

function print_info() {
    echo -e "${BLUE}ℹ${NC} $*"
}

# Usage in scripts
source "$(dirname "${BASH_SOURCE[0]}")/../lib/colors.sh"

print_info "Starting deployment"
print_success "Deployment completed"
print_warning "Configuration outdated"
print_error "Connection failed"
```

## Terminal Compatibility

```bash
# Check if terminal supports colors
if [[ -t 1 ]] && command -v tput &>/dev/null && [[ $(tput colors) -ge 8 ]]; then
    # Terminal supports colors
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    NC='\033[0m'
else
    # No color support - use plain text
    RED=''
    GREEN=''
    NC=''
fi

echo -e "${GREEN}✓ This works with or without color support${NC}"
```

## Related Patterns

- [Script Patterns](Script-Patterns.md) - Overall script structure
- [Error Handling](Error-Handling.md) - Error output formatting
- [Variable Naming](Variable-Naming.md) - UPPER_CASE for color constants

---

*Use color coding and visual symbols to provide clear, scannable feedback. Always reset colors after each message to prevent bleeding.*
