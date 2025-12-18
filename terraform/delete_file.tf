resource "aws_iam_role" "DeleteFileRole" {
  name               = "DeleteFileRole"
  assume_role_policy = data.aws_iam_policy_document.LambdaGatewayAssumeRole.json
}

data "aws_iam_policy_document" "DeleteFile" {
  # Get and delete UserFiles records
  statement {
    actions = [
      "dynamodb:Query",
      "dynamodb:GetItem",
      "dynamodb:DeleteItem"
    ]
    resources = [
      aws_dynamodb_table.MediaDownloader.arn,
      "${aws_dynamodb_table.MediaDownloader.arn}/index/FileCollection"
    ]
  }

  # Delete objects from S3
  statement {
    actions = [
      "s3:DeleteObject"
    ]
    resources = [
      "${aws_s3_bucket.Files.arn}/*"
    ]
  }
}

resource "aws_iam_policy" "DeleteFileRolePolicy" {
  name   = "DeleteFileRolePolicy"
  policy = data.aws_iam_policy_document.DeleteFile.json
}

resource "aws_iam_role_policy_attachment" "DeleteFilePolicy" {
  role       = aws_iam_role.DeleteFileRole.name
  policy_arn = aws_iam_policy.DeleteFileRolePolicy.arn
}

resource "aws_iam_role_policy_attachment" "DeleteFilePolicyLogging" {
  role       = aws_iam_role.DeleteFileRole.name
  policy_arn = aws_iam_policy.CommonLambdaLogging.arn
}

resource "aws_iam_role_policy_attachment" "DeleteFilePolicyXRay" {
  role       = aws_iam_role.DeleteFileRole.name
  policy_arn = aws_iam_policy.CommonLambdaXRay.arn
}

resource "aws_lambda_permission" "DeleteFile" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.DeleteFile.function_name
  principal     = "apigateway.amazonaws.com"
}

resource "aws_cloudwatch_log_group" "DeleteFile" {
  name              = "/aws/lambda/${aws_lambda_function.DeleteFile.function_name}"
  retention_in_days = 14
}

# Create a payload zip file from the function source code bundle
data "archive_file" "DeleteFile" {
  type        = "zip"
  source_file = "./../build/lambdas/DeleteFile.js"
  output_path = "./../build/lambdas/DeleteFile.zip"
}

resource "aws_lambda_function" "DeleteFile" {
  description      = "A lambda function that deletes a file for a user."
  function_name    = "DeleteFile"
  role             = aws_iam_role.DeleteFileRole.arn
  handler          = "DeleteFile.handler"
  runtime          = "nodejs22.x"
  memory_size      = 512
  depends_on       = [aws_iam_role_policy_attachment.DeleteFilePolicy]
  filename         = data.archive_file.DeleteFile.output_path
  source_code_hash = data.archive_file.DeleteFile.output_base64sha256

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      DynamoDBTableName = aws_dynamodb_table.MediaDownloader.name
      S3BucketName      = aws_s3_bucket.Files.id
    }
  }
}

resource "aws_api_gateway_resource" "FilesFileId" {
  rest_api_id = aws_api_gateway_rest_api.Main.id
  parent_id   = aws_api_gateway_resource.Files.id
  path_part   = "{fileId}"
}

resource "aws_api_gateway_method" "DeleteFileDelete" {
  rest_api_id      = aws_api_gateway_rest_api.Main.id
  resource_id      = aws_api_gateway_resource.FilesFileId.id
  http_method      = "DELETE"
  authorization    = "CUSTOM"
  authorizer_id    = aws_api_gateway_authorizer.ApiGatewayAuthorizer.id
  api_key_required = true
}

resource "aws_api_gateway_integration" "DeleteFileDelete" {
  rest_api_id             = aws_api_gateway_rest_api.Main.id
  resource_id             = aws_api_gateway_resource.FilesFileId.id
  http_method             = aws_api_gateway_method.DeleteFileDelete.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.DeleteFile.invoke_arn
}
