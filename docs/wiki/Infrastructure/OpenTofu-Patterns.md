# OpenTofu Infrastructure Patterns

## Quick Reference
- **When to use**: Writing OpenTofu/Terraform infrastructure code
- **Enforcement**: Required - consistent infrastructure patterns
- **Impact if violated**: MEDIUM - Inconsistent infrastructure, maintainability issues

## File Organization

### Resource Grouping

Group related resources in dedicated files:
- `feedly_webhook.tf` - Feedly webhook Lambda and API Gateway
- `api_gateway.tf` - API Gateway configuration
- `s3.tf` - S3 buckets and policies
- `dynamodb.tf` - DynamoDB tables

### Resource Naming

Use PascalCase for resource names to match AWS conventions.

**IAM roles use the same name as Lambda functions** - Terraform differentiates by resource type, so no suffix needed. This applies to both:
- The Terraform resource identifier (e.g., `aws_iam_role.WebhookFeedly`)
- The AWS resource name (e.g., `name = local.webhook_feedly_function_name`)

```hcl
locals {
  webhook_feedly_function_name = "WebhookFeedly"
}

resource "aws_lambda_function" "WebhookFeedly" {
  function_name = local.webhook_feedly_function_name
  # ...
}

resource "aws_iam_role" "WebhookFeedly" {  # No "Role" suffix in identifier
  name = local.webhook_feedly_function_name  # Same as Lambda, no "Role" suffix
  # ...
}
```

### Using Locals for DRY Naming

Define function names in locals to ensure consistency across Lambda, IAM role, OTEL service name, and other resources:

```hcl
locals {
  webhook_feedly_function_name = "WebhookFeedly"
}

resource "aws_lambda_function" "WebhookFeedly" {
  function_name = local.webhook_feedly_function_name
  role          = aws_iam_role.WebhookFeedly.arn

  environment {
    variables = merge(local.common_lambda_env, {
      OTEL_SERVICE_NAME = local.webhook_feedly_function_name
    })
  }
}

resource "aws_iam_role" "WebhookFeedly" {
  name = local.webhook_feedly_function_name
  # ...
}
```

This pattern ensures:
- Lambda `function_name` matches IAM role `name`
- `OTEL_SERVICE_NAME` matches for distributed tracing correlation
- Single source of truth for the function name

## Comments

### Explain WHY, Not WHAT

```hcl
# GOOD - explains business reason
# Retain logs for 14 days to balance cost and debugging needs
retention_in_days = 14

# BAD - states the obvious
# Set retention to 14 days
retention_in_days = 14
```

### Prohibited Comments

**NEVER include comments explaining removed resources or deprecated infrastructure**:

```hcl
# ❌ BAD - explaining what was removed
# Multipart upload Step Function removed - now using direct streaming

# ✅ GOOD - no comments needed, use git history
# (Just define current infrastructure)
```

## Environment Variables

### Lambda Environment Variables

Always use CamelCase to match TypeScript ProcessEnv interface:

```hcl
environment {
  variables = {
    DynamoDBTableFiles  = aws_dynamodb_table.Files.name
    YtdlpBinaryPath     = "/opt/bin/yt-dlp_linux"
    GithubPersonalToken = data.sops_file.secrets.data["github.issue.token"]
  }
}
```

Match exactly to `src/types/global.d.ts`:

```typescript
interface ProcessEnv {
  DynamoDBTableFiles: string
  YtdlpBinaryPath: string
  GithubPersonalToken: string
}
```

## Centralized Lambda Environment Configuration

### The Pattern

All Lambda functions MUST use `merge(local.common_lambda_env, {...})` for environment variables:

```hcl
locals {
  common_lambda_env = {
    OTEL_LOG_LEVEL       = "warn"           # Reduce OTEL noise (was ~90% of logs)
    NODE_OPTIONS         = "--no-deprecation" # Suppress deprecation warnings
    OTEL_PROPAGATORS     = "xray"            # Use X-Ray propagation format
    LOG_LEVEL            = "DEBUG"           # Application log level
  }
}

resource "aws_lambda_function" "MyLambda" {
  # ...
  environment {
    variables = merge(local.common_lambda_env, {
      OTEL_SERVICE_NAME = local.my_lambda_function_name
      DynamoDBTableName = aws_dynamodb_table.main.name
      # Function-specific variables...
    })
  }
}
```

### Why This Matters

1. **DRY Principle**: Common settings defined once, applied everywhere
2. **Consistent Observability**: All Lambdas have the same OTEL configuration
3. **Log Noise Reduction**: Achieved ~90% reduction in log noise
4. **Easy Updates**: Change one local, all Lambdas updated

### Common Variables Explained

| Variable | Value | Purpose |
|----------|-------|---------|
| `OTEL_LOG_LEVEL` | `warn` | Reduces verbose OTEL debug logs |
| `NODE_OPTIONS` | `--no-deprecation` | Suppresses Node.js deprecation warnings |
| `OTEL_PROPAGATORS` | `xray` | Enables X-Ray trace context propagation |
| `LOG_LEVEL` | `DEBUG` | Application-level logging (Powertools) |

### Adding New Common Variables

When a variable should apply to all Lambdas:

1. Add to `local.common_lambda_env` in `locals.tf`
2. Verify no Lambda overrides it unexpectedly
3. Deploy and verify in CloudWatch logs

## Lambda Function Pattern

### Standard Lambda Definition

```hcl
resource "aws_lambda_function" "FunctionName" {
  function_name = "FunctionName"
  role         = aws_iam_role.FunctionNameRole.arn
  handler      = "FunctionName.handler"
  runtime      = "nodejs24.x"
  timeout      = 300
  memory_size  = 512

  filename         = data.archive_file.FunctionName.output_path
  source_code_hash = data.archive_file.FunctionName.output_base64sha256

  environment {
    variables = {
      DynamoDBTableFiles = aws_dynamodb_table.Files.name
      S3BucketName      = aws_s3_bucket.MediaFiles.bucket
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.FunctionNamePolicyAttachment,
    aws_cloudwatch_log_group.FunctionNameLogGroup
  ]
}
```

**Note**: Lambda functions are bundled as ESM (.mjs) with Node.js 24 runtime. The handler format remains `FunctionName.handler` - AWS Lambda automatically detects .mjs files.

### IAM Role Pattern

IAM roles use the same identifier and name as the Lambda function (via locals):

```hcl
locals {
  function_name = "FunctionName"
}

resource "aws_iam_role" "FunctionName" {  # No "Role" suffix
  name = local.function_name  # Same as Lambda

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_policy" "FunctionName" {  # No "RolePolicy" suffix
  name = "FunctionName"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["dynamodb:GetItem", "dynamodb:PutItem"]
        Resource = aws_dynamodb_table.Files.arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "FunctionName" {  # No "Policy" suffix
  role       = aws_iam_role.FunctionName.name
  policy_arn = aws_iam_policy.FunctionName.arn
}

resource "aws_iam_role_policy_attachment" "FunctionNameLogging" {  # Just "Logging", not "PolicyLogging"
  role       = aws_iam_role.FunctionName.name
  policy_arn = aws_iam_policy.CommonLambdaLogging.arn
}

resource "aws_iam_role_policy_attachment" "FunctionNameXRay" {  # Just "XRay", not "PolicyXRay"
  role       = aws_iam_role.FunctionName.name
  policy_arn = aws_iam_policy.CommonLambdaXRay.arn
}
```

### CloudWatch Logs

```hcl
resource "aws_cloudwatch_log_group" "FunctionNameLogGroup" {
  name              = "/aws/lambda/FunctionName"
  retention_in_days = 14
}
```

## DynamoDB Tables

### ElectroDB Single-Table Design

```hcl
resource "aws_dynamodb_table" "MediaDownloader" {
  name           = "MediaDownloader"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "pk"
  range_key      = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  global_secondary_index {
    name            = "gsi1"
    hash_key        = "gsi1pk"
    range_key       = "gsi1sk"
    projection_type = "ALL"
  }
}
```

## S3 Buckets

### Media Storage Bucket

```hcl
resource "aws_s3_bucket" "MediaFiles" {
  bucket = "media-downloader-files-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_versioning" "MediaFilesVersioning" {
  bucket = aws_s3_bucket.MediaFiles.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "MediaFilesEncryption" {
  bucket = aws_s3_bucket.MediaFiles.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}
```

## Best Practices

### DO

- ✅ Group related resources in logical files
- ✅ Use PascalCase for resource names
- ✅ Reference resources using interpolation
- ✅ Keep environment variable names consistent with TypeScript
- ✅ Use PAY_PER_REQUEST for DynamoDB in serverless
- ✅ Enable versioning and encryption on S3 buckets
- ✅ Set CloudWatch log retention

### DON'T

- ❌ Hardcode values that can be referenced
- ❌ Explain removed resources in comments (use git history)
- ❌ Use provisioned capacity for DynamoDB in serverless
- ❌ Leave S3 buckets publicly accessible
- ❌ Keep CloudWatch logs forever

## Related Patterns

- [Naming Conventions](../Conventions/Naming-Conventions.md) - PascalCase for resources
- [Code Comments](../Conventions/Code-Comments.md) - Git as source of truth

---

*Infrastructure documentation belongs in README.md, AGENTS.md, and Git history - not in comments.*
