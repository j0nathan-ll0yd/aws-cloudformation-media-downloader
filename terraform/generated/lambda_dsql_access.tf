# Auto-generated from @RequiresDatabase decorators
# Do not edit manually - run: pnpm run generate:terraform-permissions
# Generated at: 2026-01-17T04:07:23.303Z
#
# This file provides a reference for Lambda DSQL access levels.
# Update individual Lambda .tf files to use these values.

locals {
  # Lambda DSQL access level configuration
  # Reference: build/db-permissions.json
  lambda_dsql_access_levels = {
    ListFiles            = "readonly"
    MigrateDSQL          = "admin"
    PruneDevices         = "readwrite"
    RegisterDevice       = "readwrite"
    RegisterUser         = "readwrite"
    S3ObjectCreated      = "readonly"
    SendPushNotification = "readonly"
    StartFileUpload      = "readwrite"
    UserDelete           = "readwrite"
    WebhookFeedly        = "readwrite"
  }

  # IAM policy ARN mapping
  lambda_dsql_iam_policies = {
    ListFiles            = aws_iam_policy.LambdaDSQLReadOnly.arn
    MigrateDSQL          = aws_iam_policy.LambdaDSQLAdmin.arn
    PruneDevices         = aws_iam_policy.LambdaDSQLReadWrite.arn
    RegisterDevice       = aws_iam_policy.LambdaDSQLReadWrite.arn
    RegisterUser         = aws_iam_policy.LambdaDSQLReadWrite.arn
    S3ObjectCreated      = aws_iam_policy.LambdaDSQLReadOnly.arn
    SendPushNotification = aws_iam_policy.LambdaDSQLReadOnly.arn
    StartFileUpload      = aws_iam_policy.LambdaDSQLReadWrite.arn
    UserDelete           = aws_iam_policy.LambdaDSQLReadWrite.arn
    WebhookFeedly        = aws_iam_policy.LambdaDSQLReadWrite.arn
  }
}
