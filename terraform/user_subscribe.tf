resource "aws_iam_role" "UserSubscribeRole" {
  name               = "UserSubscribeRole"
  assume_role_policy = data.aws_iam_policy_document.LambdaGatewayAssumeRole.json
}

data "aws_iam_policy_document" "UserSubscribe" {
  statement {
    actions = ["sns:Subscribe"]
    resources = compact([
      aws_sns_topic.PushNotifications.arn,
      length(aws_sns_platform_application.OfflineMediaDownloader) == 1 ? aws_sns_platform_application.OfflineMediaDownloader[0].arn : ""
    ])
  }
}

resource "aws_iam_policy" "UserSubscribeRolePolicy" {
  name   = "UserSubscribeRolePolicy"
  policy = data.aws_iam_policy_document.UserSubscribe.json
}

resource "aws_iam_role_policy_attachment" "UserSubscribePolicy" {
  role       = aws_iam_role.UserSubscribeRole.name
  policy_arn = aws_iam_policy.UserSubscribeRolePolicy.arn
}

resource "aws_iam_role_policy_attachment" "UserSubscribePolicyLogging" {
  role       = aws_iam_role.UserSubscribeRole.name
  policy_arn = aws_iam_policy.CommonLambdaLogging.arn
}

resource "aws_iam_role_policy_attachment" "UserSubscribePolicyXRay" {
  role       = aws_iam_role.UserSubscribeRole.name
  policy_arn = aws_iam_policy.CommonLambdaXRay.arn
}

resource "aws_lambda_permission" "UserSubscribe" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.UserSubscribe.function_name
  principal     = "apigateway.amazonaws.com"
}

resource "aws_cloudwatch_log_group" "UserSubscribe" {
  name              = "/aws/lambda/${aws_lambda_function.UserSubscribe.function_name}"
  retention_in_days = 14
}

data "archive_file" "UserSubscribe" {
  type        = "zip"
  source_file = "./../build/lambdas/UserSubscribe.mjs"
  output_path = "./../build/lambdas/UserSubscribe.zip"
}

resource "aws_lambda_function" "UserSubscribe" {
  description      = "Subscribes a device to an SNS topic"
  function_name    = "UserSubscribe"
  role             = aws_iam_role.UserSubscribeRole.arn
  handler          = "UserSubscribe.handler"
  runtime          = "nodejs24.x"
  depends_on       = [aws_iam_role_policy_attachment.UserSubscribePolicy]
  filename         = data.archive_file.UserSubscribe.output_path
  source_code_hash = data.archive_file.UserSubscribe.output_base64sha256
  layers           = [local.adot_layer_arn]

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      PLATFORM_APPLICATION_ARN    = length(aws_sns_platform_application.OfflineMediaDownloader) == 1 ? aws_sns_platform_application.OfflineMediaDownloader[0].arn : ""
      OTEL_SERVICE_NAME           = "UserSubscribe"
      OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318"
      OTEL_PROPAGATORS            = "xray"
    }
  }
}

resource "aws_api_gateway_resource" "UserSubscribe" {
  rest_api_id = aws_api_gateway_rest_api.Main.id
  parent_id   = aws_api_gateway_rest_api.Main.root_resource_id
  path_part   = "userSubscribe"
}

resource "aws_api_gateway_method" "UserSubscribePost" {
  rest_api_id      = aws_api_gateway_rest_api.Main.id
  resource_id      = aws_api_gateway_resource.UserSubscribe.id
  http_method      = "POST"
  authorization    = "NONE"
  api_key_required = true
}

resource "aws_api_gateway_integration" "UserSubscribePost" {
  rest_api_id             = aws_api_gateway_rest_api.Main.id
  resource_id             = aws_api_gateway_resource.UserSubscribe.id
  http_method             = aws_api_gateway_method.UserSubscribePost.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.UserSubscribe.invoke_arn
}
