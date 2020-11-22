resource "aws_s3_bucket" "Files" {
  bucket = "lifegames-media-downloader-files"
  acl    = "public-read"
}

resource "aws_s3_bucket_notification" "Files" {
  bucket = aws_s3_bucket.Files.bucket
  lambda_function {
    events              = ["s3:ObjectCreated:*"]
    lambda_function_arn = aws_lambda_function.S3ObjectCreated.arn
  }
}

resource "aws_lambda_permission" "S3ObjectCreated" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.S3ObjectCreated.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.Files.arn
}

resource "aws_cloudwatch_log_group" "S3ObjectCreated" {
  name              = "/aws/lambda/${aws_lambda_function.S3ObjectCreated.function_name}"
  retention_in_days = 14
}

data "archive_file" "S3ObjectCreated" {
  type = "zip"
  source_file = "./../build/lambdas/S3ObjectCreated.js"
  output_path = "./../build/lambdas/S3ObjectCreated.zip"
}

resource "aws_lambda_function" "S3ObjectCreated" {
  description      = "Dispatches a notification after a file is uploaded to an S3 bucket"
  function_name    = "S3ObjectCreated"
  role             = aws_iam_role.S3ObjectCreatedRole.arn
  handler          = "S3ObjectCreated.fileUploadWebhook"
  runtime          = "nodejs12.x"
  layers           = [aws_lambda_layer_version.NodeModules.arn]
  depends_on       = [aws_iam_role_policy_attachment.S3ObjectCreatedPolicy]
  filename = data.archive_file.S3ObjectCreated.output_path
  source_code_hash = base64sha256(data.archive_file.S3ObjectCreated.output_path)

  environment {
    variables = {
      PushNotificationTopicArn = aws_sns_topic.PushNotifications.arn
    }
  }
}

resource "aws_iam_role" "S3ObjectCreatedRole" {
  name               = "S3ObjectCreatedRole"
  assume_role_policy = data.aws_iam_policy_document.lambda-assume-role-policy.json
}

data "aws_iam_policy_document" "S3ObjectCreated" {
  statement {
    actions   = ["sns:Publish"]
    resources = [aws_sns_topic.PushNotifications.arn]
  }
}

resource "aws_iam_policy" "S3ObjectCreatedRolePolicy" {
  name   = "S3ObjectCreatedRolePolicy"
  policy = data.aws_iam_policy_document.S3ObjectCreated.json
}

resource "aws_iam_role_policy_attachment" "S3ObjectCreatedPolicy" {
  role       = aws_iam_role.S3ObjectCreatedRole.name
  policy_arn = aws_iam_policy.S3ObjectCreatedRolePolicy.arn
}

resource "aws_iam_role_policy_attachment" "S3ObjectCreatedPolicyLogging" {
  role       = aws_iam_role.S3ObjectCreatedRole.name
  policy_arn = aws_iam_policy.CommonLambdaLogging.arn
}
