data "aws_iam_policy_document" "lambda-assume-role-policy" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["apigateway.amazonaws.com", "lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ListFilesRole" {
  name               = "ListFilesRole"
  path               = "/"
  assume_role_policy = data.aws_iam_policy_document.lambda-assume-role-policy.json
}

resource "aws_iam_role_policy_attachment" "blahblah" {
  role       = aws_iam_role.ListFilesRole.name
  policy_arn = aws_iam_policy.ListFilesRolePolicy.arn
}

resource "aws_lambda_permission" "ListFilesLambdaPermission" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ListFiles.function_name
  principal     = "apigateway.amazonaws.com"
}

resource "aws_cloudwatch_log_group" "ListFiles" {
  name              = "/aws/lambda/${aws_lambda_function.ListFiles.function_name}"
  retention_in_days = 14
}

resource "aws_lambda_function" "ListFiles" {
  description      = "A lambda function that lists files in S3."
  filename         = "./../build/artifacts/dist.zip"
  function_name    = "ListFiles"
  role             = aws_iam_role.ListFilesRole.arn
  handler          = "dist/main.listFiles"
  runtime          = "nodejs12.x"
  layers           = [aws_lambda_layer_version.lambda_layer.arn]
  depends_on       = [aws_iam_role.ListFilesRole]
  source_code_hash = filebase64sha256("./../build/artifacts/dist.zip")

  environment {
    variables = {
      Bucket = aws_s3_bucket.file_bucket.id
    }
  }
}

resource "aws_api_gateway_resource" "Files" {
  rest_api_id = aws_api_gateway_rest_api.MyApi.id
  parent_id   = aws_api_gateway_rest_api.MyApi.root_resource_id
  path_part   = "files"
}

resource "aws_api_gateway_method" "ListFilesMethodGet" {
  rest_api_id      = aws_api_gateway_rest_api.MyApi.id
  resource_id      = aws_api_gateway_resource.Files.id
  http_method      = "GET"
  authorization    = "CUSTOM"
  authorizer_id    = aws_api_gateway_authorizer.MyAuthorizer.id
  api_key_required = true
}

resource "aws_api_gateway_integration" "ListFilesMethodGetIntegration" {
  rest_api_id             = aws_api_gateway_rest_api.MyApi.id
  resource_id             = aws_api_gateway_resource.Files.id
  http_method             = aws_api_gateway_method.ListFilesMethodGet.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.ListFiles.invoke_arn
}
