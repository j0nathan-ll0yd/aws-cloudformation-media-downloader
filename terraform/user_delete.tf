resource "aws_iam_role" "UserDeleteRole" {
  name               = "UserDeleteRole"
  assume_role_policy = data.aws_iam_policy_document.LambdaGatewayAssumeRole.json
}

data "aws_iam_policy_document" "UserDelete" {
  statement {
    actions   = ["dynamodb:Query", "dynamodb:DeleteItem"]
    resources = [aws_dynamodb_table.Devices.arn]
  }
  statement {
    actions   = ["dynamodb:Query", "dynamodb:DeleteItem"]
    resources = [aws_dynamodb_table.UserDevices.arn]
  }
  statement {
    actions = ["dynamodb:DeleteItem"]
    resources = [
      aws_dynamodb_table.UserFiles.arn,
      aws_dynamodb_table.Users.arn
    ]
  }
  statement {
    actions   = ["sns:DeleteEndpoint"]
    resources = [length(aws_sns_platform_application.OfflineMediaDownloader) == 1 ? aws_sns_platform_application.OfflineMediaDownloader[0].arn : ""]
  }
}

resource "aws_iam_policy" "UserDeleteRolePolicy" {
  name   = "UserDeleteRolePolicy"
  policy = data.aws_iam_policy_document.UserDelete.json
}

resource "aws_iam_role_policy_attachment" "UserDeletePolicy" {
  role       = aws_iam_role.UserDeleteRole.name
  policy_arn = aws_iam_policy.UserDeleteRolePolicy.arn
}

resource "aws_iam_role_policy_attachment" "UserDeletePolicyLogging" {
  role       = aws_iam_role.UserDeleteRole.name
  policy_arn = aws_iam_policy.CommonLambdaLogging.arn
}

resource "aws_lambda_permission" "UserDelete" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.UserDelete.function_name
  principal     = "apigateway.amazonaws.com"
}

resource "aws_cloudwatch_log_group" "UserDelete" {
  name              = "/aws/lambda/${aws_lambda_function.UserDelete.function_name}"
  retention_in_days = 14
}

data "archive_file" "UserDelete" {
  type        = "zip"
  source_file = "./../build/lambdas/UserDelete.js"
  output_path = "./../build/lambdas/UserDelete.zip"
}

resource "aws_lambda_function" "UserDelete" {
  description      = "Deletes a User and all associated data (requirement for Sign In With Apple)"
  function_name    = "UserDelete"
  role             = aws_iam_role.UserDeleteRole.arn
  handler          = "UserDelete.handler"
  runtime          = "nodejs22.x"
  depends_on       = [aws_iam_role_policy_attachment.UserDeletePolicy]
  filename         = data.archive_file.UserDelete.output_path
  source_code_hash = data.archive_file.UserDelete.output_base64sha256

  environment {
    variables = {
      DynamoDBTableDevices     = aws_dynamodb_table.Devices.name
      DynamoDBTableUserDevices = aws_dynamodb_table.UserDevices.name
      DynamoDBTableUserFiles   = aws_dynamodb_table.UserFiles.name
      DynamoDBTableUsers       = aws_dynamodb_table.Users.name
      GithubPersonalToken      = "GithubPersonalToken"
    }
  }
}

resource "aws_api_gateway_resource" "UserDelete" {
  rest_api_id = aws_api_gateway_rest_api.Main.id
  parent_id   = aws_api_gateway_rest_api.Main.root_resource_id
  path_part   = "userDelete"
}

resource "aws_api_gateway_method" "UserDeletePost" {
  rest_api_id      = aws_api_gateway_rest_api.Main.id
  resource_id      = aws_api_gateway_resource.UserDelete.id
  http_method      = "POST"
  authorization    = "NONE"
  api_key_required = true
}

resource "aws_api_gateway_integration" "UserDeletePost" {
  rest_api_id             = aws_api_gateway_rest_api.Main.id
  resource_id             = aws_api_gateway_resource.UserDelete.id
  http_method             = aws_api_gateway_method.UserDeletePost.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.UserDelete.invoke_arn
}
