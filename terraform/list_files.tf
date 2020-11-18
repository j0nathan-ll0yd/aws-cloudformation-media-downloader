resource "aws_iam_role" "ListFilesRole" {
  name               = "ListFilesRole"
  assume_role_policy = data.aws_iam_policy_document.lambda-assume-role-policy.json
}

data "aws_iam_policy_document" "ListFiles" {
  statement {
    actions   = ["s3:ListBucket"]
    resources = ["arn:aws:s3:::${aws_s3_bucket.Files.bucket}/*"]
  }
}

resource "aws_iam_policy" "ListFilesRolePolicy" {
  name   = "ListFilesRolePolicy"
  policy = data.aws_iam_policy_document.ListFiles.json
}

resource "aws_iam_role_policy_attachment" "ListFilesPolicy" {
  role       = aws_iam_role.ListFilesRole.name
  policy_arn = aws_iam_policy.ListFilesRolePolicy.arn
}

resource "aws_iam_role_policy_attachment" "ListFilesPolicyLogging" {
  role       = aws_iam_role.ListFilesRole.name
  policy_arn = aws_iam_policy.CommonLambdaLogging.arn
}

resource "aws_lambda_permission" "ListFiles" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ListFiles.function_name
  principal     = "apigateway.amazonaws.com"
}

resource "aws_cloudwatch_log_group" "ListFiles" {
  name              = "/aws/lambda/${aws_lambda_function.ListFiles.function_name}"
  retention_in_days = 14
}

# Create a payload zip file from the function source code bundle
data "archive_file" "ListFiles" {
  type = "zip"
  source_file = "./../build/lambdas/ListFiles.js"
  output_path = "./../build/lambdas/ListFiles.zip"
}

resource "aws_lambda_function" "ListFiles" {
  description      = "A lambda function that lists files in S3."
  function_name    = "ListFiles"
  role             = aws_iam_role.ListFilesRole.arn
  handler          = "ListFiles.listFiles"
  runtime          = "nodejs12.x"
  layers           = [aws_lambda_layer_version.NodeModules.arn]
  depends_on       = [aws_iam_role_policy_attachment.ListFilesPolicy]
  filename = data.archive_file.ListFiles.output_path
  source_code_hash = base64sha256(data.archive_file.ListFiles.output_path)

  environment {
    variables = {
      Bucket = aws_s3_bucket.Files.id
    }
  }
}

resource "aws_api_gateway_resource" "Files" {
  rest_api_id = aws_api_gateway_rest_api.Main.id
  parent_id   = aws_api_gateway_rest_api.Main.root_resource_id
  path_part   = "files"
}

resource "aws_api_gateway_method" "ListFilesGet" {
  rest_api_id      = aws_api_gateway_rest_api.Main.id
  resource_id      = aws_api_gateway_resource.Files.id
  http_method      = "GET"
  authorization    = "NONE"
  api_key_required = true
}

resource "aws_api_gateway_integration" "ListFilesGet" {
  rest_api_id             = aws_api_gateway_rest_api.Main.id
  resource_id             = aws_api_gateway_resource.Files.id
  http_method             = aws_api_gateway_method.ListFilesGet.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.ListFiles.invoke_arn
}
