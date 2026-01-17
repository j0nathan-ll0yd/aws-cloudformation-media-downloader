locals {
  send_push_notification_function_name = "SendPushNotification"
}

resource "aws_iam_role" "SendPushNotification" {
  name               = local.send_push_notification_function_name
  assume_role_policy = data.aws_iam_policy_document.LambdaAssumeRole.json
  tags               = local.common_tags
}

resource "aws_iam_role_policy" "SendPushNotificationLogging" {
  name = "SendPushNotificationLogging"
  role = aws_iam_role.SendPushNotification.id
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
        "arn:aws:logs:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.send_push_notification_function_name}",
        "arn:aws:logs:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.send_push_notification_function_name}:*"
      ]
    }]
  })
}

resource "aws_iam_role_policy_attachment" "SendPushNotificationXRay" {
  role       = aws_iam_role.SendPushNotification.name
  policy_arn = aws_iam_policy.CommonLambdaXRay.arn
}

resource "aws_iam_role_policy_attachment" "SendPushNotificationDSQL" {
  role       = aws_iam_role.SendPushNotification.name
  policy_arn = aws_iam_policy.LambdaDSQLReadOnly.arn
}

data "aws_iam_policy_document" "SendPushNotification" {
  statement {
    actions = [
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes"
    ]
    resources = [
      aws_sqs_queue.SendPushNotification.arn,
      aws_sqs_queue.SendPushNotificationDLQ.arn
    ]
  }
  dynamic "statement" {
    for_each = length(aws_sns_platform_application.OfflineMediaDownloader) == 1 ? [1] : []
    content {
      actions   = ["sns:Publish"]
      resources = [aws_sns_platform_application.OfflineMediaDownloader[0].arn]
    }
  }
}

resource "aws_iam_policy" "SendPushNotification" {
  name   = local.send_push_notification_function_name
  policy = data.aws_iam_policy_document.SendPushNotification.json
  tags   = local.common_tags
}

resource "aws_iam_role_policy_attachment" "SendPushNotification" {
  role       = aws_iam_role.SendPushNotification.name
  policy_arn = aws_iam_policy.SendPushNotification.arn
}

resource "aws_lambda_permission" "SendPushNotification" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.SendPushNotification.function_name
  principal     = "apigateway.amazonaws.com"
}

resource "aws_cloudwatch_log_group" "SendPushNotification" {
  name              = "/aws/lambda/${aws_lambda_function.SendPushNotification.function_name}"
  retention_in_days = 7
  tags              = local.common_tags
}

data "archive_file" "SendPushNotification" {
  type        = "zip"
  source_dir  = "./../build/lambdas/SendPushNotification"
  output_path = "./../build/lambdas/SendPushNotification.zip"
}

resource "aws_lambda_function" "SendPushNotification" {
  description      = "Sends push notifications to user devices via SNS/APNS."
  function_name    = local.send_push_notification_function_name
  role             = aws_iam_role.SendPushNotification.arn
  handler          = "index.handler"
  runtime          = "nodejs24.x"
  architectures    = [local.lambda_architecture]
  depends_on       = [aws_iam_role_policy.SendPushNotificationLogging]
  filename         = data.archive_file.SendPushNotification.output_path
  source_code_hash = data.archive_file.SendPushNotification.output_base64sha256
  layers           = [local.adot_layer_arn]
  timeout          = local.default_lambda_timeout
  memory_size      = 512

  tracing_config {
    mode = "Active"
  }
  environment {
    variables = merge(local.common_lambda_env, {
      OTEL_SERVICE_NAME = local.send_push_notification_function_name
      DSQL_ACCESS_LEVEL = "readonly"
    })
  }

  tags = merge(local.common_tags, {
    Name = local.send_push_notification_function_name
  })
}

# Dead Letter Queue for failed push notifications
resource "aws_sqs_queue" "SendPushNotificationDLQ" {
  name                      = "SendPushNotification-DLQ"
  message_retention_seconds = 1209600 # 14 days for investigation
  tags = merge(local.common_tags, {
    Purpose = "Dead letter queue for failed push notifications"
  })
}

resource "aws_sqs_queue" "SendPushNotification" {
  name                       = "SendPushNotification"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 345600
  receive_wait_time_seconds  = 0
  visibility_timeout_seconds = 60 # 6x Lambda timeout

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.SendPushNotificationDLQ.arn
    maxReceiveCount     = 3
  })

  tags = local.common_tags
}

resource "aws_lambda_event_source_mapping" "SendPushNotification" {
  event_source_arn        = aws_sqs_queue.SendPushNotification.arn
  function_name           = aws_lambda_function.SendPushNotification.arn
  function_response_types = ["ReportBatchItemFailures"]
}
