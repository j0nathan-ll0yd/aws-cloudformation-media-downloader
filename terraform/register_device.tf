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
  statement {
    actions = [
      "dynamodb:Query",
      "dynamodb:UpdateItem"
    ]
    resources = [
      aws_dynamodb_table.UserDevices.arn,
      aws_dynamodb_table.Devices.arn
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
  runtime          = "nodejs14.x"
  depends_on       = [aws_iam_role_policy_attachment.RegisterDevicePolicy]
  filename         = data.archive_file.RegisterDevice.output_path
  source_code_hash = data.archive_file.RegisterDevice.output_base64sha256

  environment {
    variables = {
      PlatformApplicationArn   = length(aws_sns_platform_application.OfflineMediaDownloader) == 1 ? aws_sns_platform_application.OfflineMediaDownloader[0].arn : ""
      PushNotificationTopicArn = aws_sns_topic.PushNotifications.arn
      DynamoDBTableDevices     = aws_dynamodb_table.Devices.name
      DynamoDBTableUserDevices = aws_dynamodb_table.UserDevices.name
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
  assume_role_policy = data.aws_iam_policy_document.SNSAssumeRole.json
}

resource "aws_iam_role_policy_attachment" "SNSLoggingRolePolicy" {
  role       = aws_iam_role.SNSLoggingRole.name
  policy_arn = aws_iam_policy.CommonLambdaLogging.arn
}

resource "aws_dynamodb_table" "UserDevices" {
  name           = "UserDevices"
  billing_mode   = "PROVISIONED"
  read_capacity  = 5
  write_capacity = 5
  hash_key       = "userId"

  attribute {
    name = "userId"
    type = "S"
  }
}

resource "aws_dynamodb_table" "Devices" {
  name           = "Devices"
  billing_mode   = "PROVISIONED"
  read_capacity  = 5
  write_capacity = 5
  hash_key       = "deviceId"

  attribute {
    name = "deviceId"
    type = "S"
  }
}
