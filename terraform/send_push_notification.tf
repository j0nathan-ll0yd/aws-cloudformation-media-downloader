locals {
  send_push_notification_function_name = "${var.resource_prefix}-SendPushNotification"
}

resource "aws_iam_role" "SendPushNotification" {
  name               = local.send_push_notification_function_name
  assume_role_policy = data.aws_iam_policy_document.LambdaAssumeRole.json
  tags               = local.common_tags
}

resource "aws_iam_role_policy_attachment" "SendPushNotificationLogging" {
  role       = aws_iam_role.SendPushNotification.name
  policy_arn = aws_iam_policy.CommonLambdaLogging.arn
}

resource "aws_iam_role_policy_attachment" "SendPushNotificationXRay" {
  role       = aws_iam_role.SendPushNotification.name
  policy_arn = aws_iam_policy.CommonLambdaXRay.arn
}

resource "aws_iam_role_policy_attachment" "SendPushNotificationDSQL" {
  role       = aws_iam_role.SendPushNotification.name
  policy_arn = aws_iam_policy.LambdaDSQLAccess.arn
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
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

data "archive_file" "SendPushNotification" {
  type        = "zip"
  source_dir  = "./../build/lambdas/SendPushNotification"
  output_path = "./../build/lambdas/SendPushNotification.zip"
}

resource "aws_lambda_function" "SendPushNotification" {
  description      = "Records an event from a client environment (e.g. App or Web)."
  function_name    = local.send_push_notification_function_name
  role             = aws_iam_role.SendPushNotification.arn
  handler          = "index.handler"
  runtime          = "nodejs24.x"
  architectures    = [local.lambda_architecture]
  depends_on       = [aws_iam_role_policy_attachment.SendPushNotificationLogging]
  filename         = data.archive_file.SendPushNotification.output_path
  source_code_hash = data.archive_file.SendPushNotification.output_base64sha256
  layers           = [local.adot_layer_arn]

  tracing_config {
    mode = "Active"
  }
  environment {
    variables = merge(local.common_lambda_env, {
      OTEL_SERVICE_NAME = local.send_push_notification_function_name
    })
  }

  tags = merge(local.common_tags, {
    Name = local.send_push_notification_function_name
  })
}

# Dead Letter Queue for failed push notifications
resource "aws_sqs_queue" "SendPushNotificationDLQ" {
  name                      = "${var.resource_prefix}-SendPushNotification-DLQ"
  message_retention_seconds = 1209600 # 14 days for investigation
  tags = merge(local.common_tags, {
    Purpose = "Dead letter queue for failed push notifications"
  })
}

resource "aws_sqs_queue" "SendPushNotification" {
  name                       = "${var.resource_prefix}-SendPushNotification"
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
