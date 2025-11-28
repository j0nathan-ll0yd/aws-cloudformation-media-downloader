# Resource Naming

## Quick Reference
- **When to use**: All AWS resources in OpenTofu
- **Enforcement**: Required
- **Impact if violated**: MEDIUM - Inconsistent naming

## Naming Rules

1. **PascalCase for AWS resources**
2. **Match Terraform ID to AWS name**
3. **Include resource type suffix** (Role, Policy, Queue)
4. **Be descriptive and specific**

## Resource Patterns

### Lambda Functions
```hcl
resource "aws_lambda_function" "ProcessFile" {
  function_name = "ProcessFile"
}

resource "aws_lambda_function" "ListFiles" {
  function_name = "ListFiles"
}
```

### IAM Resources
```hcl
resource "aws_iam_role" "ProcessFileRole" {
  name = "ProcessFileRole"
}

resource "aws_iam_role_policy" "ProcessFilePolicy" {
  name = "ProcessFilePolicy"
  role = aws_iam_role.ProcessFileRole.id
}
```

### DynamoDB Tables
```hcl
resource "aws_dynamodb_table" "MediaDownloader" {
  name = "MediaDownloader"
}
```

### S3 Buckets
```hcl
resource "aws_s3_bucket" "MediaFiles" {
  bucket = "media-files-${var.aws_account_id}"
}
```

### SNS/SQS
```hcl
resource "aws_sns_topic" "PushNotifications" {
  name = "PushNotifications"
}

resource "aws_sqs_queue" "FeedlyQueue" {
  name = "FeedlyQueue"
}
```

## Naming Convention Table

| Resource Type | Pattern | Example |
|--------------|---------|---------|
| Lambda | `[Action][Object]` | `ProcessFile` |
| IAM Role | `[Function]Role` | `ProcessFileRole` |
| IAM Policy | `[Function]Policy` | `ProcessFilePolicy` |
| DynamoDB | `[ProjectName]` | `MediaDownloader` |
| S3 Bucket | `[purpose]-${account}` | `media-files-123456` |
| SNS Topic | `[Purpose]` | `PushNotifications` |
| SQS Queue | `[Source]Queue` | `FeedlyQueue` |

## Common Mistakes

```hcl
# ❌ Wrong - snake_case
resource "aws_lambda_function" "process_file" {
  function_name = "process_file"
}

# ✅ Correct - PascalCase
resource "aws_lambda_function" "ProcessFile" {
  function_name = "ProcessFile"
}
```

## Best Practices

✅ Use PascalCase consistently
✅ Match Terraform ID to resource name
✅ Include type suffix (Role, Policy, Queue)
✅ Be specific about purpose
✅ Avoid generic names

## Related Patterns

- [File Organization](File-Organization.md)
- [Environment Variables](Environment-Variables.md)
- [OpenTofu Patterns](OpenTofu-Patterns.md)

---

*Use PascalCase for all AWS resources. Match Terraform identifiers to AWS names.*