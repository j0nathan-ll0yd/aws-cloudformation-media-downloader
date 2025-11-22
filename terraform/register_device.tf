resource "aws_iam_role" "RegisterDeviceRole" {
  name               = "RegisterDeviceRole"
  assume_role_policy = data.aws_iam_policy_document.LambdaGatewayAssumeRole.json
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
  # Query UserCollection to check existing devices
  # PutItem on base table to create UserDevice and Device records
  statement {
    actions = [
      "dynamodb:Query",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem"
    ]
    resources = [
      aws_dynamodb_table.MediaDownloader.arn,
      "${aws_dynamodb_table.MediaDownloader.arn}/index/UserCollection"
    ]
  }
}

resource "aws_iam_policy" "RegisterDeviceRolePolicy" {
  name   = "RegisterDeviceRolePolicy"
  policy = data.aws_iam_policy_document.RegisterDevice.json
}

resource "aws_iam_role_policy_attachment" "RegisterDevicePolicy" {
  role       = aws_iam_role.RegisterDeviceRole.name
  policy_arn = aws_iam_policy.RegisterDeviceRolePolicy.arn
}

resource "aws_iam_role_policy_attachment" "RegisterDevicePolicyLogging" {
  role       = aws_iam_role.RegisterDeviceRole.name
  policy_arn = aws_iam_policy.CommonLambdaLogging.arn
}

resource "aws_iam_role_policy_attachment" "RegisterDevicePolicyXRay" {
  role       = aws_iam_role.RegisterDeviceRole.name
  policy_arn = aws_iam_policy.CommonLambdaXRay.arn
}

resource "aws_lambda_permission" "RegisterDevice" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.RegisterDevice.function_name
  principal     = "apigateway.amazonaws.com"
}

resource "aws_cloudwatch_log_group" "RegisterDevice" {
  name              = "/aws/lambda/${aws_lambda_function.RegisterDevice.function_name}"
  retention_in_days = 14
}

data "archive_file" "RegisterDevice" {
  type        = "zip"
  source_file = "./../build/lambdas/RegisterDevice.js"
  output_path = "./../build/lambdas/RegisterDevice.zip"
}

resource "aws_lambda_function" "RegisterDevice" {
  description      = "Registers an iOS device"
  function_name    = "RegisterDevice"
  role             = aws_iam_role.RegisterDeviceRole.arn
  handler          = "RegisterDevice.handler"
  runtime          = "nodejs22.x"
  depends_on       = [aws_iam_role_policy_attachment.RegisterDevicePolicy]
  filename         = data.archive_file.RegisterDevice.output_path
  source_code_hash = data.archive_file.RegisterDevice.output_base64sha256

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      PlatformApplicationArn   = length(aws_sns_platform_application.OfflineMediaDownloader) == 1 ? aws_sns_platform_application.OfflineMediaDownloader[0].arn : ""
      PushNotificationTopicArn = aws_sns_topic.PushNotifications.arn
      DynamoDBTableName        = aws_dynamodb_table.MediaDownloader.name
    }
  }
}

resource "aws_api_gateway_resource" "RegisterDevice" {
  rest_api_id = aws_api_gateway_rest_api.Main.id
  parent_id   = aws_api_gateway_rest_api.Main.root_resource_id
  path_part   = "registerDevice"
}

resource "aws_api_gateway_method" "RegisterDevicePost" {
  rest_api_id      = aws_api_gateway_rest_api.Main.id
  resource_id      = aws_api_gateway_resource.RegisterDevice.id
  http_method      = "POST"
  authorization    = "CUSTOM"
  authorizer_id    = aws_api_gateway_authorizer.ApiGatewayAuthorizer.id
  api_key_required = true
}

resource "aws_api_gateway_integration" "RegisterDevicePost" {
  rest_api_id             = aws_api_gateway_rest_api.Main.id
  resource_id             = aws_api_gateway_resource.RegisterDevice.id
  http_method             = aws_api_gateway_method.RegisterDevicePost.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.RegisterDevice.invoke_arn
}

resource "aws_sns_topic" "PushNotifications" {
  name = "PushNotifications"
}

resource "aws_sns_platform_application" "OfflineMediaDownloader" {
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
}

resource "aws_iam_role_policy_attachment" "SNSLoggingRolePolicy" {
  role       = aws_iam_role.SNSLoggingRole.name
  policy_arn = aws_iam_policy.CommonLambdaLogging.arn
}

