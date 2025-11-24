# File Organization

## Quick Reference
- **When to use**: Organizing OpenTofu infrastructure code
- **Enforcement**: Required - maintain clear structure
- **Impact if violated**: MEDIUM - Difficult to find resources, merge conflicts

## Overview

Group related AWS resources in dedicated files by service or feature. This makes infrastructure code easy to navigate, reduces merge conflicts, and clearly shows what resources belong together.

## The Rules

### 1. Group by Service or Feature

Resources that work together should be in the same file.

### 2. One File Per Major AWS Service

S3 resources in `s3.tf`, Lambda in `Lambda*.tf`, etc.

### 3. Separate Files for Each Lambda Function

Each Lambda gets its own file: `LambdaProcessFile.tf`.

### 4. Use Descriptive File Names

File names should indicate the contents.

## Examples

### ✅ Correct - Service-Based Organization

```
terraform/
├── api_gateway.tf           # API Gateway resources
├── cloudwatch.tf            # CloudWatch log groups, alarms
├── dynamodb.tf              # DynamoDB tables and indexes
├── iam.tf                   # Cross-cutting IAM resources
├── s3.tf                    # S3 buckets and policies
├── sns.tf                   # SNS topics and subscriptions
├── LambdaProcessFile.tf     # ProcessFile Lambda + role + policy
├── LambdaDownloadVideo.tf   # DownloadVideo Lambda + role + policy
├── LambdaWebhookFeedly.tf   # WebhookFeedly Lambda + role + policy
├── variables.tf             # Input variables
├── outputs.tf               # Output values
└── terraform.tf             # Provider configuration
```

### ✅ Correct - Lambda File Structure

```hcl
# terraform/LambdaProcessFile.tf

# Lambda function
resource "aws_lambda_function" "ProcessFile" {
  function_name = "ProcessFile"
  role         = aws_iam_role.ProcessFileRole.arn
  handler      = "index.handler"
  runtime      = "nodejs22.x"
  
  environment {
    variables = {
      TABLE_NAME  = aws_dynamodb_table.MediaDownloader.name
      BUCKET_NAME = aws_s3_bucket.MediaFiles.id
    }
  }
}

# IAM role for this Lambda
resource "aws_iam_role" "ProcessFileRole" {
  name = "ProcessFileRole"
  
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

# IAM policy for this Lambda
resource "aws_iam_role_policy" "ProcessFilePolicy" {
  name = "ProcessFilePolicy"
  role = aws_iam_role.ProcessFileRole.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem"
        ]
        Resource = aws_dynamodb_table.MediaDownloader.arn
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

# CloudWatch log group
resource "aws_cloudwatch_log_group" "process_file_logs" {
  name              = "/aws/lambda/${aws_lambda_function.ProcessFile.function_name}"
  retention_in_days = 14
}
```

### ✅ Correct - Service File Structure

```hcl
# terraform/s3.tf

# Media files bucket
resource "aws_s3_bucket" "MediaFiles" {
  bucket = "media-files-${var.aws_account_id}"
}

# Versioning
resource "aws_s3_bucket_versioning" "media_files_versioning" {
  bucket = aws_s3_bucket.MediaFiles.id
  
  versioning_configuration {
    status = "Enabled"
  }
}

# Lifecycle rules
resource "aws_s3_bucket_lifecycle_configuration" "media_files_lifecycle" {
  bucket = aws_s3_bucket.MediaFiles.id
  
  rule {
    id     = "delete-old-versions"
    status = "Enabled"
    
    noncurrent_version_expiration {
      days = 30
    }
  }
}

# Transfer acceleration
resource "aws_s3_bucket_accelerate_configuration" "media_files_accelerate" {
  bucket = aws_s3_bucket.MediaFiles.id
  status = "Enabled"
}

# Bucket policy
resource "aws_s3_bucket_policy" "media_files_policy" {
  bucket = aws_s3_bucket.MediaFiles.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowLambdaAccess"
        Effect = "Allow"
        Principal = {
          AWS = [
            aws_iam_role.ProcessFileRole.arn,
            aws_iam_role.DownloadVideoRole.arn
          ]
        }
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = "${aws_s3_bucket.MediaFiles.arn}/*"
      }
    ]
  })
}
```

### ❌ Incorrect - Everything in One File

```hcl
# ❌ WRONG - terraform/main.tf with 2000+ lines

resource "aws_lambda_function" "ProcessFile" {}
resource "aws_iam_role" "ProcessFileRole" {}
resource "aws_lambda_function" "DownloadVideo" {}
resource "aws_iam_role" "DownloadVideoRole" {}
resource "aws_s3_bucket" "MediaFiles" {}
resource "aws_dynamodb_table" "MediaDownloader" {}
resource "aws_api_gateway_rest_api" "api" {}
# ... hundreds more resources ...

# Problems:
# - Merge conflicts
# - Hard to find resources
# - Difficult to review changes
# - No clear organization
```

### ❌ Incorrect - Random Organization

```hcl
# ❌ WRONG - Mixing unrelated resources

# resources.tf
resource "aws_lambda_function" "ProcessFile" {}
resource "aws_s3_bucket" "MediaFiles" {}
resource "aws_lambda_function" "DownloadVideo" {}
resource "aws_dynamodb_table" "MediaDownloader" {}

# No clear pattern, hard to navigate
```

## File Naming Conventions

### Lambda Files

```
LambdaProcessFile.tf        # Lambda function with all related resources
LambdaDownloadVideo.tf
LambdaRegisterDevice.tf
LambdaWebhookFeedly.tf
```

### Service Files

```
api_gateway.tf              # snake_case for service files
cloudwatch.tf
dynamodb.tf
s3.tf
sns.tf
sqs.tf
```

### Special Files

```
terraform.tf                # Provider and backend configuration
variables.tf                # Input variables
outputs.tf                  # Output values
locals.tf                   # Local values
data.tf                     # Data sources
```

## Cross-Service Dependencies

When resources span multiple services, choose the primary service:

```hcl
# terraform/api_gateway.tf

# API Gateway resources
resource "aws_api_gateway_rest_api" "MediaDownloaderApi" {
  name = "MediaDownloaderApi"
}

# Lambda integration (API Gateway is primary service)
resource "aws_lambda_permission" "api_gateway_invoke" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ProcessFile.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.MediaDownloaderApi.execution_arn}/*/*"
}

# API Gateway methods
resource "aws_api_gateway_method" "files_post" {
  rest_api_id   = aws_api_gateway_rest_api.MediaDownloaderApi.id
  resource_id   = aws_api_gateway_resource.files.id
  http_method   = "POST"
  authorization = "NONE"
}

# API Gateway integration with Lambda
resource "aws_api_gateway_integration" "files_post_integration" {
  rest_api_id = aws_api_gateway_rest_api.MediaDownloaderApi.id
  resource_id = aws_api_gateway_resource.files.id
  http_method = aws_api_gateway_method.files_post.http_method
  
  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.ProcessFile.invoke_arn
}
```

## Module Organization

For larger projects, organize into modules:

```
terraform/
├── modules/
│   ├── lambda/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── api-gateway/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   └── s3-bucket/
│       ├── main.tf
│       ├── variables.tf
│       └── outputs.tf
├── environments/
│   ├── prod/
│   │   ├── main.tf
│   │   └── terraform.tfvars
│   └── staging/
│       ├── main.tf
│       └── terraform.tfvars
└── main.tf
```

## Related Patterns

- [Resource Naming](Resource-Naming.md) - How to name resources
- [OpenTofu Patterns](OpenTofu-Patterns.md) - Overall conventions
- [Environment Variables](Environment-Variables.md) - Lambda configuration

---

*Group related resources in service-specific files. Each Lambda function gets its own file with all related resources (role, policy, log group).*
