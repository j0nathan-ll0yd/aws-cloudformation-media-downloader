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

```hcl
resource "aws_iam_role" "FunctionNameRole" {
  name = "FunctionNameRole"

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

resource "aws_iam_policy" "FunctionNamePolicy" {
  name = "FunctionNamePolicy"

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

resource "aws_iam_role_policy_attachment" "FunctionNamePolicyAttachment" {
  role       = aws_iam_role.FunctionNameRole.name
  policy_arn = aws_iam_policy.FunctionNamePolicy.arn
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
