locals {
  logout_user_function_name = "LogoutUser"
}

resource "aws_iam_role" "LogoutUser" {
  name               = local.logout_user_function_name
  assume_role_policy = data.aws_iam_policy_document.LambdaGatewayAssumeRole.json
  tags               = local.common_tags
}

resource "aws_iam_role_policy" "LogoutUserLogging" {
  name = "LogoutUserLogging"
  role = aws_iam_role.LogoutUser.id
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
        "arn:aws:logs:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.logout_user_function_name}",
        "arn:aws:logs:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.logout_user_function_name}:*"
      ]
    }]
  })
}

resource "aws_iam_role_policy_attachment" "LogoutUserXRay" {
  role       = aws_iam_role.LogoutUser.name
  policy_arn = aws_iam_policy.CommonLambdaXRay.arn
}

# DSQL policy attachment handled by terraform/dsql_permissions.tf

resource "aws_lambda_permission" "LogoutUser" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.LogoutUser.function_name
  principal     = "apigateway.amazonaws.com"
}

resource "aws_cloudwatch_log_group" "LogoutUser" {
  name              = "/aws/lambda/${aws_lambda_function.LogoutUser.function_name}"
  retention_in_days = 7
  tags              = local.common_tags
}

data "archive_file" "LogoutUser" {
  type        = "zip"
  source_dir  = "./../build/lambdas/LogoutUser"
  output_path = "./../build/lambdas/LogoutUser.zip"
}

resource "aws_lambda_function" "LogoutUser" {
  description      = "Invalidates a user session by deleting it from the database"
  function_name    = local.logout_user_function_name
  role             = aws_iam_role.LogoutUser.arn
  handler          = "index.handler"
  runtime          = "nodejs24.x"
  architectures    = [local.lambda_architecture]
  timeout          = 30
  depends_on       = [aws_iam_role_policy.LogoutUserLogging]
  filename         = data.archive_file.LogoutUser.output_path
  source_code_hash = data.archive_file.LogoutUser.output_base64sha256
  layers           = [local.adot_layer_arn]

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = merge(local.common_lambda_env, {
      OTEL_SERVICE_NAME = local.logout_user_function_name
      DSQL_ROLE_NAME    = local.lambda_dsql_roles["LogoutUser"].role_name
    })
  }

  tags = merge(local.common_tags, {
    Name = local.logout_user_function_name
  })
}

resource "aws_api_gateway_resource" "UserLogout" {
  rest_api_id = aws_api_gateway_rest_api.Main.id
  parent_id   = aws_api_gateway_resource.User.id
  path_part   = "logout"
}

resource "aws_api_gateway_method" "LogoutUserPost" {
  rest_api_id      = aws_api_gateway_rest_api.Main.id
  resource_id      = aws_api_gateway_resource.UserLogout.id
  http_method      = "POST"
  authorization    = "CUSTOM"
  authorizer_id    = aws_api_gateway_authorizer.ApiGatewayAuthorizer.id
  api_key_required = true
}

resource "aws_api_gateway_integration" "LogoutUserPost" {
  rest_api_id             = aws_api_gateway_rest_api.Main.id
  resource_id             = aws_api_gateway_resource.UserLogout.id
  http_method             = aws_api_gateway_method.LogoutUserPost.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.LogoutUser.invoke_arn
}
