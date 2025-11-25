# Infrastructure File Organization

## Quick Reference
- **When to use**: Organizing OpenTofu/Terraform files
- **Enforcement**: Required
- **Impact if violated**: MEDIUM - Difficult to navigate and maintain

## Directory Structure

```
terraform/
├── main.tf                    # Provider configuration
├── variables.tf               # Input variables
├── outputs.tf                 # Output values
├── versions.tf                # Version constraints
├── ApiGateway.tf             # API Gateway resources
├── CloudWatch.tf             # Monitoring and logging
├── DynamoDB.tf               # Database tables
├── IAM.tf                    # IAM roles and policies
├── Lambda*.tf                # Lambda functions
├── S3.tf                     # S3 buckets
├── SNS.tf                    # SNS topics
└── SQS.tf                    # SQS queues
```

## File Organization Rules

1. **Group by AWS service** - All resources for a service in one file
2. **Separate Lambda files** - Each Lambda gets `Lambda[FunctionName].tf`
3. **Include related resources** - Lambda file contains function, role, and policy

## Service Files

```hcl
# DynamoDB.tf - All DynamoDB resources
resource "aws_dynamodb_table" "main" { }

# S3.tf - All S3 resources
resource "aws_s3_bucket" "media_files" { }
resource "aws_s3_bucket_versioning" "media_files_versioning" { }

# SNS.tf - All SNS resources
resource "aws_sns_topic" "push_notifications" { }
resource "aws_sns_platform_application" "apns" { }
```

## Lambda Files

Each Lambda function gets its own file with all related resources:

```hcl
# LambdaProcessFile.tf

resource "aws_lambda_function" "ProcessFile" {
  function_name = "ProcessFile"
  role         = aws_iam_role.ProcessFileRole.arn

  environment {
    variables = {
      DynamoDBTableName = aws_dynamodb_table.main.name
      BucketName       = aws_s3_bucket.media_files.id
    }
  }
}

resource "aws_iam_role" "ProcessFileRole" {
  name = "ProcessFileRole"
  # Role configuration
}

resource "aws_iam_role_policy" "ProcessFilePolicy" {
  name = "ProcessFilePolicy"
  role = aws_iam_role.ProcessFileRole.id
  # Policy configuration
}
```

## File Naming Convention

- **Lambda files**: `Lambda[FunctionName].tf`
  - `LambdaListFiles.tf`
  - `LambdaProcessFile.tf`
  - `LambdaRegisterDevice.tf`

- **Service files**: PascalCase service name
  - `ApiGateway.tf`
  - `DynamoDB.tf`
  - `CloudWatch.tf`

- **Core files**: Lowercase
  - `main.tf`
  - `variables.tf`
  - `outputs.tf`

## Related Patterns

- [Resource Naming](Resource-Naming.md) - Resource naming conventions
- [Environment Variables](Environment-Variables.md) - Lambda configuration

---

*Organize infrastructure by AWS service. Each Lambda gets its own file with related IAM resources.*