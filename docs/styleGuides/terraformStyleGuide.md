# Terraform Style Guide

This document defines the coding standards and patterns for Terraform infrastructure code in this project.

---

## File Organization

### Resource Grouping

Group related resources in dedicated files:
- `feedly_webhook.tf` - Feedly webhook Lambda and API Gateway integration
- `api_gateway.tf` - API Gateway configuration
- `s3.tf` - S3 buckets and policies
- `dynamodb.tf` - DynamoDB tables

### Resource Naming

Use PascalCase for resource names to match AWS conventions:

```hcl
resource "aws_lambda_function" "WebhookFeedly" {
  function_name = "WebhookFeedly"
  # ...
}

resource "aws_iam_role" "WebhookFeedlyRole" {
  name = "WebhookFeedlyRole"
  # ...
}
```

---

## Comments

### Inline Comments

Use comments to explain WHY, not WHAT:

```hcl
# GOOD - explains business reason
# Retain logs for 14 days to balance cost and debugging needs
retention_in_days = 14

# BAD - states the obvious
# Set retention to 14 days
retention_in_days = 14
```

### Prohibited Comments

**NEVER include comments explaining removed resources or deprecated infrastructure:**

```hcl
# BAD - explaining what was removed
# Multipart upload Step Function removed - now using direct streaming to S3
# Previous architecture: StartFileUpload -> UploadPart (loop) -> CompleteFileUpload
# New architecture: StartFileUpload (streams directly to S3 via yt-dlp)

# BAD - referencing deleted documentation
# See Phase 3a implementation in docs/DELETED-FILE.md

# GOOD - no comments needed, use git history
# (Just define current infrastructure)
```

**Why**: Git history (`git log`, `git show`) is the authoritative source for understanding infrastructure changes.

---

## Environment Variables

### Lambda Environment Variables

Always use CamelCase for environment variable names to match TypeScript ProcessEnv interface:

```hcl
environment {
  variables = {
    DynamoDBTableFiles  = aws_dynamodb_table.Files.name
    YtdlpBinaryPath     = "/opt/bin/yt-dlp_linux"
    GithubPersonalToken = data.sops_file.secrets.data["github.issue.token"]
  }
}
```

Match these exactly to `src/types/global.d.ts`:

```typescript
interface ProcessEnv {
  DynamoDBTableFiles: string
  YtdlpBinaryPath: string
  GithubPersonalToken: string
}
```

---

## Best Practices

### DO

- ✅ Group related resources in logical files
- ✅ Use descriptive resource names in PascalCase
- ✅ Reference other resources using interpolation
- ✅ Use data sources for existing resources
- ✅ Keep environment variable names consistent with TypeScript
- ✅ Use `depends_on` for explicit ordering when needed

### DON'T

- ❌ Hardcode values that can be referenced
- ❌ Create circular dependencies
- ❌ Use deprecated resource types
- ❌ Explain removed resources in comments (use git history)
- ❌ Reference non-existent documentation files

---

## Documentation

Infrastructure documentation belongs in:
- **README.md** - High-level architecture overview
- **CLAUDE.md** - Project context and patterns
- **Git history** - Historical changes and reasoning
- **NOT in comments** - Don't duplicate what git already tracks
