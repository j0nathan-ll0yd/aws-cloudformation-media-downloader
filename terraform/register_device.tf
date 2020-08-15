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
    resources = compact([
      aws_sns_topic.PushNotifications.arn,
      length(aws_sns_platform_application.OfflineMediaDownloader) == 1 ? aws_sns_platform_application.OfflineMediaDownloader[0].arn : ""
    ])
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
      PlatformApplicationArn   = length(aws_sns_platform_application.OfflineMediaDownloader) == 1 ? aws_sns_platform_application.OfflineMediaDownloader[0].arn : ""
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

variable "apnsPrivateKeyPath" {
  type    = string
  default = "./../secure/APNS_SANDBOX/privateKey.txt"
}

variable "apnsCertificatePath" {
  type    = string
  default = "./../secure/APNS_SANDBOX/certificate.txt"
}

resource "aws_sns_platform_application" "OfflineMediaDownloader" {
  count                     = fileexists(var.apnsPrivateKeyPath) && fileexists(var.apnsCertificatePath) ? 1 : 0
  name                      = "OfflineMediaDownloader"
  platform                  = "APNS_SANDBOX"
  platform_credential       = file(var.apnsPrivateKeyPath)  # APNS PRIVATE KEY
  platform_principal        = file(var.apnsCertificatePath) # APNS CERTIFICATE
  success_feedback_role_arn = aws_iam_role.SNSLoggingRole.arn
  failure_feedback_role_arn = aws_iam_role.SNSLoggingRole.arn
}

resource "aws_iam_role" "SNSLoggingRole" {
  name               = "SNSLoggingRole"
  assume_role_policy = data.aws_iam_policy_document.sns-assume-role-policy.json
}

resource "aws_iam_role_policy_attachment" "SNSLoggingRolePolicy" {
  role       = aws_iam_role.SNSLoggingRole.name
  policy_arn = aws_iam_policy.CommonLambdaLogging.arn
}
