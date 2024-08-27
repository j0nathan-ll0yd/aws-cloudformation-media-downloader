resource "aws_iam_role" "YouTubeDownloaderRole" {
  name               = "YouTubeDownloaderRole"
  assume_role_policy = data.aws_iam_policy_document.LambdaGatewayAssumeRole.json
}

resource "aws_iam_role_policy_attachment" "YouTubeDownloaderPolicyLogging" {
  role       = aws_iam_role.YouTubeDownloaderRole.name
  policy_arn = aws_iam_policy.CommonLambdaLogging.arn
}

resource "aws_lambda_permission" "YouTubeDownloader" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.YouTubeDownloader.function_name
  principal     = "apigateway.amazonaws.com"
}

resource "aws_cloudwatch_log_group" "YouTubeDownloader" {
  name              = "/aws/lambda/${aws_lambda_function.YouTubeDownloader.function_name}"
  retention_in_days = 14
}

data "archive_file" "YouTubeDownloaderComplete" {
  type        = "zip"
  output_path = "./../build/lambdas/YouTubeDownloader.zip"
  source_dir  = "./../src/lambdas/YouTubeDownloader/packages/remote"
  excludes    = ["__pycache__"]
}

/*
resource "aws_lambda_layer_version" "ffmpeg-lambda-layer" {
  filename            = "./../src/lambdas/YouTubeDownloader/ffmpeg.zip"
  layer_name          = "ffmpeg-lambda-layer"
  source_code_hash    = filebase64sha256("./../src/lambdas/YouTubeDownloader/ffmpeg.zip")
  compatible_runtimes = ["python3.11"]
} */

resource "aws_lambda_function" "YouTubeDownloader" {
  description   = "A wrapper around the yt-dlp library to download YouTube videos."
  function_name = "YouTubeDownloader"
  role          = aws_iam_role.YouTubeDownloaderRole.arn
  runtime       = "python3.11"
  handler       = "lambda_function.lambda_handler"
  #layers = [aws_lambda_layer_version.ffmpeg-lambda-layer.arn]
  timeout          = 900
  depends_on       = [aws_iam_role_policy_attachment.YouTubeDownloaderPolicyLogging]
  filename         = data.archive_file.YouTubeDownloaderComplete.output_path
  source_code_hash = data.archive_file.YouTubeDownloaderComplete.output_base64sha256
}

resource "aws_api_gateway_resource" "HealthCheck" {
  rest_api_id = aws_api_gateway_rest_api.Main.id
  parent_id   = aws_api_gateway_rest_api.Main.root_resource_id
  path_part   = "healthCheck"
}

resource "aws_api_gateway_method" "HealthCheckGet" {
  rest_api_id      = aws_api_gateway_rest_api.Main.id
  resource_id      = aws_api_gateway_resource.HealthCheck.id
  http_method      = "GET"
  authorization    = "NONE"
  api_key_required = false
}

resource "aws_api_gateway_integration" "HealthCheckGet" {
  rest_api_id = aws_api_gateway_rest_api.Main.id
  resource_id = aws_api_gateway_resource.HealthCheck.id
  http_method = aws_api_gateway_method.HealthCheckGet.http_method
  type        = "MOCK"
  passthrough_behavior = "WHEN_NO_TEMPLATES"
  request_templates = {
    "application/json" = jsonencode(
      {
        statusCode: 200
      }
    )
  }
}

resource "aws_api_gateway_model" "SuccessModel" {
  rest_api_id = aws_api_gateway_rest_api.Main.id
  name        = "SuccessModel"
  content_type = "application/json"
  schema = jsonencode({
    type = "object"
    properties = {
      message = {
        type = "string"
      }
    }
  })
}

resource "aws_api_gateway_method_response" "response_200" {
  rest_api_id = aws_api_gateway_rest_api.Main.id
  resource_id = aws_api_gateway_resource.HealthCheck.id
  http_method = aws_api_gateway_method.HealthCheckGet.http_method
  status_code = "200"
  response_models = {
    "application/json" = aws_api_gateway_model.SuccessModel.name
  }
}
