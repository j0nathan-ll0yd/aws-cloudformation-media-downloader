# CleanupExpiredRecords Lambda
# Scheduled Lambda that replaces DynamoDB TTL functionality
# Runs daily at 3 AM UTC to delete expired records from Aurora DSQL

locals {
  cleanup_expired_records_function_name = "CleanupExpiredRecords"
}

resource "aws_iam_role" "CleanupExpiredRecords" {
  name               = local.cleanup_expired_records_function_name
  assume_role_policy = data.aws_iam_policy_document.LambdaAssumeRole.json
  tags               = local.common_tags
}

resource "aws_iam_role_policy" "CleanupExpiredRecordsLogging" {
  name = "CleanupExpiredRecordsLogging"
  role = aws_iam_role.CleanupExpiredRecords.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ]
      Resource = [
        "arn:aws:logs:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.cleanup_expired_records_function_name}",
        "arn:aws:logs:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.cleanup_expired_records_function_name}:*"
      ]
    }]
  })
}

resource "aws_iam_role_policy_attachment" "CleanupExpiredRecordsXRay" {
  role       = aws_iam_role.CleanupExpiredRecords.name
  policy_arn = aws_iam_policy.CommonLambdaXRay.arn
}

resource "aws_iam_role_policy_attachment" "CleanupExpiredRecordsDSQL" {
  role       = aws_iam_role.CleanupExpiredRecords.name
  policy_arn = aws_iam_policy.LambdaDSQLAccess.arn
}

resource "aws_cloudwatch_log_group" "CleanupExpiredRecords" {
  name              = "/aws/lambda/${aws_lambda_function.CleanupExpiredRecords.function_name}"
  retention_in_days = 7
  tags              = local.common_tags
}

data "archive_file" "CleanupExpiredRecords" {
  type        = "zip"
  source_dir  = "./../build/lambdas/CleanupExpiredRecords"
  output_path = "./../build/lambdas/CleanupExpiredRecords.zip"
}

resource "aws_lambda_function" "CleanupExpiredRecords" {
  description      = "Scheduled cleanup of expired FileDownloads, Sessions, and VerificationTokens"
  function_name    = local.cleanup_expired_records_function_name
  role             = aws_iam_role.CleanupExpiredRecords.arn
  handler          = "index.handler"
  runtime          = "nodejs24.x"
  architectures    = [local.lambda_architecture]
  timeout          = 60 # Allow time for database operations
  depends_on       = [aws_iam_role_policy.CleanupExpiredRecordsLogging]
  filename         = data.archive_file.CleanupExpiredRecords.output_path
  source_code_hash = data.archive_file.CleanupExpiredRecords.output_base64sha256
  layers           = [local.adot_layer_arn]

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = merge(local.common_lambda_env, {
      OTEL_SERVICE_NAME = local.cleanup_expired_records_function_name
    })
  }

  tags = merge(local.common_tags, {
    Name = local.cleanup_expired_records_function_name
  })
}

# CloudWatch Events rule to trigger daily at 3 AM UTC
resource "aws_cloudwatch_event_rule" "CleanupExpiredRecords" {
  name                = local.cleanup_expired_records_function_name
  description         = "Triggers CleanupExpiredRecords Lambda daily at 3 AM UTC"
  schedule_expression = "cron(0 3 * * ? *)"
  tags                = local.common_tags
}

resource "aws_cloudwatch_event_target" "CleanupExpiredRecords" {
  rule = aws_cloudwatch_event_rule.CleanupExpiredRecords.name
  arn  = aws_lambda_function.CleanupExpiredRecords.arn
}

resource "aws_lambda_permission" "CleanupExpiredRecords" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.CleanupExpiredRecords.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.CleanupExpiredRecords.arn
}
