# Resource Naming

## Quick Reference
- **When to use**: All AWS resources defined in OpenTofu
- **Enforcement**: Required - consistency across infrastructure
- **Impact if violated**: MEDIUM - Confusion, inconsistent naming patterns

## Overview

Use PascalCase for AWS resource names in OpenTofu to match AWS naming conventions and maintain consistency between Terraform identifiers and actual AWS resource names.

## The Rules

### 1. Use PascalCase for Resource Names

AWS resource names use PascalCase (also called UpperCamelCase).

### 2. Match Terraform Identifier to AWS Name

The Terraform resource identifier should match the AWS resource name.

### 3. Use Descriptive, Specific Names

Names should clearly indicate the resource's purpose.

### 4. Include Resource Type in Related Resources

Role names include "Role", policy names include "Policy", etc.

## Examples

### ✅ Correct - PascalCase for Resources

```hcl
# Lambda function
resource "aws_lambda_function" "ProcessFile" {
  function_name = "ProcessFile"
  role         = aws_iam_role.ProcessFileRole.arn
  handler      = "index.handler"
  runtime      = "nodejs22.x"
}

# IAM role
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

# DynamoDB table
resource "aws_dynamodb_table" "MediaDownloader" {
  name         = "MediaDownloader"
  billing_mode = "PAY_PER_REQUEST"
  
  hash_key  = "pk"
  range_key = "sk"
  
  attribute {
    name = "pk"
    type = "S"
  }
  
  attribute {
    name = "sk"
    type = "S"
  }
}

# S3 bucket
resource "aws_s3_bucket" "MediaFiles" {
  bucket = "my-media-files-${var.aws_account_id}"
}
```

### ✅ Correct - Matching Identifiers

```hcl
# ✅ Terraform identifier matches AWS resource name
resource "aws_lambda_function" "DownloadVideo" {
  function_name = "DownloadVideo"  # Same name
}

# Reference uses same identifier
resource "aws_iam_role_policy_attachment" "download_policy" {
  role       = aws_iam_role.DownloadVideoRole.name
  policy_arn = aws_iam_policy.DownloadVideoPolicy.arn
}
```

### ✅ Correct - Related Resource Naming

```hcl
# Lambda function
resource "aws_lambda_function" "WebhookFeedly" {
  function_name = "WebhookFeedly"
}

# Related role (adds "Role" suffix)
resource "aws_iam_role" "WebhookFeedlyRole" {
  name = "WebhookFeedlyRole"
}

# Related policy (adds "Policy" suffix)
resource "aws_iam_policy" "WebhookFeedlyPolicy" {
  name = "WebhookFeedlyPolicy"
}

# Log group (follows AWS naming pattern)
resource "aws_cloudwatch_log_group" "webhook_feedly_logs" {
  name = "/aws/lambda/WebhookFeedly"
}
```

### ❌ Incorrect - snake_case Names

```hcl
# ❌ WRONG - snake_case doesn't match AWS conventions
resource "aws_lambda_function" "process_file" {
  function_name = "process_file"
}

# ❌ WRONG - Mixed case
resource "aws_lambda_function" "processFile" {
  function_name = "processFile"  # camelCase doesn't match AWS
}

# ✅ CORRECT - PascalCase
resource "aws_lambda_function" "ProcessFile" {
  function_name = "ProcessFile"
}
```

### ❌ Incorrect - Mismatched Names

```hcl
# ❌ WRONG - Terraform identifier doesn't match AWS name
resource "aws_lambda_function" "file_processor" {
  function_name = "ProcessFile"
}

# Confusing when referencing:
# aws_lambda_function.file_processor.function_name = "ProcessFile"

# ✅ CORRECT - Matching names
resource "aws_lambda_function" "ProcessFile" {
  function_name = "ProcessFile"
}
```

### ❌ Incorrect - Generic Names

```hcl
# ❌ WRONG - Too generic
resource "aws_lambda_function" "Lambda1" {
  function_name = "Lambda1"
}

resource "aws_iam_role" "Role1" {
  name = "Role1"
}

# ✅ CORRECT - Descriptive names
resource "aws_lambda_function" "ProcessFile" {
  function_name = "ProcessFile"
}

resource "aws_iam_role" "ProcessFileRole" {
  name = "ProcessFileRole"
}
```

## Naming Patterns

### Lambda Functions

```hcl
# Action-based names
resource "aws_lambda_function" "ProcessFile" {
  function_name = "ProcessFile"
}

resource "aws_lambda_function" "DownloadVideo" {
  function_name = "DownloadVideo"
}

resource "aws_lambda_function" "RegisterDevice" {
  function_name = "RegisterDevice"
}

# Webhook receivers
resource "aws_lambda_function" "WebhookFeedly" {
  function_name = "WebhookFeedly"
}
```

### IAM Roles and Policies

```hcl
# Role for Lambda function
resource "aws_iam_role" "ProcessFileRole" {
  name = "ProcessFileRole"
}

# Policy for specific permission
resource "aws_iam_policy" "S3MediaAccessPolicy" {
  name = "S3MediaAccessPolicy"
}

# Service-specific role
resource "aws_iam_role" "ApiGatewayRole" {
  name = "ApiGatewayRole"
}
```

### DynamoDB Tables

```hcl
# Table names describe content
resource "aws_dynamodb_table" "MediaDownloader" {
  name = "MediaDownloader"
}

resource "aws_dynamodb_table" "UserSessions" {
  name = "UserSessions"
}
```

### S3 Buckets

```hcl
# Buckets use descriptive names with account ID for uniqueness
resource "aws_s3_bucket" "MediaFiles" {
  bucket = "media-files-${var.aws_account_id}"
}

resource "aws_s3_bucket" "LambdaDeployments" {
  bucket = "lambda-deployments-${var.aws_account_id}"
}
```

### CloudWatch Resources

```hcl
# Log groups follow AWS naming pattern
resource "aws_cloudwatch_log_group" "process_file_logs" {
  name = "/aws/lambda/ProcessFile"
}

# Metric alarms use PascalCase
resource "aws_cloudwatch_metric_alarm" "ProcessFileErrors" {
  alarm_name = "ProcessFileErrors"
}

# Log metric filters use PascalCase
resource "aws_cloudwatch_log_metric_filter" "ErrorCount" {
  name = "ErrorCount"
}
```

### SNS Topics and SQS Queues

```hcl
# Topics use PascalCase
resource "aws_sns_topic" "FileProcessingNotifications" {
  name = "FileProcessingNotifications"
}

# Queues use PascalCase
resource "aws_sqs_queue" "VideoDownloadQueue" {
  name = "VideoDownloadQueue"
}

# DLQ naming pattern
resource "aws_sqs_queue" "VideoDownloadDeadLetterQueue" {
  name = "VideoDownloadDeadLetterQueue"
}
```

### API Gateway

```hcl
# API name
resource "aws_api_gateway_rest_api" "MediaDownloaderApi" {
  name = "MediaDownloaderApi"
}

# API resources use lowercase (path segments)
resource "aws_api_gateway_resource" "files" {
  rest_api_id = aws_api_gateway_rest_api.MediaDownloaderApi.id
  parent_id   = aws_api_gateway_rest_api.MediaDownloaderApi.root_resource_id
  path_part   = "files"
}

# Authorizer name
resource "aws_api_gateway_authorizer" "CustomAuthorizer" {
  name = "CustomAuthorizer"
}
```

## Multi-Word Names

```hcl
# ✅ CORRECT - PascalCase for multiple words
resource "aws_lambda_function" "StartFileUpload" {
  function_name = "StartFileUpload"
}

resource "aws_lambda_function" "CompleteFileUpload" {
  function_name = "CompleteFileUpload"
}

resource "aws_iam_role" "VideoProcessingRole" {
  name = "VideoProcessingRole"
}

# ❌ WRONG - Other cases
resource "aws_lambda_function" "start_file_upload" {
  function_name = "start_file_upload"  # snake_case
}

resource "aws_lambda_function" "startFileUpload" {
  function_name = "startFileUpload"  # camelCase
}
```

## Environment-Specific Names

```hcl
# Include environment in resource names for multi-environment setups
variable "environment" {
  type    = string
  default = "prod"
}

resource "aws_lambda_function" "ProcessFile" {
  function_name = "${var.environment}-ProcessFile"  # prod-ProcessFile
}

resource "aws_dynamodb_table" "MediaDownloader" {
  name = "${var.environment}-MediaDownloader"  # prod-MediaDownloader
}
```

## Rationale

### PascalCase Benefits

1. **AWS Convention** - Matches AWS console naming
2. **Consistency** - Same pattern everywhere
3. **Readability** - Clear word boundaries
4. **Professional** - Standard enterprise naming

### Matching Identifiers Benefits

1. **Clarity** - No confusion between identifier and name
2. **References** - Easy to understand references
3. **Maintenance** - Rename in one place
4. **Searchability** - Find all usages easily

### Descriptive Names Benefits

1. **Self-Documenting** - Purpose clear from name
2. **Navigation** - Easy to find in AWS console
3. **Debugging** - Know what resource does
4. **Collaboration** - Team understands resources

## Enforcement

### Code Review Checklist

- [ ] All resource names use PascalCase
- [ ] Terraform identifier matches AWS resource name
- [ ] Resource names are descriptive
- [ ] Related resources follow naming pattern (Role, Policy suffixes)
- [ ] No generic names (Lambda1, Role1, etc.)
- [ ] Multi-word names use PascalCase (not snake_case or camelCase)

### Validation Script

```bash
#!/usr/bin/env bash

# Check for snake_case Lambda function names
grep -rn 'resource "aws_lambda_function"' terraform/ | while read -r line; do
    if echo "$line" | grep -q '"[a-z_]*"'; then
        echo "Found snake_case Lambda: $line"
    fi
done

# Check for mismatched names
grep -A 2 'resource "aws_lambda_function"' terraform/*.tf | \
    grep -B 1 'function_name' | \
    grep -v '^--$'
```

## Common Mistakes

### Using Different Cases

```hcl
# ❌ WRONG - Different cases
resource "aws_lambda_function" "process_file" {
  function_name = "processFile"
}

# ✅ CORRECT - Same case
resource "aws_lambda_function" "ProcessFile" {
  function_name = "ProcessFile"
}
```

### Missing Type Suffixes

```hcl
# ❌ WRONG - Role without "Role" suffix
resource "aws_iam_role" "ProcessFile" {
  name = "ProcessFile"  # Ambiguous - same as function
}

# ✅ CORRECT - Clear role naming
resource "aws_iam_role" "ProcessFileRole" {
  name = "ProcessFileRole"
}
```

### Too Generic

```hcl
# ❌ WRONG - Generic
resource "aws_lambda_function" "Function" {
  function_name = "Function"
}

# ✅ CORRECT - Specific
resource "aws_lambda_function" "ProcessVideoFile" {
  function_name = "ProcessVideoFile"
}
```

## Related Patterns

- [File Organization](File-Organization.md) - How to organize resource files
- [OpenTofu Patterns](OpenTofu-Patterns.md) - Overall OpenTofu conventions
- [Naming Conventions](../Conventions/Naming-Conventions.md) - Cross-language naming

---

*Use PascalCase for all AWS resource names in OpenTofu. Match Terraform identifiers to AWS resource names for clarity and consistency.*
