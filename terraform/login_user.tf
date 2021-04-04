resource "aws_iam_role" "LoginUserRole" {
  name               = "LoginUserRole"
  assume_role_policy = data.aws_iam_policy_document.lambda-assume-role-policy.json
}

data "aws_iam_policy_document" "LoginUser" {
  statement {
    actions = ["secretsmanager:GetSecretValue"]
    resources = [
      "arn:aws:secretsmanager:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:secret:prod/SignInWithApple/*",
      aws_secretsmanager_secret.PrivateEncryptionKey.arn
    ]
  }
  statement {
    actions   = ["dynamodb:Scan"]
    resources = [aws_dynamodb_table.Users.arn]
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

data "archive_file" "LoginUser" {
  type        = "zip"
  source_file = "./../build/lambdas/LoginUser.js"
  output_path = "./../build/lambdas/LoginUser.zip"
}

resource "aws_lambda_function" "LoginUser" {
  description      = "A lambda function that lists files in S3."
  function_name    = "LoginUser"
  role             = aws_iam_role.LoginUserRole.arn
  handler          = "LoginUser.handleLoginUser"
  runtime          = "nodejs12.x"
  depends_on       = [aws_iam_role_policy_attachment.LoginUserPolicy]
  filename         = data.archive_file.LoginUser.output_path
  source_code_hash = data.archive_file.LoginUser.output_base64sha256

  environment {
    variables = {
      Bucket                = aws_s3_bucket.Files.id
      DynamoDBTableUsers    = aws_dynamodb_table.Users.name
      EncryptionKeySecretId = aws_secretsmanager_secret.PrivateEncryptionKey.name
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

resource "aws_secretsmanager_secret" "PrivateEncryptionKey" {
  name                    = "PrivateEncryptionKey"
  description             = "The secret for generating/validating server-issued JWTs."
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "PrivateEncryptionKey" {
  secret_id     = aws_secretsmanager_secret.PrivateEncryptionKey.id
  secret_string = random_password.PrivateEncryptionKey.result
}

resource "random_password" "PrivateEncryptionKey" {
  length  = 50
  special = true
}
