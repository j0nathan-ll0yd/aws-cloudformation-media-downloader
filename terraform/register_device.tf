resource "aws_iam_role" "RegisterDeviceRole" {
  name               = "RegisterDeviceRole"
  assume_role_policy = data.aws_iam_policy_document.lambda-assume-role-policy.json
}

data "aws_iam_policy_document" "RegisterDevice" {
  statement {
    actions = [
      "sns:CreatePlatformEndpoint",
      "sns:Subscribe"
    ]
    resources = [
      aws_sns_platform_application.OfflineMediaDownloader.arn,
      aws_sns_topic.PushNotifications.arn
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

resource "aws_lambda_permission" "RegisterDevice" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.RegisterDevice.function_name
  principal     = "apigateway.amazonaws.com"
}

resource "aws_cloudwatch_log_group" "RegisterDevice" {
  name              = "/aws/lambda/${aws_lambda_function.RegisterDevice.function_name}"
  retention_in_days = 14
}

resource "aws_lambda_function" "RegisterDevice" {
  description      = "Registers an iOS device"
  filename         = "./../build/artifacts/dist.zip"
  function_name    = "RegisterDevice"
  role             = aws_iam_role.RegisterDeviceRole.arn
  handler          = "dist/main.handleDeviceRegistration"
  runtime          = "nodejs12.x"
  layers           = [aws_lambda_layer_version.NodeModules.arn]
  depends_on       = [aws_iam_role_policy_attachment.RegisterDevicePolicy]
  source_code_hash = filebase64sha256("./../build/artifacts/dist.zip")

  environment {
    variables = {
      PlatformApplicationArn   = aws_sns_platform_application.OfflineMediaDownloader.arn
      PushNotificationTopicArn = aws_sns_topic.PushNotifications.arn
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
  authorizer_id    = aws_api_gateway_authorizer.CustomAuthorizer.id
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
  name                = "OfflineMediaDownloader"
  platform            = "APNS_SANDBOX"
  platform_credential = file("./../secure/APNS_SANDBOX/privateKey.txt")  # APNS PRIVATE KEY
  platform_principal  = file("./../secure/APNS_SANDBOX/certificate.txt") # APNS CERTIFICATE
}
