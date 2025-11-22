resource "aws_iam_role" "LoginUserRole" {
  name               = "LoginUserRole"
  assume_role_policy = data.aws_iam_policy_document.LambdaGatewayAssumeRole.json
}

data "aws_iam_policy_document" "LoginUser" {
  # Scan base table to find user by Apple ID (no GSI for nested field)
  statement {
    actions   = ["dynamodb:Scan"]
    resources = [aws_dynamodb_table.MediaDownloader.arn]
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
  source_file = "./../build/lambdas/LoginUser.js"
  output_path = "./../build/lambdas/LoginUser.zip"
}

resource "aws_lambda_function" "LoginUser" {
  description      = "A lambda function that lists files in S3."
  function_name    = "LoginUser"
  role             = aws_iam_role.LoginUserRole.arn
  handler          = "LoginUser.handler"
  runtime          = "nodejs22.x"
  timeout          = 30
  depends_on       = [aws_iam_role_policy_attachment.LoginUserPolicy]
  filename         = data.archive_file.LoginUser.output_path
  source_code_hash = data.archive_file.LoginUser.output_base64sha256

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      DynamoDBTableName      = aws_dynamodb_table.MediaDownloader.name
      PlatformEncryptionKey  = data.sops_file.secrets.data["platform.key"]
      SignInWithAppleConfig  = data.sops_file.secrets.data["signInWithApple.config"]
      SignInWithAppleAuthKey = data.sops_file.secrets.data["signInWithApple.authKey"]
    }
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
