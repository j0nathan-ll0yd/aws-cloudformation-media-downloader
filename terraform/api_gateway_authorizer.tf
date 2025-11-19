resource "aws_iam_role" "ApiGatewayAuthorizer" {
  name               = "ApiGatewayAuthorizer"
  assume_role_policy = data.aws_iam_policy_document.LambdaGatewayAssumeRole.json
}

data "aws_iam_policy_document" "ApiGatewayAuthorizer" {
  statement {
    actions   = ["lambda:InvokeFunction"]
    resources = [aws_lambda_function.ApiGatewayAuthorizer.arn]
  }
}

resource "aws_iam_role_policy" "ApiGatewayAuthorize" {
  name   = "ApiGatewayAuthorizerInvocationPolicy"
  role   = aws_iam_role.ApiGatewayAuthorizer.id
  policy = data.aws_iam_policy_document.ApiGatewayAuthorizer.json
}

resource "aws_cloudwatch_log_group" "ApiGatewayAuthorizer" {
  name              = "/aws/lambda/${aws_lambda_function.ApiGatewayAuthorizer.function_name}"
  retention_in_days = 14
}

resource "aws_iam_role_policy_attachment" "ApiGatewayAuthorizerPolicyLogging" {

resource "aws_iam_role_policy_attachment" "ApiGatewayAuthorizerPolicyXRay" {
  role       = aws_iam_role.ApiGatewayAuthorizerRole.name
  policy_arn = aws_iam_policy.CommonLambdaXRay.arn
}
  role       = aws_iam_role.ApiGatewayAuthorizer.name

resource "aws_iam_role_policy_attachment" "ApiGatewayAuthorizerPolicyXRay" {
  role       = aws_iam_role.ApiGatewayAuthorizerRole.name
  policy_arn = aws_iam_policy.CommonLambdaXRay.arn
}
  policy_arn = aws_iam_policy.CommonLambdaLogging.arn

resource "aws_iam_role_policy_attachment" "ApiGatewayAuthorizerPolicyXRay" {
  role       = aws_iam_role.ApiGatewayAuthorizerRole.name
  policy_arn = aws_iam_policy.CommonLambdaXRay.arn
}
}

resource "aws_iam_role_policy_attachment" "ApiGatewayAuthorizerPolicyXRay" {
  role       = aws_iam_role.ApiGatewayAuthorizerRole.name
  policy_arn = aws_iam_policy.CommonLambdaXRay.arn
}

data "aws_iam_policy_document" "ApiGatewayAuthorizerRolePolicy" {
  statement {
    actions = ["apigateway:GET"]
    resources = [
      "arn:aws:apigateway:${data.aws_region.current.id}::/apikeys",
      "arn:aws:apigateway:${data.aws_region.current.id}::/apikeys/*",
      "arn:aws:apigateway:${data.aws_region.current.id}::/usageplans",
      "arn:aws:apigateway:${data.aws_region.current.id}::/usageplans/*/usage"
    ]
  }
}

resource "aws_iam_policy" "ApiGatewayAuthorizerRolePolicy" {
  name   = "ApiGatewayAuthorizerRolePolicy"
  policy = data.aws_iam_policy_document.ApiGatewayAuthorizerRolePolicy.json
}

resource "aws_iam_role_policy_attachment" "ApiGatewayAuthorizerPolicy" {
  role       = aws_iam_role.ApiGatewayAuthorizer.name
  policy_arn = aws_iam_policy.ApiGatewayAuthorizerRolePolicy.arn
}

resource "aws_lambda_function" "ApiGatewayAuthorizer" {
  description   = "The function that handles authorization for the API Gateway."
  function_name = "ApiGatewayAuthorizer"
  role          = aws_iam_role.ApiGatewayAuthorizer.arn
  handler       = "ApiGatewayAuthorizer.handler"
  runtime       = "nodejs22.x"
  depends_on = [
    aws_iam_role_policy_attachment.ApiGatewayAuthorizerPolicy,
    aws_iam_role_policy_attachment.ApiGatewayAuthorizerPolicyLogging
  ]
  filename         = data.archive_file.ApiGatewayAuthorizer.output_path
  source_code_hash = data.archive_file.ApiGatewayAuthorizer.output_base64sha256

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      PlatformEncryptionKey = data.sops_file.secrets.data["platform.key"]
      MultiAuthenticationPathParts = join(",", [
        aws_api_gateway_resource.RegisterDevice.path_part,
        aws_api_gateway_resource.Files.path_part,
        aws_api_gateway_resource.LogEvent.path_part
      ]),
      ReservedClientIp = "104.1.88.244"
    }
  }
}

data "archive_file" "ApiGatewayAuthorizer" {
  type        = "zip"
  source_file = "./../build/lambdas/ApiGatewayAuthorizer.js"
  output_path = "./../build/lambdas/ApiGatewayAuthorizer.zip"
}

resource "aws_lambda_permission" "ApiGatewayAuthorizer" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ApiGatewayAuthorizer.function_name
  principal     = "apigateway.amazonaws.com"
}

resource "aws_api_gateway_authorizer" "ApiGatewayAuthorizer" {
  name                             = "ApiGatewayAuthorizer"
  rest_api_id                      = aws_api_gateway_rest_api.Main.id
  authorizer_uri                   = aws_lambda_function.ApiGatewayAuthorizer.invoke_arn
  authorizer_result_ttl_in_seconds = 0
  authorizer_credentials           = aws_iam_role.ApiGatewayAuthorizer.arn
  type                             = "REQUEST"
  identity_source                  = "method.request.querystring.ApiKey"
}
