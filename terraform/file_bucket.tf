resource "aws_s3_bucket" "Files" {
  bucket = "lifegames-media-downloader-files"
}

resource "aws_s3_bucket_acl" "Files" {
  bucket = aws_s3_bucket.Files.id
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
  type        = "zip"
  source_file = "./../build/lambdas/S3ObjectCreated.js"
  output_path = "./../build/lambdas/S3ObjectCreated.zip"
}

resource "aws_lambda_function" "S3ObjectCreated" {
  description      = "Dispatches a notification after a file is uploaded to an S3 bucket"
  function_name    = "S3ObjectCreated"
  role             = aws_iam_role.S3ObjectCreatedRole.arn
  handler          = "S3ObjectCreated.handler"
  runtime          = "nodejs22.x"
  depends_on       = [aws_iam_role_policy_attachment.S3ObjectCreatedPolicy]
  filename         = data.archive_file.S3ObjectCreated.output_path
  source_code_hash = data.archive_file.S3ObjectCreated.output_base64sha256

  environment {
    variables = {
      DynamoDBTableFiles     = aws_dynamodb_table.Files.name
      DynamoDBTableUserFiles = aws_dynamodb_table.UserFiles.name
      SNSQueueUrl            = aws_sqs_queue.SendPushNotification.id
    }
  }
}

resource "aws_iam_role" "S3ObjectCreatedRole" {
  name               = "S3ObjectCreatedRole"
  assume_role_policy = data.aws_iam_policy_document.LambdaAssumeRole.json
}

data "aws_iam_policy_document" "S3ObjectCreated" {
  statement {
    actions = ["dynamodb:Scan"]
    resources = [
      aws_dynamodb_table.Files.arn,
      aws_dynamodb_table.UserFiles.arn
    ]
  }
  statement {
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.SendPushNotification.arn]
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
