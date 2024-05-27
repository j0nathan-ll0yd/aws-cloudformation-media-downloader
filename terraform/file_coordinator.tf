resource "aws_iam_role" "FileCoordinatorRole" {
  name               = "FileCoordinatorRole"
  assume_role_policy = data.aws_iam_policy_document.LambdaAssumeRole.json
}

data "aws_iam_policy_document" "FileCoordinator" {
  statement {
    actions   = ["states:StartExecution"]
    resources = [aws_sfn_state_machine.MultipartUpload.id]
  }
  statement {
    actions   = ["dynamodb:Scan"]
    resources = [aws_dynamodb_table.Files.arn]
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

resource "aws_cloudwatch_event_target" "FileCoordinator" {
  rule = aws_cloudwatch_event_rule.FileCoordinator.name
  arn  = aws_lambda_function.FileCoordinator.arn
}


resource "aws_cloudwatch_event_rule" "FileCoordinator" {
  name                = "FileCoordinator"
  schedule_expression = "rate(4 minutes)"
  is_enabled          = true
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
  source_file = "./../build/lambdas/FileCoordinator.js"
  output_path = "./../build/lambdas/FileCoordinator.zip"
}

resource "aws_lambda_function" "FileCoordinator" {
  description      = "Checks for files to be downloaded and triggers their execution"
  function_name    = "FileCoordinator"
  role             = aws_iam_role.FileCoordinatorRole.arn
  handler          = "FileCoordinator.handler"
  runtime          = "nodejs20.x"
  depends_on       = [aws_iam_role_policy_attachment.FileCoordinatorPolicy]
  filename         = data.archive_file.FileCoordinator.output_path
  source_code_hash = data.archive_file.FileCoordinator.output_base64sha256

  environment {
    variables = {
      StateMachineArn    = aws_sfn_state_machine.MultipartUpload.id
      DynamoDBTableFiles = aws_dynamodb_table.Files.name
    }
  }
}
