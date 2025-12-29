locals {
  login_user_function_name = "${local.name_prefix}-LoginUser"
}

resource "aws_iam_role" "LoginUser" {
  name               = "${local.name_prefix}-LoginUserRole"
  assume_role_policy = data.aws_iam_policy_document.LambdaGatewayAssumeRole.json
  tags               = local.common_tags
}

resource "aws_iam_role_policy_attachment" "LoginUserLogging" {
  role       = aws_iam_role.LoginUser.name
  policy_arn = aws_iam_policy.CommonLambdaLogging.arn
}

resource "aws_iam_role_policy_attachment" "LoginUserXRay" {
  role       = aws_iam_role.LoginUser.name
  policy_arn = aws_iam_policy.CommonLambdaXRay.arn
}

resource "aws_iam_role_policy_attachment" "LoginUserDSQL" {
  role       = aws_iam_role.LoginUser.name
  policy_arn = aws_iam_policy.LambdaDSQLAccess.arn
}

resource "aws_lambda_permission" "LoginUser" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.LoginUser.function_name
  principal     = "apigateway.amazonaws.com"
}

resource "aws_cloudwatch_log_group" "LoginUser" {
  name              = "/aws/lambda/${aws_lambda_function.LoginUser.function_name}"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

data "archive_file" "LoginUser" {
  type        = "zip"
  source_dir  = "./../build/lambdas/LoginUser"
  output_path = "./../build/lambdas/LoginUser.zip"
}

resource "aws_lambda_function" "LoginUser" {
  description      = "A lambda function that lists files in S3."
  function_name    = local.login_user_function_name
  role             = aws_iam_role.LoginUser.arn
  handler          = "index.handler"
  runtime          = "nodejs24.x"
  timeout          = 30
  depends_on       = [aws_iam_role_policy_attachment.LoginUserLogging]
  filename         = data.archive_file.LoginUser.output_path
  source_code_hash = data.archive_file.LoginUser.output_base64sha256
  layers           = [local.adot_layer_arn]

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = merge(local.common_lambda_env, {
      APPLICATION_URL           = "https://${aws_api_gateway_rest_api.Main.id}.execute-api.${data.aws_region.current.id}.amazonaws.com/${var.api_stage_name}"
      SIGN_IN_WITH_APPLE_CONFIG = data.sops_file.secrets.data["signInWithApple.config"]
      BETTER_AUTH_SECRET        = data.sops_file.secrets.data["platform.key"]
      OTEL_SERVICE_NAME         = local.login_user_function_name
    })
  }

  tags = merge(local.common_tags, {
    Name = local.login_user_function_name
  })
}

resource "aws_api_gateway_resource" "UserLogin" {
  rest_api_id = aws_api_gateway_rest_api.Main.id
  parent_id   = aws_api_gateway_resource.User.id
  path_part   = "login"
}

resource "aws_api_gateway_method" "LoginUserPost" {
  rest_api_id      = aws_api_gateway_rest_api.Main.id
  resource_id      = aws_api_gateway_resource.UserLogin.id
  http_method      = "POST"
  authorization    = "NONE"
  api_key_required = true
}

resource "aws_api_gateway_integration" "LoginUserPost" {
  rest_api_id             = aws_api_gateway_rest_api.Main.id
  resource_id             = aws_api_gateway_resource.UserLogin.id
  http_method             = aws_api_gateway_method.LoginUserPost.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.LoginUser.invoke_arn
}
