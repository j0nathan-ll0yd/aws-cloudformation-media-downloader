locals {
  list_files_function_name = "${var.resource_prefix}-ListFiles"
}

resource "aws_iam_role" "ListFiles" {
  name               = local.list_files_function_name
  assume_role_policy = data.aws_iam_policy_document.LambdaGatewayAssumeRole.json
  tags               = local.common_tags
}

resource "aws_iam_role_policy" "ListFilesLogging" {
  name = "ListFilesLogging"
  role = aws_iam_role.ListFiles.id
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
        "arn:aws:logs:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.list_files_function_name}",
        "arn:aws:logs:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.list_files_function_name}:*"
      ]
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ListFilesXRay" {
  role       = aws_iam_role.ListFiles.name
  policy_arn = aws_iam_policy.CommonLambdaXRay.arn
}

# DSQL policy attachment handled by terraform/dsql_permissions.tf

resource "aws_lambda_permission" "ListFiles" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ListFiles.function_name
  principal     = "apigateway.amazonaws.com"
}

resource "aws_cloudwatch_log_group" "ListFiles" {
  name              = "/aws/lambda/${aws_lambda_function.ListFiles.function_name}"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

# Create a payload zip file from the function source code bundle
data "archive_file" "ListFiles" {
  type        = "zip"
  source_dir  = "./../build/lambdas/ListFiles"
  output_path = "./../build/lambdas/ListFiles.zip"
}

resource "aws_lambda_function" "ListFiles" {
  description      = "A lambda function that lists files in S3."
  function_name    = local.list_files_function_name
  role             = aws_iam_role.ListFiles.arn
  handler          = "index.handler"
  runtime          = "nodejs24.x"
  architectures    = [local.lambda_architecture]
  memory_size      = 512
  timeout          = local.default_lambda_timeout
  depends_on       = [aws_iam_role_policy.ListFilesLogging]
  filename         = data.archive_file.ListFiles.output_path
  source_code_hash = data.archive_file.ListFiles.output_base64sha256
  layers           = [local.adot_layer_arn]

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = merge(local.common_lambda_env, {
      DEFAULT_FILE_SIZE         = 436743
      DEFAULT_FILE_NAME         = aws_s3_object.DefaultFile.key
      DEFAULT_FILE_URL          = "https://${aws_s3_object.DefaultFile.bucket}.s3.amazonaws.com/${aws_s3_object.DefaultFile.key}"
      DEFAULT_FILE_CONTENT_TYPE = aws_s3_object.DefaultFile.content_type
      OTEL_SERVICE_NAME         = local.list_files_function_name
      DSQL_ROLE_NAME            = local.lambda_dsql_roles["ListFiles"].role_name
    })
  }

  tags = merge(local.common_tags, {
    Name = local.list_files_function_name
  })
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
  authorization    = "CUSTOM"
  authorizer_id    = aws_api_gateway_authorizer.ApiGatewayAuthorizer.id
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

data "local_file" "DefaultFile" {
  filename = "${path.module}/../static/videos/default-file.mp4"
}

resource "aws_s3_object" "DefaultFile" {
  bucket       = aws_s3_bucket.Files.id
  content_type = "video/mp4"
  key          = "default-file.mp4"
  source       = data.local_file.DefaultFile.filename
  etag         = filemd5(data.local_file.DefaultFile.filename)
  # ACL removed - CloudFront OAC provides secure access
}
