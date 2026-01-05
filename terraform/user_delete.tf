locals {
  user_delete_function_name = "UserDelete"
}

resource "aws_iam_role" "UserDelete" {
  name               = local.user_delete_function_name
  assume_role_policy = data.aws_iam_policy_document.LambdaGatewayAssumeRole.json
  tags               = local.common_tags
}

data "aws_iam_policy_document" "UserDelete" {
  dynamic "statement" {
    for_each = length(aws_sns_platform_application.OfflineMediaDownloader) == 1 ? [1] : []
    content {
      actions   = ["sns:DeleteEndpoint"]
      resources = [aws_sns_platform_application.OfflineMediaDownloader[0].arn]
    }
  }
}

resource "aws_iam_policy" "UserDelete" {
  name   = local.user_delete_function_name
  policy = data.aws_iam_policy_document.UserDelete.json
  tags   = local.common_tags
}

resource "aws_iam_role_policy_attachment" "UserDelete" {
  role       = aws_iam_role.UserDelete.name
  policy_arn = aws_iam_policy.UserDelete.arn
}

resource "aws_iam_role_policy" "UserDeleteLogging" {
  name = "UserDeleteLogging"
  role = aws_iam_role.UserDelete.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ]
      Resource = [
        "arn:aws:logs:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.user_delete_function_name}",
        "arn:aws:logs:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.user_delete_function_name}:*"
      ]
    }]
  })
}

resource "aws_iam_role_policy_attachment" "UserDeleteXRay" {
  role       = aws_iam_role.UserDelete.name
  policy_arn = aws_iam_policy.CommonLambdaXRay.arn
}

resource "aws_iam_role_policy_attachment" "UserDeleteDSQL" {
  role       = aws_iam_role.UserDelete.name
  policy_arn = aws_iam_policy.LambdaDSQLReadWrite.arn
}

resource "aws_lambda_permission" "UserDelete" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.UserDelete.function_name
  principal     = "apigateway.amazonaws.com"
}

resource "aws_cloudwatch_log_group" "UserDelete" {
  name              = "/aws/lambda/${aws_lambda_function.UserDelete.function_name}"
  retention_in_days = 7
  tags              = local.common_tags
}

data "archive_file" "UserDelete" {
  type        = "zip"
  source_dir  = "./../build/lambdas/UserDelete"
  output_path = "./../build/lambdas/UserDelete.zip"
}

resource "aws_lambda_function" "UserDelete" {
  description      = "Deletes a User and all associated data (requirement for Sign In With Apple)"
  function_name    = local.user_delete_function_name
  role             = aws_iam_role.UserDelete.arn
  handler          = "index.handler"
  runtime          = "nodejs24.x"
  architectures    = [local.lambda_architecture]
  depends_on       = [aws_iam_role_policy_attachment.UserDelete]
  filename         = data.archive_file.UserDelete.output_path
  source_code_hash = data.archive_file.UserDelete.output_base64sha256
  layers           = [local.adot_layer_arn]

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = merge(local.common_lambda_env, {
      GITHUB_PERSONAL_TOKEN = data.sops_file.secrets.data["github.issue.token"]
      OTEL_SERVICE_NAME     = local.user_delete_function_name
      DSQL_ACCESS_LEVEL     = "readwrite"
    })
  }

  tags = merge(local.common_tags, {
    Name = local.user_delete_function_name
  })
}

# RESTful DELETE /user - no separate resource needed, uses User resource from api_gateway_paths.tf
resource "aws_api_gateway_method" "UserDelete" {
  rest_api_id      = aws_api_gateway_rest_api.Main.id
  resource_id      = aws_api_gateway_resource.User.id
  http_method      = "DELETE"
  authorization    = "CUSTOM"
  authorizer_id    = aws_api_gateway_authorizer.ApiGatewayAuthorizer.id
  api_key_required = true
}

resource "aws_api_gateway_integration" "UserDelete" {
  rest_api_id             = aws_api_gateway_rest_api.Main.id
  resource_id             = aws_api_gateway_resource.User.id
  http_method             = aws_api_gateway_method.UserDelete.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.UserDelete.invoke_arn
}
