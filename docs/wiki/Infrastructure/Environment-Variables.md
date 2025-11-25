# Infrastructure Environment Variables

## Quick Reference
- **When to use**: OpenTofu/Terraform Lambda configuration
- **Enforcement**: Required
- **Impact if violated**: HIGH - Deployment failures

## OpenTofu Configuration

Define environment variables in Lambda resources using CamelCase:

```hcl
resource "aws_lambda_function" "ProcessFile" {
  function_name = "ProcessFile"

  environment {
    variables = {
      DynamoDBTableName        = aws_dynamodb_table.main.name
      PlatformApplicationArn   = aws_sns_platform_application.apns.arn
      PushNotificationTopicArn = aws_sns_topic.push_notifications.arn
      FeedlyQueueUrl          = aws_sqs_queue.feedly.url
      EnableXRay              = var.enable_xray ? "true" : "false"
    }
  }
}
```

## Variable Sources

```hcl
# From AWS resources
DynamoDBTableName = aws_dynamodb_table.main.name

# From Terraform variables
EnableXRay = var.enable_xray

# From data sources
ApiToken = data.aws_secretsmanager_secret_version.api_token.secret_string
```

## LocalStack Support

```hcl
variable "use_localstack" {
  default = false
}

environment {
  variables = {
    UseLocalstack = var.use_localstack ? "true" : "false"
    DynamoDBEndpoint = var.use_localstack ? "http://localhost:4566" : null
  }
}
```

## Related Patterns

- [AWS/Lambda-Environment-Variables](../AWS/Lambda-Environment-Variables.md)
- [Resource Naming](Resource-Naming.md)

---

*Configure Lambda environment variables in OpenTofu using CamelCase naming.*