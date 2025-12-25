# Infrastructure Environment Variables

## Quick Reference
- **When to use**: OpenTofu/Terraform Lambda configuration
- **Enforcement**: Required
- **Impact if violated**: HIGH - Deployment failures

## OpenTofu Configuration

Define environment variables in Lambda resources using **SCREAMING_CASE**:

```hcl
resource "aws_lambda_function" "ProcessFile" {
  function_name = "ProcessFile"

  environment {
    variables = merge(local.common_lambda_env, {
      OTEL_SERVICE_NAME          = "ProcessFile"
      DYNAMODB_TABLE_NAME        = aws_dynamodb_table.main.name
      PLATFORM_APPLICATION_ARN   = aws_sns_platform_application.apns.arn
      PUSH_NOTIFICATION_TOPIC_ARN = aws_sns_topic.push_notifications.arn
      SNS_QUEUE_URL              = aws_sqs_queue.feedly.url
      ENABLE_XRAY                = var.enable_xray ? "true" : "false"
    })
  }
}
```

## Variable Sources

```hcl
# From AWS resources
DYNAMODB_TABLE_NAME = aws_dynamodb_table.main.name

# From Terraform variables
ENABLE_XRAY = var.enable_xray

# From data sources (SOPS-encrypted secrets)
API_TOKEN = data.sops_file.secrets.data["api_token"]
```

## LocalStack Support

```hcl
variable "use_localstack" {
  default = false
}

environment {
  variables = merge(local.common_lambda_env, {
    USE_LOCALSTACK     = var.use_localstack ? "true" : "false"
    DYNAMODB_ENDPOINT  = var.use_localstack ? "http://localhost:4566" : null
  })
}
```

## Related Patterns

- [AWS/Lambda-Environment-Variables](../AWS/Lambda-Environment-Variables.md)
- [Resource Naming](Resource-Naming.md)

---

*Configure Lambda environment variables in OpenTofu using SCREAMING_CASE naming.*
