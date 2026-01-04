locals {
  device_event_function_name = "DeviceEvent"
}

resource "aws_iam_role" "DeviceEvent" {
  name               = local.device_event_function_name
  assume_role_policy = data.aws_iam_policy_document.LambdaGatewayAssumeRole.json
  tags               = local.common_tags
}

resource "aws_iam_role_policy" "DeviceEventLogging" {
  name = "DeviceEventLogging"
  role = aws_iam_role.DeviceEvent.id
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
        "arn:aws:logs:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.device_event_function_name}",
        "arn:aws:logs:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.device_event_function_name}:*"
      ]
    }]
  })
}

resource "aws_iam_role_policy_attachment" "DeviceEventXRay" {
  role       = aws_iam_role.DeviceEvent.name
  policy_arn = aws_iam_policy.CommonLambdaXRay.arn
}

resource "aws_lambda_permission" "DeviceEvent" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.DeviceEvent.function_name
  principal     = "apigateway.amazonaws.com"
}

resource "aws_cloudwatch_log_group" "DeviceEvent" {
  name              = "/aws/lambda/${aws_lambda_function.DeviceEvent.function_name}"
  retention_in_days = 7
  tags              = local.common_tags
}

data "archive_file" "DeviceEvent" {
  type        = "zip"
  source_dir  = "./../build/lambdas/DeviceEvent"
  output_path = "./../build/lambdas/DeviceEvent.zip"
}

resource "aws_lambda_function" "DeviceEvent" {
  description      = "Records an event from a client environment (e.g. App or Web)."
  function_name    = local.device_event_function_name
  role             = aws_iam_role.DeviceEvent.arn
  handler          = "index.handler"
  runtime          = "nodejs24.x"
  architectures    = [local.lambda_architecture]
  depends_on       = [aws_iam_role_policy.DeviceEventLogging]
  filename         = data.archive_file.DeviceEvent.output_path
  source_code_hash = data.archive_file.DeviceEvent.output_base64sha256
  layers           = [local.adot_layer_arn]

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = merge(local.common_lambda_env, {
      OTEL_SERVICE_NAME = local.device_event_function_name
    })
  }

  tags = merge(local.common_tags, {
    Name = local.device_event_function_name
  })
}

resource "aws_api_gateway_resource" "DeviceEvent" {
  rest_api_id = aws_api_gateway_rest_api.Main.id
  parent_id   = aws_api_gateway_resource.Device.id
  path_part   = "event"
}

resource "aws_api_gateway_method" "DeviceEventPost" {
  rest_api_id      = aws_api_gateway_rest_api.Main.id
  resource_id      = aws_api_gateway_resource.DeviceEvent.id
  http_method      = "POST"
  authorization    = "NONE"
  api_key_required = true
}

resource "aws_api_gateway_integration" "DeviceEventPost" {
  rest_api_id             = aws_api_gateway_rest_api.Main.id
  resource_id             = aws_api_gateway_resource.DeviceEvent.id
  http_method             = aws_api_gateway_method.DeviceEventPost.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.DeviceEvent.invoke_arn
}
