resource "aws_iam_role" "LoginUserRole" {
  name               = "LoginUserRole"
  assume_role_policy = data.aws_iam_policy_document.LambdaGatewayAssumeRole.json
}

data "aws_iam_policy_document" "LoginUser" {
  # Better Auth adapter needs full CRUD on base table for user/session/account/verification
  statement {
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:Query",
      "dynamodb:Scan"
    ]
    resources = [
      aws_dynamodb_table.MediaDownloader.arn,
      "${aws_dynamodb_table.MediaDownloader.arn}/index/*"
    ]
  }
}

resource "aws_iam_policy" "LoginUserRolePolicy" {
  name   = "LoginUserRolePolicy"
  policy = data.aws_iam_policy_document.LoginUser.json
}

resource "aws_iam_role_policy_attachment" "LoginUserPolicy" {
  role       = aws_iam_role.LoginUserRole.name
  policy_arn = aws_iam_policy.LoginUserRolePolicy.arn
}

resource "aws_iam_role_policy_attachment" "LoginUserPolicyLogging" {
  role       = aws_iam_role.LoginUserRole.name
  policy_arn = aws_iam_policy.CommonLambdaLogging.arn
}

resource "aws_iam_role_policy_attachment" "LoginUserPolicyXRay" {
  role       = aws_iam_role.LoginUserRole.name
  policy_arn = aws_iam_policy.CommonLambdaXRay.arn
}

resource "aws_lambda_permission" "LoginUser" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.LoginUser.function_name
  principal     = "apigateway.amazonaws.com"
}

resource "aws_cloudwatch_log_group" "LoginUser" {
  name              = "/aws/lambda/${aws_lambda_function.LoginUser.function_name}"
  retention_in_days = 14
}

data "archive_file" "LoginUser" {
  type        = "zip"
  source_file = "./../build/lambdas/LoginUser.mjs"
  output_path = "./../build/lambdas/LoginUser.zip"
}

resource "aws_lambda_function" "LoginUser" {
  description      = "A lambda function that lists files in S3."
  function_name    = "LoginUser"
  role             = aws_iam_role.LoginUserRole.arn
  handler          = "LoginUser.handler"
  runtime          = "nodejs24.x"
  timeout          = 30
  depends_on       = [aws_iam_role_policy_attachment.LoginUserPolicy]
  filename         = data.archive_file.LoginUser.output_path
  source_code_hash = data.archive_file.LoginUser.output_base64sha256
  layers           = [local.adot_layer_arn]

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = merge(local.common_lambda_env, {
      APPLICATION_URL           = "https://${aws_api_gateway_rest_api.Main.id}.execute-api.${data.aws_region.current.id}.amazonaws.com/prod"
      DYNAMODB_TABLE_NAME       = aws_dynamodb_table.MediaDownloader.name
      SIGN_IN_WITH_APPLE_CONFIG = data.sops_file.secrets.data["signInWithApple.config"]
      BETTER_AUTH_SECRET        = data.sops_file.secrets.data["platform.key"]
      OTEL_SERVICE_NAME         = "LoginUser"
    })
  }
}

resource "aws_api_gateway_resource" "Login" {
  rest_api_id = aws_api_gateway_rest_api.Main.id
  parent_id   = aws_api_gateway_rest_api.Main.root_resource_id
  path_part   = "login"
}

resource "aws_api_gateway_method" "LoginUserPost" {
  rest_api_id      = aws_api_gateway_rest_api.Main.id
  resource_id      = aws_api_gateway_resource.Login.id
  http_method      = "POST"
  authorization    = "NONE"
  api_key_required = true
}

resource "aws_api_gateway_integration" "LoginUserPost" {
  rest_api_id             = aws_api_gateway_rest_api.Main.id
  resource_id             = aws_api_gateway_resource.Login.id
  http_method             = aws_api_gateway_method.LoginUserPost.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.LoginUser.invoke_arn
}
