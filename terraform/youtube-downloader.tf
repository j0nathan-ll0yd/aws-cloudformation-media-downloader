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
  source_dir = "./../src/lambdas/YouTubeDownloader"
  excludes = ["__pycache__"]
}

resource "aws_lambda_function" "YouTubeDownloader" {
  description      = "A wrapper around the yt-dlp library to download YouTube videos."
  function_name    = "YouTubeDownloader"
  role             = aws_iam_role.YouTubeDownloaderRole.arn
  runtime          = "python3.11"
  handler          = "lambda_function.lambda_handler"
  timeout = 900
  depends_on       = [aws_iam_role_policy_attachment.YouTubeDownloaderPolicyLogging]
  filename         = data.archive_file.YouTubeDownloaderComplete.output_path
  source_code_hash = data.archive_file.YouTubeDownloaderComplete.output_base64sha256
}
