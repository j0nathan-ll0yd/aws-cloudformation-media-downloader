resource "aws_iam_role" "LoginUserRole" {
  name               = "LoginUserRole"
  assume_role_policy = data.aws_iam_policy_document.lambda-assume-role-policy.json
}

data "aws_iam_policy_document" "LoginUser" {
  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.ServerPrivateKey.arn]
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

resource "aws_lambda_permission" "LoginUser" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.LoginUser.function_name
  principal     = "apigateway.amazonaws.com"
}

resource "aws_cloudwatch_log_group" "LoginUser" {
  name              = "/aws/lambda/${aws_lambda_function.LoginUser.function_name}"
  retention_in_days = 14
}

resource "aws_lambda_function" "LoginUser" {
  description      = "A lambda function that lists files in S3."
  filename         = "./../build/artifacts/dist.zip"
  function_name    = "LoginUser"
  role             = aws_iam_role.LoginUserRole.arn
  handler          = "dist/main.handleLoginUser"
  runtime          = "nodejs12.x"
  layers           = [aws_lambda_layer_version.NodeModules.arn]
  depends_on       = [aws_iam_role_policy_attachment.LoginUserPolicy]
  source_code_hash = filebase64sha256("./../build/artifacts/dist.zip")

  environment {
    variables = {
      Bucket = aws_s3_bucket.Files.id
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
  authorization    = "CUSTOM"
  authorizer_id    = aws_api_gateway_authorizer.CustomAuthorizer.id
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

resource "aws_secretsmanager_secret" "ServerPrivateKey" {
  name        = "ServerPrivateKey"
  description = "The secret for generating/validating server-issued JWTs."
}

resource "aws_secretsmanager_secret_version" "ServerPrivateKey" {
  secret_id     = aws_secretsmanager_secret.ServerPrivateKey.id
  secret_string = random_password.ServerPrivateKey.result
}

resource "random_password" "ServerPrivateKey" {
  length  = 50
  special = true
}
