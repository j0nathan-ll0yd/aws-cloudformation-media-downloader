resource "aws_iam_role" "PruneDevicesRole" {
  name               = "PruneDevicesRole"
  assume_role_policy = data.aws_iam_policy_document.LambdaAssumeRole.json
}

data "aws_iam_policy_document" "PruneDevices" {
  statement {
    actions   = ["dynamodb:Scan", "dynamodb:DeleteItem"]
    resources = [aws_dynamodb_table.Devices.arn]
  }
  statement {
    actions   = ["dynamodb:Scan", "dynamodb:UpdateItem"]
    resources = [aws_dynamodb_table.UserDevices.arn]
  }
  statement {
    actions = ["secretsmanager:GetSecretValue"]
    resources = [
      aws_secretsmanager_secret.ApplePushNotificationServiceCert.arn,
      aws_secretsmanager_secret.ApplePushNotificationServiceKey.arn,
      aws_secretsmanager_secret.ApnsSigningKey.arn,
    ]
  }
  statement {
    actions   = ["sns:DeleteEndpoint"]
    resources = [length(aws_sns_platform_application.OfflineMediaDownloader) == 1 ? aws_sns_platform_application.OfflineMediaDownloader[0].arn : ""]
  }
}

resource "aws_iam_policy" "PruneDevicesRolePolicy" {
  name   = "PruneDevicesRolePolicy"
  policy = data.aws_iam_policy_document.PruneDevices.json
}

resource "aws_iam_role_policy_attachment" "PruneDevicesPolicy" {
  role       = aws_iam_role.PruneDevicesRole.name
  policy_arn = aws_iam_policy.PruneDevicesRolePolicy.arn
}

resource "aws_iam_role_policy_attachment" "PruneDevicesPolicyLogging" {
  role       = aws_iam_role.PruneDevicesRole.name
  policy_arn = aws_iam_policy.CommonLambdaLogging.arn
}

resource "aws_cloudwatch_event_target" "PruneDevices" {
  rule = aws_cloudwatch_event_rule.PruneDevices.name
  arn  = aws_lambda_function.PruneDevices.arn
}


resource "aws_cloudwatch_event_rule" "PruneDevices" {
  name                = "PruneDevices"
  schedule_expression = "rate(1 day)"
  state               = "ENABLED"
}

resource "aws_lambda_permission" "PruneDevices" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.PruneDevices.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.PruneDevices.arn
}

resource "aws_cloudwatch_log_group" "PruneDevices" {
  name              = "/aws/lambda/${aws_lambda_function.PruneDevices.function_name}"
  retention_in_days = 14
}

data "archive_file" "PruneDevices" {
  type        = "zip"
  source_file = "./../build/lambdas/PruneDevices.js"
  output_path = "./../build/lambdas/PruneDevices.zip"
}

resource "aws_lambda_function" "PruneDevices" {
  description      = "Validates iOS devices are still reachable; otherwise removes them."
  function_name    = "PruneDevices"
  role             = aws_iam_role.PruneDevicesRole.arn
  handler          = "PruneDevices.handler"
  runtime          = "nodejs22.x"
  depends_on       = [aws_iam_role_policy_attachment.PruneDevicesPolicy]
  filename         = data.archive_file.PruneDevices.output_path
  source_code_hash = data.archive_file.PruneDevices.output_base64sha256
  timeout          = 300

  environment {
    variables = {
      DynamoDBTableDevices     = aws_dynamodb_table.Devices.name
      DynamoDBTableUserDevices = aws_dynamodb_table.UserDevices.name
      ApnsSigningKey           = aws_secretsmanager_secret.ApnsSigningKey.name
      ApnsTeam                 = var.APNS_SANDBOX_TEAM
      ApnsKeyId                = var.APNS_SANDBOX_KEY_ID
      ApnsDefaultTopic         = var.APNS_SANDBOX_DEFAULT_TOPIC
    }
  }
}

resource "aws_secretsmanager_secret" "ApplePushNotificationServiceKey" {
  name                    = "ApplePushNotificationServiceKey"
  description             = "The private key for APNS"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "ApplePushNotificationServiceKey" {
  secret_id     = aws_secretsmanager_secret.ApplePushNotificationServiceKey.id
  secret_string = file(var.apnsPrivateKeyPath)
}

resource "aws_secretsmanager_secret" "ApplePushNotificationServiceCert" {
  name                    = "ApplePushNotificationServiceCert"
  description             = "The private certificate for APNS"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "ApplePushNotificationServiceCert" {
  secret_id     = aws_secretsmanager_secret.ApplePushNotificationServiceCert.id
  secret_string = file(var.apnsCertificatePath)
}
