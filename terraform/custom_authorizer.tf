resource "aws_iam_role" "invocation_role" {
  name = "api_gateway_auth_invocation"
  path = "/"

  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "sts:AssumeRole",
      "Principal": {
        "Service": ["apigateway.amazonaws.com", "lambda.amazonaws.com"]
      },
      "Effect": "Allow",
      "Sid": ""
    }
  ]
}
EOF
}

resource "aws_iam_role_policy" "invocation_policy" {
  name = "default"
  role = aws_iam_role.invocation_role.id

  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "lambda:InvokeFunction",
      "Effect": "Allow",
      "Resource": "${aws_lambda_function.AuthorizationFunction.arn}"
    }
  ]
}
EOF
}

resource "aws_iam_role" "AuthorizationFunctionRole" {
  name = "AuthorizationFunctionRole"
  assume_role_policy = data.aws_iam_policy_document.lambda-assume-role-policy.json
}

resource "aws_cloudwatch_log_group" "AuthorizationFunction" {
  name              = "/aws/lambda/${aws_lambda_function.AuthorizationFunction.function_name}"
  retention_in_days = 14
}

resource "aws_iam_role_policy_attachment" "AuthorizationFunctionRolePolicyAttachment1" {
  role       = aws_iam_role.AuthorizationFunctionRole.name
  policy_arn = aws_iam_policy.lambda_logging.arn
}

resource "aws_iam_role_policy_attachment" "apigateway_keys" {
  role       = aws_iam_role.AuthorizationFunctionRole.name
  policy_arn = aws_iam_policy.AuthorizationFunctionRolePolicy.arn
}

resource "aws_lambda_function" "AuthorizationFunction" {
  description   = "The function that handles authorization for the API Gateway."
  filename      = "./../build/artifacts/dist.zip"
  function_name = "AuthorizationFunction"
  role          = aws_iam_role.AuthorizationFunctionRole.arn
  handler       = "dist/main.handleAuthorization"
  runtime       = "nodejs12.x"
  layers        = [aws_lambda_layer_version.lambda_layer.arn]
  depends_on    = [aws_iam_role_policy_attachment.AuthorizationFunctionRolePolicyAttachment1]
  source_code_hash = filebase64sha256("./../build/artifacts/dist.zip")
  timeout = 300

  environment {
    variables = {
      ApiKeyID = aws_api_gateway_api_key.iOSApiKey.arn
    }
  }
}

resource "aws_lambda_permission" "apigw_lambda" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.AuthorizationFunction.function_name
  principal     = "apigateway.amazonaws.com"
}

resource "aws_api_gateway_authorizer" "MyAuthorizer" {
  name                             = "DefaultAuthorizer"
  rest_api_id                      = aws_api_gateway_rest_api.MyApi.id
  authorizer_uri                   = aws_lambda_function.AuthorizationFunction.invoke_arn
  authorizer_result_ttl_in_seconds = 0
  authorizer_credentials           = aws_iam_role.invocation_role.arn
  type                             = "REQUEST"
  identity_source                  = "method.request.querystring.ApiKey"
}
