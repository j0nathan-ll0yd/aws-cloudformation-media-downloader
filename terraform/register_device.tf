locals {
  register_device_function_name = "RegisterDevice"
}

resource "aws_iam_role" "RegisterDevice" {
  name               = local.register_device_function_name
  assume_role_policy = data.aws_iam_policy_document.LambdaGatewayAssumeRole.json
  tags               = local.common_tags
}

data "aws_iam_policy_document" "RegisterDevice" {
  statement {
    actions = [
      "sns:ListSubscriptionsByTopic",
      "sns:CreatePlatformEndpoint",
      "sns:Subscribe",
      "sns:Unsubscribe"
    ]
    resources = compact([
      aws_sns_topic.PushNotifications.arn,
      length(aws_sns_platform_application.OfflineMediaDownloader) == 1 ? aws_sns_platform_application.OfflineMediaDownloader[0].arn : ""
    ])
  }
}

resource "aws_iam_policy" "RegisterDevice" {
  name   = local.register_device_function_name
  policy = data.aws_iam_policy_document.RegisterDevice.json
  tags   = local.common_tags
}

resource "aws_iam_role_policy_attachment" "RegisterDevice" {
  role       = aws_iam_role.RegisterDevice.name
  policy_arn = aws_iam_policy.RegisterDevice.arn
}

resource "aws_iam_role_policy" "RegisterDeviceLogging" {
  name = "RegisterDeviceLogging"
  role = aws_iam_role.RegisterDevice.id
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
        "arn:aws:logs:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.register_device_function_name}",
        "arn:aws:logs:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.register_device_function_name}:*"
      ]
    }]
  })
}

resource "aws_iam_role_policy_attachment" "RegisterDeviceXRay" {
  role       = aws_iam_role.RegisterDevice.name
  policy_arn = aws_iam_policy.CommonLambdaXRay.arn
}

# DSQL policy attachment handled by terraform/dsql_permissions.tf

resource "aws_lambda_permission" "RegisterDevice" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.RegisterDevice.function_name
  principal     = "apigateway.amazonaws.com"
}

resource "aws_cloudwatch_log_group" "RegisterDevice" {
  name              = "/aws/lambda/${aws_lambda_function.RegisterDevice.function_name}"
  retention_in_days = 7
  tags              = local.common_tags
}

data "archive_file" "RegisterDevice" {
  type        = "zip"
  source_dir  = "./../build/lambdas/RegisterDevice"
  output_path = "./../build/lambdas/RegisterDevice.zip"
}

resource "aws_lambda_function" "RegisterDevice" {
  description      = "Registers an iOS device"
  function_name    = local.register_device_function_name
  role             = aws_iam_role.RegisterDevice.arn
  handler          = "index.handler"
  runtime          = "nodejs24.x"
  architectures    = [local.lambda_architecture]
  timeout          = local.default_lambda_timeout
  depends_on       = [aws_iam_role_policy_attachment.RegisterDevice]
  filename         = data.archive_file.RegisterDevice.output_path
  source_code_hash = data.archive_file.RegisterDevice.output_base64sha256
  layers           = [local.adot_layer_arn]

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = merge(local.common_lambda_env, {
      PLATFORM_APPLICATION_ARN    = length(aws_sns_platform_application.OfflineMediaDownloader) == 1 ? aws_sns_platform_application.OfflineMediaDownloader[0].arn : ""
      PUSH_NOTIFICATION_TOPIC_ARN = aws_sns_topic.PushNotifications.arn
      OTEL_SERVICE_NAME           = local.register_device_function_name
      DSQL_ROLE_NAME              = local.lambda_dsql_roles["RegisterDevice"].role_name
    })
  }

  tags = merge(local.common_tags, {
    Name = local.register_device_function_name
  })
}

resource "aws_api_gateway_resource" "DeviceRegister" {
  rest_api_id = aws_api_gateway_rest_api.Main.id
  parent_id   = aws_api_gateway_resource.Device.id
  path_part   = "register"
}

resource "aws_api_gateway_method" "RegisterDevicePost" {
  rest_api_id      = aws_api_gateway_rest_api.Main.id
  resource_id      = aws_api_gateway_resource.DeviceRegister.id
  http_method      = "POST"
  authorization    = "CUSTOM"
  authorizer_id    = aws_api_gateway_authorizer.ApiGatewayAuthorizer.id
  api_key_required = true
}

resource "aws_api_gateway_integration" "RegisterDevicePost" {
  rest_api_id             = aws_api_gateway_rest_api.Main.id
  resource_id             = aws_api_gateway_resource.DeviceRegister.id
  http_method             = aws_api_gateway_method.RegisterDevicePost.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.RegisterDevice.invoke_arn
}

resource "aws_sns_topic" "PushNotifications" {
  name = "PushNotifications"
}

resource "aws_sns_platform_application" "OfflineMediaDownloader" {
  # APNS certificate valid until 2027-01-03
  # TODO: Set calendar reminder for 2026-12-01 to renew certificate
  # Renewal process: Generate new cert in Apple Developer Portal, update SOPS secrets
  count                     = 1
  name                      = "OfflineMediaDownloader"
  platform                  = "APNS_SANDBOX"
  platform_credential       = data.sops_file.secrets.data["apns.staging.privateKey"]  # APNS PRIVATE KEY
  platform_principal        = data.sops_file.secrets.data["apns.staging.certificate"] # APNS CERTIFICATE
  success_feedback_role_arn = aws_iam_role.SNSLoggingRole.arn
  failure_feedback_role_arn = aws_iam_role.SNSLoggingRole.arn
}

resource "aws_iam_role" "SNSLoggingRole" {
  name               = "SNSLoggingRole"
  assume_role_policy = data.aws_iam_policy_document.SNSAssumeRole.json
  tags               = local.common_tags
}

resource "aws_iam_role_policy" "SNSLoggingRolePolicy" {
  name = "SNSLoggingRolePolicy"
  role = aws_iam_role.SNSLoggingRole.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ]
      Resource = ["arn:aws:logs:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:log-group:sns/*"]
    }]
  })
}

