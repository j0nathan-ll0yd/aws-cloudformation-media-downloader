# Infrastructure File Organization

## Quick Reference
- **When to use**: Organizing OpenTofu/Terraform files
- **Enforcement**: Required
- **Impact if violated**: MEDIUM - Difficult to navigate and maintain

## Directory Structure

```
terraform/
├── main.tf                    # Provider configuration
├── api_gateway.tf             # API Gateway resources
├── api_gateway_authorizer.tf  # Custom authorizer
├── configuration_apns.tf      # APNS configuration
├── file_bucket.tf             # S3 bucket resources
├── file_coordinator.tf        # File coordinator Lambda
├── list_files.tf              # List files Lambda
├── register_device.tf         # Register device Lambda
├── register_user.tf           # Register user Lambda
├── feedly_webhook.tf          # Feedly webhook Lambda
├── send_push_notification.tf  # Push notification Lambda
└── *.tf                       # Other function-specific files
```

## File Organization Rules

1. **One file per Lambda function** - Each Lambda gets its own snake_case file
2. **Include related resources** - Lambda file contains function, role, and policy
3. **Service-specific files** - Shared resources get descriptive snake_case names

## Service Files

```hcl
# file_bucket.tf - S3 bucket and related resources
resource "aws_s3_bucket" "media_files" { }
resource "aws_s3_bucket_versioning" "media_files_versioning" { }

# api_gateway.tf - API Gateway configuration
resource "aws_api_gateway_rest_api" "main" { }
resource "aws_api_gateway_deployment" "main" { }

# configuration_apns.tf - APNS platform configuration
resource "aws_sns_platform_application" "apns" { }
```

## Lambda Files

Each Lambda function gets its own snake_case file with all related resources:

```hcl
# list_files.tf

resource "aws_lambda_function" "ListFiles" {
  function_name = "ListFiles"
  role         = aws_iam_role.ListFilesRole.arn

  environment {
    variables = {
      DynamoDBTableName = aws_dynamodb_table.MediaDownloader.name
    }
  }
}

resource "aws_iam_role" "ListFilesRole" {
  name = "ListFilesRole"
  # Role configuration
}

resource "aws_iam_role_policy" "ListFilesPolicy" {
  name = "ListFilesPolicy"
  role = aws_iam_role.ListFilesRole.id
  # Policy configuration
}
```

## File Naming Convention

- **Lambda files**: snake_case function name
  - `list_files.tf`
  - `register_device.tf`
  - `file_coordinator.tf`
  - `feedly_webhook.tf`

- **Service/Shared files**: snake_case descriptive name
  - `api_gateway.tf`
  - `file_bucket.tf`
  - `configuration_apns.tf`

- **Core files**: lowercase
  - `main.tf`

## Related Patterns

- [Resource Naming](Resource-Naming.md) - Resource naming conventions
- [Environment Variables](Environment-Variables.md) - Lambda configuration

---

*Use snake_case for all terraform files. Each Lambda gets its own file with related IAM resources.*