resource "aws_iam_role" "RegisterUserRole" {
  name               = "RegisterUserRole"
  assume_role_policy = data.aws_iam_policy_document.LambdaGatewayAssumeRole.json
}

data "aws_iam_policy_document" "RegisterUser" {
  # Better Auth adapter needs full CRUD on base table for user/session/account/verification
  statement {
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:Query"
    ]
    resources = [
      aws_dynamodb_table.MediaDownloader.arn,
      "${aws_dynamodb_table.MediaDownloader.arn}/index/*"
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

resource "aws_iam_role_policy_attachment" "RegisterUserPolicyXRay" {
  role       = aws_iam_role.RegisterUserRole.name
  policy_arn = aws_iam_policy.CommonLambdaXRay.arn
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

data "archive_file" "RegisterUser" {
  type        = "zip"
  source_file = "./../build/lambdas/RegisterUser.mjs"
  output_path = "./../build/lambdas/RegisterUser.zip"
}

resource "aws_lambda_function" "RegisterUser" {
  description      = "Registers a new user"
  function_name    = "RegisterUser"
  role             = aws_iam_role.RegisterUserRole.arn
  handler          = "RegisterUser.handler"
  runtime          = "nodejs24.x"
  timeout          = 10
  depends_on       = [aws_iam_role_policy_attachment.RegisterUserPolicy]
  filename         = data.archive_file.RegisterUser.output_path
  source_code_hash = data.archive_file.RegisterUser.output_base64sha256
  layers           = [local.adot_layer_arn]

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      APPLICATION_URL             = "https://${aws_api_gateway_rest_api.Main.id}.execute-api.${data.aws_region.current.id}.amazonaws.com/prod"
      DYNAMODB_TABLE_NAME         = aws_dynamodb_table.MediaDownloader.name
      SIGN_IN_WITH_APPLE_CONFIG   = data.sops_file.secrets.data["signInWithApple.config"]
      BETTER_AUTH_SECRET          = data.sops_file.secrets.data["platform.key"]
      OTEL_SERVICE_NAME           = "RegisterUser"
      OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318"
      OTEL_PROPAGATORS            = "xray"
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
  authorization    = "NONE"
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

