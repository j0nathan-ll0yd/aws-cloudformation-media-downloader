# OpenTofu Infrastructure Patterns

This document defines the coding standards and patterns for OpenTofu infrastructure code in this project.

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
# ❌ BAD - explaining what was removed
# Multipart upload Step Function removed - now using direct streaming to S3
# Previous architecture: StartFileUpload -> UploadPart (loop) -> CompleteFileUpload
# New architecture: StartFileUpload (streams directly to S3 via yt-dlp)

# ❌ BAD - referencing deleted documentation
# See Phase 3a implementation in docs/DELETED-FILE.md

# ✅ GOOD - no comments needed, use git history
# (Just define current infrastructure)
```

**Why**: Git history (`git log`, `git show`) is the authoritative source for understanding infrastructure changes.

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

## Lambda Function Pattern

### Standard Lambda Definition

```hcl
resource "aws_lambda_function" "FunctionName" {
  function_name = "FunctionName"
  role         = aws_iam_role.FunctionNameRole.arn
  handler      = "index.handler"
  runtime      = "nodejs22.x"
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
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = aws_dynamodb_table.Files.arn
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = "${aws_s3_bucket.MediaFiles.arn}/*"
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

  attribute {
    name = "gsi1pk"
    type = "S"
  }

  attribute {
    name = "gsi1sk"
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

resource "aws_s3_bucket_public_access_block" "MediaFilesPublicAccessBlock" {
  bucket = aws_s3_bucket.MediaFiles.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
```

## API Gateway

### REST API with Custom Authorizer

```hcl
resource "aws_api_gateway_rest_api" "MediaDownloaderAPI" {
  name        = "MediaDownloaderAPI"
  description = "API for media downloader service"
}

resource "aws_api_gateway_authorizer" "QueryAuthorizer" {
  name                   = "QueryAuthorizer"
  rest_api_id           = aws_api_gateway_rest_api.MediaDownloaderAPI.id
  authorizer_uri        = aws_lambda_function.ApiGatewayAuthorizer.invoke_arn
  type                  = "REQUEST"
  identity_source       = "method.request.querystring.apiKey"
  authorizer_result_ttl_in_seconds = 300
}

resource "aws_api_gateway_method" "GetFiles" {
  rest_api_id   = aws_api_gateway_rest_api.MediaDownloaderAPI.id
  resource_id   = aws_api_gateway_resource.Files.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = aws_api_gateway_authorizer.QueryAuthorizer.id
}
```

## Outputs

### Export Important Values

```hcl
output "api_gateway_url" {
  value       = aws_api_gateway_deployment.MediaDownloaderDeployment.invoke_url
  description = "API Gateway base URL"
}

output "s3_bucket_name" {
  value       = aws_s3_bucket.MediaFiles.bucket
  description = "S3 bucket for media files"
}

output "dynamodb_table_name" {
  value       = aws_dynamodb_table.MediaDownloader.name
  description = "DynamoDB table name"
}
```

## Best Practices

### DO

- ✅ Group related resources in logical files
- ✅ Use descriptive resource names in PascalCase
- ✅ Reference other resources using interpolation
- ✅ Use data sources for existing resources
- ✅ Keep environment variable names consistent with TypeScript
- ✅ Use `depends_on` for explicit ordering when needed
- ✅ Use PAY_PER_REQUEST billing for DynamoDB in serverless architectures
- ✅ Enable versioning and encryption on S3 buckets
- ✅ Set CloudWatch log retention to control costs

### DON'T

- ❌ Hardcode values that can be referenced
- ❌ Create circular dependencies
- ❌ Use deprecated resource types
- ❌ Explain removed resources in comments (use git history)
- ❌ Reference non-existent documentation files
- ❌ Use provisioned capacity for DynamoDB in serverless (use PAY_PER_REQUEST)
- ❌ Leave S3 buckets publicly accessible
- ❌ Keep CloudWatch logs forever (set retention)

## Common Patterns

### Data Archive for Lambda

```hcl
data "archive_file" "FunctionName" {
  type        = "zip"
  source_file = "${path.module}/../build/lambdas/FunctionName/index.js"
  output_path = "${path.module}/../build/lambdas/FunctionName.zip"
}
```

### Account ID Reference

```hcl
data "aws_caller_identity" "current" {}

# Use in resource names
bucket = "my-bucket-${data.aws_caller_identity.current.account_id}"
```

### Secrets Management with SOPS

```hcl
data "sops_file" "secrets" {
  source_file = "../secrets.enc.yaml"
}

# Access secrets in resources
environment {
  variables = {
    ApiKey = data.sops_file.secrets.data["api.key"]
  }
}
```

## Documentation

Infrastructure documentation belongs in:
- **README.md** - High-level architecture overview
- **AGENTS.md** - Project context and patterns
- **Git history** - Historical changes and reasoning
- **NOT in comments** - Don't duplicate what git already tracks