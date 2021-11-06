resource "aws_iam_role" "ListFilesRole" {
  name               = "ListFilesRole"
  assume_role_policy = data.aws_iam_policy_document.LambdaGatewayAssumeRole.json
}

data "aws_iam_policy_document" "ListFiles" {
  statement {
    actions = [
      "dynamodb:Query",
      "dynamodb:BatchGetItem"
    ]
    resources = [
      aws_dynamodb_table.Files.arn,
      aws_dynamodb_table.UserFiles.arn
    ]
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
  type        = "zip"
  source_file = "./../build/lambdas/ListFiles.js"
  output_path = "./../build/lambdas/ListFiles.zip"
}

resource "aws_lambda_function" "ListFiles" {
  description      = "A lambda function that lists files in S3."
  function_name    = "ListFiles"
  role             = aws_iam_role.ListFilesRole.arn
  handler          = "ListFiles.handler"
  runtime          = "nodejs14.x"
  depends_on       = [aws_iam_role_policy_attachment.ListFilesPolicy]
  filename         = data.archive_file.ListFiles.output_path
  source_code_hash = data.archive_file.ListFiles.output_base64sha256

  environment {
    variables = {
      DynamoTableFiles       = aws_dynamodb_table.Files.name
      DynamoTableUserFiles   = aws_dynamodb_table.UserFiles.name
      DefaultFileSize        = 436743
      DefaultFileName        = aws_s3_bucket_object.DefaultFile.key
      DefaultFileUrl         = "https://${aws_s3_bucket_object.DefaultFile.bucket}.s3.amazonaws.com/${aws_s3_bucket_object.DefaultFile.key}"
      DefaultFileContentType = aws_s3_bucket_object.DefaultFile.content_type
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

resource "aws_dynamodb_table" "UserFiles" {
  name           = "UserFiles"
  billing_mode   = "PROVISIONED"
  read_capacity  = 5
  write_capacity = 5
  hash_key       = "userId"

  attribute {
    name = "userId"
    type = "S"
  }
}

data "local_file" "DefaultFile" {
  filename = "${path.module}/../static/videos/default-file.mp4"
}

resource "aws_s3_bucket_object" "DefaultFile" {
  bucket       = aws_s3_bucket.Files.bucket
  content_type = "video/mp4"
  key          = "default-file.mp4"
  source       = data.local_file.DefaultFile.filename
  etag         = filemd5(data.local_file.DefaultFile.filename)
  acl          = "public-read"
}
