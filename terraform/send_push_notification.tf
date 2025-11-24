resource "aws_iam_role" "SendPushNotificationRole" {
  name               = "SendPushNotificationRole"
  assume_role_policy = data.aws_iam_policy_document.LambdaAssumeRole.json
}

resource "aws_iam_role_policy_attachment" "SendPushNotificationPolicyLogging" {
  role       = aws_iam_role.SendPushNotificationRole.name
  policy_arn = aws_iam_policy.CommonLambdaLogging.arn
}

resource "aws_iam_role_policy_attachment" "SendPushNotificationPolicyXRay" {
  role       = aws_iam_role.SendPushNotificationRole.name
  policy_arn = aws_iam_policy.CommonLambdaXRay.arn
}

data "aws_iam_policy_document" "SendPushNotification" {
  statement {
    actions = [
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes"
    ]
    resources = [
      aws_sqs_queue.SendPushNotification.arn
    ]
  }
  # Query UserCollection to get user's devices
  # GetItem on base table to retrieve device details
  statement {
    actions = [
      "dynamodb:Query",
      "dynamodb:GetItem"
    ]
    resources = [
      aws_dynamodb_table.MediaDownloader.arn,
      "${aws_dynamodb_table.MediaDownloader.arn}/index/UserCollection"
    ]
  }
  statement {
    actions   = ["sns:Publish"]
    resources = [length(aws_sns_platform_application.OfflineMediaDownloader) == 1 ? aws_sns_platform_application.OfflineMediaDownloader[0].arn : ""]
  }
}

resource "aws_iam_policy" "SendPushNotificationRolePolicy" {
  name   = "SendPushNotificationRolePolicy"
  policy = data.aws_iam_policy_document.SendPushNotification.json
}

resource "aws_iam_role_policy_attachment" "SendPushNotificationRolePolicy" {
  role       = aws_iam_role.SendPushNotificationRole.name
  policy_arn = aws_iam_policy.SendPushNotificationRolePolicy.arn
}

resource "aws_lambda_permission" "SendPushNotification" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.SendPushNotification.function_name
  principal     = "apigateway.amazonaws.com"
}

resource "aws_cloudwatch_log_group" "SendPushNotification" {
  name              = "/aws/lambda/${aws_lambda_function.SendPushNotification.function_name}"
  retention_in_days = 14
}

data "archive_file" "SendPushNotification" {
  type        = "zip"
  source_file = "./../build/lambdas/SendPushNotification.js"
  output_path = "./../build/lambdas/SendPushNotification.zip"
}

resource "aws_lambda_function" "SendPushNotification" {
  description      = "Records an event from a client environment (e.g. App or Web)."
  function_name    = "SendPushNotification"
  role             = aws_iam_role.SendPushNotificationRole.arn
  handler          = "SendPushNotification.handler"
  runtime          = "nodejs22.x"
  depends_on       = [aws_iam_role_policy_attachment.SendPushNotificationPolicyLogging]
  filename         = data.archive_file.SendPushNotification.output_path
  source_code_hash = data.archive_file.SendPushNotification.output_base64sha256

  tracing_config {
    mode = "Active"
  }
  environment {
    variables = {
      DynamoDBTableName = aws_dynamodb_table.MediaDownloader.name
    }
  }
}

resource "aws_sqs_queue" "SendPushNotification" {
  name                      = "SendPushNotification"
  delay_seconds             = 0
  max_message_size          = 262144
  message_retention_seconds = 345600
  receive_wait_time_seconds = 0
  tags = {
    Environment = "production"
  }
}

resource "aws_lambda_event_source_mapping" "SendPushNotification" {
  event_source_arn = aws_sqs_queue.SendPushNotification.arn
  function_name    = aws_lambda_function.SendPushNotification.arn
}
