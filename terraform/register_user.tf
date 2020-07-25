resource "aws_iam_role" "RegisterUserRole" {
  name               = "RegisterUserRole"
  assume_role_policy = data.aws_iam_policy_document.lambda-assume-role-policy.json
}

data "aws_iam_policy_document" "RegisterUser" {
  statement {
    actions   = ["dynamodb:UpdateItem"]
    resources = [aws_dynamodb_table.Users.arn]
  }
  statement {
    actions = ["secretsmanager:GetSecretValue"]
    resources = [
      "arn:aws:secretsmanager:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:secret:prod/SignInWithApple/*",
      aws_secretsmanager_secret.ServerEncryptionKey.arn
    ]
  }
}

resource "aws_iam_policy" "RegisterUserRolePolicy" {
  name   = "RegisterUserRolePolicy"
  policy = data.aws_iam_policy_document.RegisterUser.json
}

resource "aws_iam_role_policy_attachment" "RegisterUserPolicy" {
  role       = aws_iam_role.RegisterUserRole.name
  policy_arn = aws_iam_policy.RegisterUserRolePolicy.arn
}

resource "aws_iam_role_policy_attachment" "RegisterUserPolicyLogging" {
  role       = aws_iam_role.RegisterUserRole.name
  policy_arn = aws_iam_policy.CommonLambdaLogging.arn
}

resource "aws_lambda_permission" "RegisterUser" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.RegisterUser.function_name
  principal     = "apigateway.amazonaws.com"
}

resource "aws_cloudwatch_log_group" "RegisterUser" {
  name              = "/aws/lambda/${aws_lambda_function.RegisterUser.function_name}"
  retention_in_days = 14
}

resource "aws_lambda_function" "RegisterUser" {
  description      = "Registers a new user"
  filename         = "./../build/artifacts/dist.zip"
  function_name    = "RegisterUser"
  role             = aws_iam_role.RegisterUserRole.arn
  handler          = "dist/main.handleRegisterUser"
  runtime          = "nodejs12.x"
  layers           = [aws_lambda_layer_version.NodeModules.arn]
  depends_on       = [aws_iam_role_policy_attachment.RegisterUserPolicy]
  source_code_hash = filebase64sha256("./../build/artifacts/dist.zip")

  environment {
    variables = {
      DynamoDBTable = aws_dynamodb_table.Users.arn
    }
  }
}

resource "aws_api_gateway_resource" "RegisterUser" {
  rest_api_id = aws_api_gateway_rest_api.Main.id
  parent_id   = aws_api_gateway_rest_api.Main.root_resource_id
  path_part   = "registerUser"
}

resource "aws_api_gateway_method" "RegisterUserPost" {
  rest_api_id      = aws_api_gateway_rest_api.Main.id
  resource_id      = aws_api_gateway_resource.RegisterUser.id
  http_method      = "POST"
  authorization    = "CUSTOM"
  authorizer_id    = aws_api_gateway_authorizer.CustomAuthorizer.id
  api_key_required = true
}

resource "aws_api_gateway_integration" "RegisterUserPost" {
  rest_api_id             = aws_api_gateway_rest_api.Main.id
  resource_id             = aws_api_gateway_resource.RegisterUser.id
  http_method             = aws_api_gateway_method.RegisterUserPost.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.RegisterUser.invoke_arn
}

resource "aws_dynamodb_table" "Users" {
  name           = "Users"
  billing_mode   = "PROVISIONED"
  read_capacity  = 5
  write_capacity = 5
  hash_key       = "userId"

  attribute {
    name = "userId"
    type = "S"
  }
}
