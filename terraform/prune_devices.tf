locals {
  prune_devices_function_name = "PruneDevices"
}

resource "aws_iam_role" "PruneDevices" {
  name               = local.prune_devices_function_name
  assume_role_policy = data.aws_iam_policy_document.LambdaAssumeRole.json
  tags               = local.common_tags
}

data "aws_iam_policy_document" "PruneDevices" {
  dynamic "statement" {
    for_each = length(aws_sns_platform_application.OfflineMediaDownloader) == 1 ? [1] : []
    content {
      actions   = ["sns:DeleteEndpoint"]
      resources = [aws_sns_platform_application.OfflineMediaDownloader[0].arn]
    }
  }
}

resource "aws_iam_policy" "PruneDevices" {
  name   = local.prune_devices_function_name
  policy = data.aws_iam_policy_document.PruneDevices.json
  tags   = local.common_tags
}

resource "aws_iam_role_policy_attachment" "PruneDevices" {
  role       = aws_iam_role.PruneDevices.name
  policy_arn = aws_iam_policy.PruneDevices.arn
}

resource "aws_iam_role_policy_attachment" "PruneDevicesLogging" {
  role       = aws_iam_role.PruneDevices.name
  policy_arn = aws_iam_policy.CommonLambdaLogging.arn
}

resource "aws_iam_role_policy_attachment" "PruneDevicesXRay" {
  role       = aws_iam_role.PruneDevices.name
  policy_arn = aws_iam_policy.CommonLambdaXRay.arn
}

resource "aws_iam_role_policy_attachment" "PruneDevicesDSQL" {
  role       = aws_iam_role.PruneDevices.name
  policy_arn = aws_iam_policy.LambdaDSQLAccess.arn
}

resource "aws_cloudwatch_event_target" "PruneDevices" {
  rule = aws_cloudwatch_event_rule.PruneDevices.name
  arn  = aws_lambda_function.PruneDevices.arn
}


resource "aws_cloudwatch_event_rule" "PruneDevices" {
  name                = "PruneDevices"
  schedule_expression = "rate(1 day)"
  state               = "ENABLED"
  tags                = local.common_tags
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
  tags              = local.common_tags
}

data "archive_file" "PruneDevices" {
  type        = "zip"
  source_dir  = "./../build/lambdas/PruneDevices"
  output_path = "./../build/lambdas/PruneDevices.zip"
}

resource "aws_lambda_function" "PruneDevices" {
  description      = "Validates iOS devices are still reachable; otherwise removes them."
  function_name    = local.prune_devices_function_name
  role             = aws_iam_role.PruneDevices.arn
  handler          = "index.handler"
  runtime          = "nodejs24.x"
  depends_on       = [aws_iam_role_policy_attachment.PruneDevices]
  filename         = data.archive_file.PruneDevices.output_path
  source_code_hash = data.archive_file.PruneDevices.output_base64sha256
  layers           = [local.adot_layer_arn]

  tracing_config {
    mode = "Active"
  }
  timeout = 300

  environment {
    variables = merge(local.common_lambda_env, {
      APNS_SIGNING_KEY   = data.sops_file.secrets.data["apns.staging.signingKey"]
      APNS_TEAM          = data.sops_file.secrets.data["apns.staging.team"]
      APNS_KEY_ID        = data.sops_file.secrets.data["apns.staging.keyId"]
      APNS_DEFAULT_TOPIC = data.sops_file.secrets.data["apns.staging.defaultTopic"]
      APNS_HOST          = "api.sandbox.push.apple.com"
      OTEL_SERVICE_NAME  = local.prune_devices_function_name
    })
  }

  tags = merge(local.common_tags, {
    Name = local.prune_devices_function_name
  })
}
