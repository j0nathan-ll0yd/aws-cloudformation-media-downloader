resource "aws_iam_role" "PruneDevicesRole" {
  name               = "PruneDevicesRole"
  assume_role_policy = data.aws_iam_policy_document.LambdaAssumeRole.json
}

data "aws_iam_policy_document" "PruneDevices" {
  # Query DeviceCollection to find users by device
  # Scan base table for all devices, GetItem/DeleteItem on base table
  statement {
    actions = [
      "dynamodb:Scan",
      "dynamodb:Query",
      "dynamodb:GetItem",
      "dynamodb:DeleteItem"
    ]
    resources = [
      aws_dynamodb_table.MediaDownloader.arn,
      "${aws_dynamodb_table.MediaDownloader.arn}/index/DeviceCollection"
    ]
  }
  dynamic "statement" {
    for_each = length(aws_sns_platform_application.OfflineMediaDownloader) == 1 ? [1] : []
    content {
      actions   = ["sns:DeleteEndpoint"]
      resources = [aws_sns_platform_application.OfflineMediaDownloader[0].arn]
    }
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

resource "aws_iam_role_policy_attachment" "PruneDevicesPolicyXRay" {
  role       = aws_iam_role.PruneDevicesRole.name
  policy_arn = aws_iam_policy.CommonLambdaXRay.arn
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
  source_file = "./../build/lambdas/PruneDevices.mjs"
  output_path = "./../build/lambdas/PruneDevices.zip"
}

resource "aws_lambda_function" "PruneDevices" {
  description      = "Validates iOS devices are still reachable; otherwise removes them."
  function_name    = "PruneDevices"
  role             = aws_iam_role.PruneDevicesRole.arn
  handler          = "PruneDevices.handler"
  runtime          = "nodejs24.x"
  depends_on       = [aws_iam_role_policy_attachment.PruneDevicesPolicy]
  filename         = data.archive_file.PruneDevices.output_path
  source_code_hash = data.archive_file.PruneDevices.output_base64sha256
  layers           = [data.aws_lambda_layer_version.adot_collector.arn]

  tracing_config {
    mode = "Active"
  }
  timeout = 300

  environment {
    variables = {
      DYNAMODB_TABLE_NAME         = aws_dynamodb_table.MediaDownloader.name
      APNS_SIGNING_KEY            = data.sops_file.secrets.data["apns.staging.signingKey"]
      APNS_TEAM                   = data.sops_file.secrets.data["apns.staging.team"]
      APNS_KEY_ID                 = data.sops_file.secrets.data["apns.staging.keyId"]
      APNS_DEFAULT_TOPIC          = data.sops_file.secrets.data["apns.staging.defaultTopic"]
      APNS_HOST                   = "api.sandbox.push.apple.com"
      OTEL_SERVICE_NAME           = "PruneDevices"
      OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318"
      OTEL_PROPAGATORS            = "xray"
    }
  }
}
