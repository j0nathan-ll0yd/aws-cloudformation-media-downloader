# Bash Script Style Guide

This document defines the coding standards and patterns for Bash scripts in this project.

---

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

---

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

---

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

Older scripts may use:

```bash
bin_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
```

**Note**: This silences errors but is less clear. Prefer the standard pattern for new scripts.

---

## Quoting

### Always Quote Variables

```bash
# GOOD - Always quote variables
if [ -f "$file_path" ]; then
    rm "$file_path"
fi

# BAD - Unquoted variables can break with spaces
if [ -f $file_path ]; then
    rm $file_path
fi
```

### Path Construction

```bash
# GOOD - Quote entire path expression
terraform_files_list="${bin_dir}/../terraform/*.tf"
types_file_path="${bin_dir}/../src/types/terraform.d.ts"

# GOOD - Constructing paths with variables
cp "$fixture_file" "$example_file"
```

---

## Command Execution

### Direct Execution (Preferred)

```bash
# GOOD - Direct command execution
hcl2json < "$terraform_hcl_file_path" > "$terraform_json_file_path"
cp "$source_file" "$dest_file"
mkdir -p "$directory"
```

### Command Substitution

Use `$()` instead of backticks:

```bash
# GOOD - Modern syntax
domain=$(tofu output cloudfront_distribution_domain | tr -d '"')
cookie_count=$(wc -l < "${file}" | tr -d ' ')

# BAD - Old syntax, harder to nest
domain=`tofu output cloudfront_distribution_domain | tr -d '"'`
```

### eval (Use Sparingly)

Only use `eval` when constructing complex commands with variables:

```bash
# Acceptable use case - complex command stored in variable
quicktype_command="${bin_dir}/../node_modules/quicktype/dist/index.js ${input} -o ${output}"
eval $quicktype_command
```

**Warning**: Be cautious with `eval` as it can execute arbitrary code. Only use with trusted inputs.

---

## Conditionals

### File Checks

```bash
# Check if file exists
if [ -f "$file_path" ]; then
    echo "File exists"
fi

# Check if file doesn't exist
if [ ! -f "$file_path" ]; then
    echo "File not found"
    exit 1
fi

# Check if directory exists
if [ -d "$directory" ]; then
    echo "Directory exists"
fi
```

### Command Availability

```bash
# Check if command exists
if ! command -v yt-dlp &> /dev/null; then
    echo "Error: yt-dlp is not installed"
    exit 1
fi

# Check multiple paths
if command -v /opt/homebrew/bin/yt-dlp &> /dev/null; then
    YTDLP_CMD="/opt/homebrew/bin/yt-dlp"
fi
```

### String Matching

Use `[[ ]]` for regex and pattern matching:

```bash
# Regex matching
if [[ "$filename" =~ ^apiRequest-(.*)\.json$ ]]; then
    method_and_type="${BASH_REMATCH[1]}"
fi

# String length
if [[ ${#git_diff_output} -gt 0 ]]; then
    echo "Changes detected"
fi
```

---

## User Output

### Color-Coded Messages

Define color constants at the top:

```bash
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Success!${NC} Operation completed"
echo -e "${RED}Error:${NC} Something went wrong"
echo -e "${YELLOW}Warning:${NC} Check configuration"
```

### Emoji for Visual Feedback

Use emoji to make output more readable:

```bash
echo "🔄 Syncing test fixtures..."
echo "✅ Examples synced successfully!"
echo "📝 Generating documentation..."
echo "⚠️  Warning: Cookies should be refreshed"
```

### Section Headers

Use clear section headers with separators:

```bash
echo -e "${GREEN}YouTube Cookie Extraction Script${NC}"
echo "=================================="
echo ""

echo -e "${YELLOW}Step 1: Creating directories${NC}"
# ... commands ...

echo -e "${YELLOW}Step 2: Extracting cookies${NC}"
# ... commands ...
```

### Progress and Summary

Always provide:
- Clear progress indicators
- Summary of actions taken
- Next steps if applicable

```bash
echo ""
echo "✅ Examples synced successfully!"
echo ""
echo "📍 Examples location: $EXAMPLES_DIR"
echo "📊 Files synced: $FILES_SYNCED"

echo ""
echo "Next steps:"
echo "  1. npm run build"
echo "  2. npm run deploy"
```

---

## Loops and Iteration

### For Loops with find

```bash
for fixture_file in $(find "$PROJECT_DIR/src/lambdas" -type f -name "*.json"); do
    filename=$(basename "$fixture_file")
    # Process file...
done
```

### Counters

```bash
FILES_SYNCED=0

for file in $files; do
    # Process file...
    FILES_SYNCED=$((FILES_SYNCED + 1))
done

echo "Files synced: $FILES_SYNCED"
```

---

## Working with External Commands

### OpenTofu Outputs

```bash
cd "${bin_dir}/../terraform"
domain=$(tofu output cloudfront_distribution_domain | tr -d '"')
api_key=$(tofu output api_gateway_api_key | tr -d '"')
```

### npm/Node.js Integration

```bash
PACKAGE_NAME=$(node -p "require('$PROJECT_DIR/package.json').name")
PACKAGE_VERSION=$(node -p "require('$PROJECT_DIR/package.json').version")
```

### curl with JSON

```bash
REQUEST_URL="https://${domain}/endpoint?ApiKey=${api_key}"
curl -v \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  --data @./fixtures/data.json \
  "$REQUEST_URL" | jq
```

---

## File Operations

### Creating Directories

Always use `-p` to create parent directories:

```bash
mkdir -p "$EXAMPLES_DIR"
mkdir -p "${SECURE_DIR}"
```

### Copying Files

```bash
cp "$source_file" "$dest_file"
```

### Removing Files

Check existence before removing:

```bash
if test -f "$types_file_path"; then
    rm "$types_file_path"
fi
```

### Reading Files

```bash
# Word count
line_count=$(wc -l < "$file" | tr -d ' ')
byte_count=$(wc -c < "$file" | tr -d ' ')

# Head/tail
head -3 "$file" > "$output"
```

### sed Operations

```bash
# In-place editing with backup
sed -i.bak "s/old_text/new_text/" "$file"
rm -f "$file.bak"

# Stream editing
echo "$lambda_name" | sed 's/\([A-Z]\)/-\L\1/g' | sed 's/^-//'
```

### grep Operations

```bash
# Append matching lines
grep -E '(pattern1|pattern2)' "$input" >> "$output"

# Count matches
endpoint_count=$(grep -c "operationId:" "$file")
```

---

## Platform Compatibility

### Opening Files in Browser

```bash
if command -v open &> /dev/null; then
    # macOS
    open "$file"
elif command -v xdg-open &> /dev/null; then
    # Linux
    xdg-open "$file"
elif command -v start &> /dev/null; then
    # Windows
    start "$file"
else
    echo "Could not automatically open browser"
fi
```

---

## Common Patterns

### Script Template

```bash
#!/usr/bin/env bash

# script-name.sh
# Description of what this script does
# Usage: npm run command

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Color constants
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Script Name${NC}"
echo "============"
echo ""

# Main logic here...

echo ""
echo -e "${GREEN}✅ Success!${NC}"
```

### Git Integration

```bash
# Check for uncommitted changes
git_diff_output=$(git diff "$file_path")
if [[ ${#git_diff_output} -gt 0 ]]; then
    echo "File has changes; commit before running"
    exit 1
fi

# Checkout files
git checkout "$file_path"
```

---

## Best Practices

### DO

- ✅ Always quote variable expansions: `"$var"`
- ✅ Use `set -e` for error handling
- ✅ Provide clear, color-coded user feedback
- ✅ Use meaningful variable names
- ✅ Check for required commands before using them
- ✅ Use `$()` for command substitution
- ✅ Make scripts executable: `chmod +x script.sh`

### DON'T

- ❌ Use unquoted variables
- ❌ Use backticks for command substitution
- ❌ Ignore error conditions
- ❌ Use cryptic variable names
- ❌ Assume commands are available without checking
- ❌ Use `eval` with untrusted input
- ❌ Forget to document complex operations
- ❌ Add comments explaining removed code or deprecated features (use git history instead)

---

## Debugging

### Enable Debug Mode

```bash
# Add to script for debugging
set -x  # Print commands as they execute
```

### Temporary Debugging

```bash
# Debug specific sections
set -x
complex_command_here
set +x
```

---

## Script Organization in Project

All scripts should be placed in the `bin/` directory and referenced via npm scripts:

```json
{
  "scripts": {
    "build-dependencies": "./bin/build-dependencies.sh",
    "document-source": "./bin/document-source.sh",
    "update-cookies": "./bin/update-youtube-cookies.sh"
  }
}
```

This ensures:
- Consistent invocation across different environments
- Easy discovery via `npm run`
- Cross-platform compatibility
