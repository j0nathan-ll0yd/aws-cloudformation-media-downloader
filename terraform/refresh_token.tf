resource "aws_iam_role" "RefreshTokenRole" {
  name               = "RefreshTokenRole"
  assume_role_policy = data.aws_iam_policy_document.LambdaGatewayAssumeRole.json
}

data "aws_iam_policy_document" "RefreshToken" {
  # Better Auth session refresh requires GetItem/UpdateItem/Query on sessions
  statement {
    actions = [
      "dynamodb:GetItem",
      "dynamodb:UpdateItem",
      "dynamodb:Query"
    ]
    resources = [
      aws_dynamodb_table.MediaDownloader.arn,
      "${aws_dynamodb_table.MediaDownloader.arn}/index/*"
    ]
  }
}

resource "aws_iam_policy" "RefreshTokenRolePolicy" {
  name   = "RefreshTokenRolePolicy"
  policy = data.aws_iam_policy_document.RefreshToken.json
}

resource "aws_iam_role_policy_attachment" "RefreshTokenPolicy" {
  role       = aws_iam_role.RefreshTokenRole.name
  policy_arn = aws_iam_policy.RefreshTokenRolePolicy.arn
}

resource "aws_iam_role_policy_attachment" "RefreshTokenPolicyLogging" {
  role       = aws_iam_role.RefreshTokenRole.name
  policy_arn = aws_iam_policy.CommonLambdaLogging.arn
}

resource "aws_iam_role_policy_attachment" "RefreshTokenPolicyXRay" {
  role       = aws_iam_role.RefreshTokenRole.name
  policy_arn = aws_iam_policy.CommonLambdaXRay.arn
}

resource "aws_lambda_permission" "RefreshToken" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.RefreshToken.function_name
  principal     = "apigateway.amazonaws.com"
}

resource "aws_cloudwatch_log_group" "RefreshToken" {
  name              = "/aws/lambda/${aws_lambda_function.RefreshToken.function_name}"
  retention_in_days = 14
}

data "archive_file" "RefreshToken" {
  type        = "zip"
  source_dir  = "./../build/lambdas/RefreshToken"
  output_path = "./../build/lambdas/RefreshToken.zip"
}

resource "aws_lambda_function" "RefreshToken" {
  description      = "Refreshes a user session by extending the expiration time"
  function_name    = "RefreshToken"
  role             = aws_iam_role.RefreshTokenRole.arn
  handler          = "index.handler"
  runtime          = "nodejs24.x"
  timeout          = 30
  depends_on       = [aws_iam_role_policy_attachment.RefreshTokenPolicy]
  filename         = data.archive_file.RefreshToken.output_path
  source_code_hash = data.archive_file.RefreshToken.output_base64sha256
  layers           = [local.adot_layer_arn]

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = merge(local.common_lambda_env, {
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.MediaDownloader.name
      OTEL_SERVICE_NAME   = "RefreshToken"
    })
  }
}

resource "aws_api_gateway_resource" "RefreshToken" {
  rest_api_id = aws_api_gateway_rest_api.Main.id
  parent_id   = aws_api_gateway_rest_api.Main.root_resource_id
  path_part   = "refresh"
}

resource "aws_api_gateway_method" "RefreshTokenPost" {
  rest_api_id      = aws_api_gateway_rest_api.Main.id
  resource_id      = aws_api_gateway_resource.RefreshToken.id
  http_method      = "POST"
  authorization    = "CUSTOM"
  authorizer_id    = aws_api_gateway_authorizer.ApiGatewayAuthorizer.id
  api_key_required = true
}

resource "aws_api_gateway_integration" "RefreshTokenPost" {
  rest_api_id             = aws_api_gateway_rest_api.Main.id
  resource_id             = aws_api_gateway_resource.RefreshToken.id
  http_method             = aws_api_gateway_method.RefreshTokenPost.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.RefreshToken.invoke_arn
}
