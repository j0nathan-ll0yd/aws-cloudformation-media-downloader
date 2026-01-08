locals {
  register_user_function_name = "RegisterUser"
}

resource "aws_iam_role" "RegisterUser" {
  name               = local.register_user_function_name
  assume_role_policy = data.aws_iam_policy_document.LambdaGatewayAssumeRole.json
  tags               = local.common_tags
}

resource "aws_iam_role_policy" "RegisterUserLogging" {
  name = "RegisterUserLogging"
  role = aws_iam_role.RegisterUser.id
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
        "arn:aws:logs:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.register_user_function_name}",
        "arn:aws:logs:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.register_user_function_name}:*"
      ]
    }]
  })
}

resource "aws_iam_role_policy_attachment" "RegisterUserXRay" {
  role       = aws_iam_role.RegisterUser.name
  policy_arn = aws_iam_policy.CommonLambdaXRay.arn
}

resource "aws_iam_role_policy_attachment" "RegisterUserDSQL" {
  role       = aws_iam_role.RegisterUser.name
  policy_arn = aws_iam_policy.LambdaDSQLReadWrite.arn
}

resource "aws_lambda_permission" "RegisterUser" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.RegisterUser.function_name
  principal     = "apigateway.amazonaws.com"
}

resource "aws_cloudwatch_log_group" "RegisterUser" {
  name              = "/aws/lambda/${aws_lambda_function.RegisterUser.function_name}"
  retention_in_days = 7
  tags              = local.common_tags
}

data "archive_file" "RegisterUser" {
  type        = "zip"
  source_dir  = "./../build/lambdas/RegisterUser"
  output_path = "./../build/lambdas/RegisterUser.zip"
}

resource "aws_lambda_function" "RegisterUser" {
  description      = "Registers a new user"
  function_name    = local.register_user_function_name
  role             = aws_iam_role.RegisterUser.arn
  handler          = "index.handler"
  runtime          = "nodejs24.x"
  architectures    = [local.lambda_architecture]
  timeout          = local.default_lambda_timeout
  depends_on       = [aws_iam_role_policy.RegisterUserLogging]
  filename         = data.archive_file.RegisterUser.output_path
  source_code_hash = data.archive_file.RegisterUser.output_base64sha256
  layers           = [local.adot_layer_arn]

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = merge(local.common_lambda_env, {
      APPLICATION_URL           = "https://${aws_api_gateway_rest_api.Main.id}.execute-api.${data.aws_region.current.id}.amazonaws.com/prod"
      SIGN_IN_WITH_APPLE_CONFIG = data.sops_file.secrets.data["signInWithApple.config"]
      BETTER_AUTH_SECRET        = data.sops_file.secrets.data["platform.key"]
      OTEL_SERVICE_NAME         = local.register_user_function_name
      DSQL_ACCESS_LEVEL         = "readwrite"
    })
  }

  tags = merge(local.common_tags, {
    Name = local.register_user_function_name
  })
}

resource "aws_api_gateway_resource" "UserRegister" {
  rest_api_id = aws_api_gateway_rest_api.Main.id
  parent_id   = aws_api_gateway_resource.User.id
  path_part   = "register"
}

resource "aws_api_gateway_method" "RegisterUserPost" {
  rest_api_id      = aws_api_gateway_rest_api.Main.id
  resource_id      = aws_api_gateway_resource.UserRegister.id
  http_method      = "POST"
  authorization    = "NONE"
  api_key_required = true
}

resource "aws_api_gateway_integration" "RegisterUserPost" {
  rest_api_id             = aws_api_gateway_rest_api.Main.id
  resource_id             = aws_api_gateway_resource.UserRegister.id
  http_method             = aws_api_gateway_method.RegisterUserPost.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.RegisterUser.invoke_arn
}

