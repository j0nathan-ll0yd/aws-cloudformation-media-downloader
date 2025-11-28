# Bash Error Handling

## Quick Reference
- **When to use**: All bash scripts
- **Enforcement**: Required
- **Impact if violated**: CRITICAL - Silent failures

## Standard Setup

```bash
#!/usr/bin/env bash
set -euo pipefail

# Error handler
error() {
  echo "❌ Error: $1" >&2
  exit "${2:-1}"
}

# Cleanup trap
cleanup() {
  rm -f "$temp_file"
}
trap cleanup EXIT ERR
```

## Error Handling Patterns

### Expected Failures
```bash
# Use || true for optional commands
rm file.txt 2>/dev/null || true

# Conditional handling
if ! command_that_might_fail; then
  echo "Failed, trying alternative"
  alternative_command || error "Both failed"
fi
```

### Validation
```bash
# Check variables
[[ -z "${VAR:-}" ]] && error "VAR is required"

# Check files
[[ -f "$file" ]] || error "File not found: $file"

# Check commands
command -v aws >/dev/null || error "AWS CLI not installed"
```

### AWS CLI Errors
```bash
# Capture and check
if output=$(aws lambda invoke --function test 2>&1); then
  echo "✅ Success"
else
  error "AWS failed: $output"
fi
```

## Best Practices

✅ Always use `set -euo pipefail`
✅ Provide context in errors
✅ Clean up with traps
✅ Use stderr for errors: `>&2`
✅ Check dependencies first

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Missing dependency |
| 3 | AWS operation failed |

## Related Patterns

- [Script Patterns](Script-Patterns.md)
- [Directory Resolution](Directory-Resolution.md)

---

*Use strict error handling. Fail fast with clear messages.*