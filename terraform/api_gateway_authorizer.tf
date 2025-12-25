locals {
  api_gateway_authorizer_function_name = "ApiGatewayAuthorizer"
}

resource "aws_iam_role" "ApiGatewayAuthorizer" {
  name               = local.api_gateway_authorizer_function_name
  assume_role_policy = data.aws_iam_policy_document.LambdaGatewayAssumeRole.json
}

data "aws_iam_policy_document" "ApiGatewayAuthorizerInvocation" {
  statement {
    actions   = ["lambda:InvokeFunction"]
    resources = [aws_lambda_function.ApiGatewayAuthorizer.arn]
  }
}

resource "aws_iam_role_policy" "ApiGatewayAuthorizerInvocation" {
  name   = "ApiGatewayAuthorizerInvocation"
  role   = aws_iam_role.ApiGatewayAuthorizer.id
  policy = data.aws_iam_policy_document.ApiGatewayAuthorizerInvocation.json
}

resource "aws_cloudwatch_log_group" "ApiGatewayAuthorizer" {
  name              = "/aws/lambda/${aws_lambda_function.ApiGatewayAuthorizer.function_name}"
  retention_in_days = 14
}

resource "aws_iam_role_policy_attachment" "ApiGatewayAuthorizerLogging" {
  role       = aws_iam_role.ApiGatewayAuthorizer.name
  policy_arn = aws_iam_policy.CommonLambdaLogging.arn
}

resource "aws_iam_role_policy_attachment" "ApiGatewayAuthorizerXRay" {
  role       = aws_iam_role.ApiGatewayAuthorizer.name
  policy_arn = aws_iam_policy.CommonLambdaXRay.arn
}

data "aws_iam_policy_document" "ApiGatewayAuthorizer" {
  statement {
    actions = ["apigateway:GET"]
    resources = [
      "arn:aws:apigateway:${data.aws_region.current.id}::/apikeys",
      "arn:aws:apigateway:${data.aws_region.current.id}::/apikeys/*",
      "arn:aws:apigateway:${data.aws_region.current.id}::/usageplans",
      "arn:aws:apigateway:${data.aws_region.current.id}::/usageplans/*/usage"
    ]
  }
  # Better Auth session validation requires DynamoDB access (including UpdateItem for session refresh)
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

resource "aws_iam_policy" "ApiGatewayAuthorizer" {
  name   = local.api_gateway_authorizer_function_name
  policy = data.aws_iam_policy_document.ApiGatewayAuthorizer.json
}

resource "aws_iam_role_policy_attachment" "ApiGatewayAuthorizer" {
  role       = aws_iam_role.ApiGatewayAuthorizer.name
  policy_arn = aws_iam_policy.ApiGatewayAuthorizer.arn
}

resource "aws_lambda_function" "ApiGatewayAuthorizer" {
  description   = "The function that handles authorization for the API Gateway."
  function_name = local.api_gateway_authorizer_function_name
  role          = aws_iam_role.ApiGatewayAuthorizer.arn
  handler       = "index.handler"
  runtime       = "nodejs24.x"
  depends_on = [
    aws_iam_role_policy_attachment.ApiGatewayAuthorizer,
    aws_iam_role_policy_attachment.ApiGatewayAuthorizerLogging
  ]
  filename         = data.archive_file.ApiGatewayAuthorizer.output_path
  source_code_hash = data.archive_file.ApiGatewayAuthorizer.output_base64sha256
  layers           = [local.adot_layer_arn]

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = merge(local.common_lambda_env, {
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.MediaDownloader.name
      MULTI_AUTHENTICATION_PATH_PARTS = join(",", [
        aws_api_gateway_resource.RegisterDevice.path_part,
        aws_api_gateway_resource.Files.path_part,
        aws_api_gateway_resource.LogEvent.path_part
      ]),
      RESERVED_CLIENT_IP = "104.1.88.244"
      OTEL_SERVICE_NAME  = local.api_gateway_authorizer_function_name
    })
  }
}

data "archive_file" "ApiGatewayAuthorizer" {
  type        = "zip"
  source_dir  = "./../build/lambdas/ApiGatewayAuthorizer"
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
