locals {
  file_coordinator_function_name = "FileCoordinator"
}

resource "aws_iam_role" "FileCoordinatorRole" {
  name               = "FileCoordinatorRole"
  assume_role_policy = data.aws_iam_policy_document.LambdaAssumeRole.json
}

data "aws_iam_policy_document" "FileCoordinator" {
  statement {
    actions   = ["lambda:InvokeFunction"]
    resources = [aws_lambda_function.StartFileUpload.arn]
  }
  # Query StatusIndex for PendingDownload and Scheduled files
  statement {
    actions = ["dynamodb:Query"]
    resources = [
      "${aws_dynamodb_table.MediaDownloader.arn}/index/StatusIndex"
    ]
  }
  # Publish CloudWatch metrics for monitoring
  statement {
    actions   = ["cloudwatch:PutMetricData"]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "FileCoordinatorRolePolicy" {
  name   = "FileCoordinatorRolePolicy"
  policy = data.aws_iam_policy_document.FileCoordinator.json
}

resource "aws_iam_role_policy_attachment" "FileCoordinatorPolicy" {
  role       = aws_iam_role.FileCoordinatorRole.name
  policy_arn = aws_iam_policy.FileCoordinatorRolePolicy.arn
}

resource "aws_iam_role_policy_attachment" "FileCoordinatorPolicyLogging" {
  role       = aws_iam_role.FileCoordinatorRole.name
  policy_arn = aws_iam_policy.CommonLambdaLogging.arn
}

resource "aws_iam_role_policy_attachment" "FileCoordinatorPolicyXRay" {
  role       = aws_iam_role.FileCoordinatorRole.name
  policy_arn = aws_iam_policy.CommonLambdaXRay.arn
}

resource "aws_cloudwatch_event_target" "FileCoordinator" {
  rule = aws_cloudwatch_event_rule.FileCoordinator.name
  arn  = aws_lambda_function.FileCoordinator.arn
}


resource "aws_cloudwatch_event_rule" "FileCoordinator" {
  name                = "FileCoordinator"
  schedule_expression = "rate(4 minutes)"
  state               = "DISABLED"
}

resource "aws_lambda_permission" "FileCoordinator" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.FileCoordinator.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.FileCoordinator.arn
}

resource "aws_cloudwatch_log_group" "FileCoordinator" {
  name              = "/aws/lambda/${aws_lambda_function.FileCoordinator.function_name}"
  retention_in_days = 14
}

data "archive_file" "FileCoordinator" {
  type        = "zip"
  source_dir  = "./../build/lambdas/FileCoordinator"
  output_path = "./../build/lambdas/FileCoordinator.zip"
}

resource "aws_lambda_function" "FileCoordinator" {
  description      = "Checks for files to be downloaded and triggers their execution"
  function_name    = local.file_coordinator_function_name
  role             = aws_iam_role.FileCoordinatorRole.arn
  handler          = "index.handler"
  runtime          = "nodejs24.x"
  memory_size      = 1024
  depends_on       = [aws_iam_role_policy_attachment.FileCoordinatorPolicy]
  filename         = data.archive_file.FileCoordinator.output_path
  source_code_hash = data.archive_file.FileCoordinator.output_base64sha256
  layers           = [local.adot_layer_arn]

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = merge(local.common_lambda_env, {
      DYNAMODB_TABLE_NAME             = aws_dynamodb_table.MediaDownloader.name
      FILE_COORDINATOR_BATCH_SIZE     = 5
      FILE_COORDINATOR_BATCH_DELAY_MS = 10000
      OTEL_SERVICE_NAME               = local.file_coordinator_function_name
    })
  }
}
