resource "aws_iam_role" "CustomAuthorizerInvocationRole" {
  name = "CustomAuthorizerInvocationRole"
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

resource "aws_iam_role_policy" "CustomAuthorizerInvocationPolicy" {
  name = "CustomAuthorizerInvocationPolicy"
  role = aws_iam_role.CustomAuthorizerInvocationRole.id

  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "lambda:InvokeFunction",
      "Effect": "Allow",
      "Resource": "${aws_lambda_function.CustomAuthorizer.arn}"
    }
  ]
}
EOF
}

resource "aws_iam_role" "CustomAuthorizer" {
  name = "CustomAuthorizer"
  assume_role_policy = data.aws_iam_policy_document.lambda-assume-role-policy.json
}

resource "aws_cloudwatch_log_group" "CustomAuthorizer" {
  name              = "/aws/lambda/${aws_lambda_function.CustomAuthorizer.function_name}"
  retention_in_days = 14
}

resource "aws_iam_role_policy_attachment" "CustomAuthorizerPolicyLogging" {
  role       = aws_iam_role.CustomAuthorizer.name
  policy_arn = aws_iam_policy.lambda_logging.arn
}

resource "aws_iam_role_policy_attachment" "CustomAuthorizerPolicy" {
  role       = aws_iam_role.CustomAuthorizer.name
  policy_arn = aws_iam_policy.CustomAuthorizerRolePolicy.arn
}

resource "aws_lambda_function" "CustomAuthorizer" {
  description   = "The function that handles authorization for the API Gateway."
  filename      = "./../build/artifacts/dist.zip"
  function_name = "AuthorizationFunction"
  role          = aws_iam_role.CustomAuthorizer.arn
  handler       = "dist/main.handleAuthorization"
  runtime       = "nodejs12.x"
  layers        = [aws_lambda_layer_version.lambda_layer.arn]
  depends_on    = [
    aws_iam_role_policy_attachment.CustomAuthorizerPolicy,
    aws_iam_role_policy_attachment.CustomAuthorizerPolicyLogging
  ]
  source_code_hash = filebase64sha256("./../build/artifacts/dist.zip")
  timeout = 300

  environment {
    variables = {
      ApiKeyID = aws_api_gateway_api_key.iOSApiKey.arn
    }
  }
}

resource "aws_lambda_permission" "CustomAuthorizer" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.CustomAuthorizer.function_name
  principal     = "apigateway.amazonaws.com"
}

resource "aws_api_gateway_authorizer" "CustomAuthorizer" {
  name                             = "CustomAuthorizer"
  rest_api_id                      = aws_api_gateway_rest_api.MyApi.id
  authorizer_uri                   = aws_lambda_function.CustomAuthorizer.invoke_arn
  authorizer_result_ttl_in_seconds = 0
  authorizer_credentials           = aws_iam_role.CustomAuthorizerInvocationRole.arn
  type                             = "REQUEST"
  identity_source                  = "method.request.querystring.ApiKey"
}
