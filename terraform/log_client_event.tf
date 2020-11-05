resource "aws_iam_role" "LogClientEventRole" {
  name               = "LogClientEventRole"
  assume_role_policy = data.aws_iam_policy_document.lambda-assume-role-policy.json
}

resource "aws_iam_role_policy_attachment" "LogClientEventPolicyLogging" {
  role       = aws_iam_role.LogClientEventRole.name
  policy_arn = aws_iam_policy.CommonLambdaLogging.arn
}

resource "aws_lambda_permission" "LogClientEvent" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.LogClientEvent.function_name
  principal     = "apigateway.amazonaws.com"
}

resource "aws_cloudwatch_log_group" "LogClientEvent" {
  name              = "/aws/lambda/${aws_lambda_function.LogClientEvent.function_name}"
  retention_in_days = 14
}

resource "aws_lambda_function" "LogClientEvent" {
  description      = "Records an event from a client environment (e.g. App or Web)."
  filename         = "./../build/artifacts/dist.zip"
  function_name    = "LogClientEvent"
  role             = aws_iam_role.LogClientEventRole.arn
  handler          = "dist/main.handleClientEvent"
  runtime          = "nodejs12.x"
  layers           = [aws_lambda_layer_version.NodeModules.arn]
  depends_on       = [aws_iam_role_policy_attachment.LogClientEventPolicyLogging]
  source_code_hash = filebase64sha256("./../build/artifacts/dist.zip")
}

resource "aws_api_gateway_resource" "LogEvent" {
  rest_api_id = aws_api_gateway_rest_api.Main.id
  parent_id   = aws_api_gateway_rest_api.Main.root_resource_id
  path_part   = "logEvent"
}

resource "aws_api_gateway_method" "LogClientEventPost" {
  rest_api_id      = aws_api_gateway_rest_api.Main.id
  resource_id      = aws_api_gateway_resource.LogEvent.id
  http_method      = "POST"
  authorization    = "NONE"
  api_key_required = true
}

resource "aws_api_gateway_integration" "LogClientEventPost" {
  rest_api_id             = aws_api_gateway_rest_api.Main.id
  resource_id             = aws_api_gateway_resource.LogEvent.id
  http_method             = aws_api_gateway_method.LogClientEventPost.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.LogClientEvent.invoke_arn
}
