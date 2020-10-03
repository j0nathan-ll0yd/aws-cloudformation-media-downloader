resource "aws_iam_role" "FileCoordinatorRole" {
  name               = "FileCoordinatorRole"
  assume_role_policy = data.aws_iam_policy_document.lambda-assume-role-policy.json
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

resource "aws_iam_role_policy_attachment" "FileCoordinatorPolicyVPCExecution" {
  role = aws_iam_role.FileCoordinatorRole.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_cloudwatch_event_target" "FileCoordinator" {
  rule = aws_cloudwatch_event_rule.FileCoordinator.name
  arn  = aws_lambda_function.FileCoordinator.arn
}


resource "aws_cloudwatch_event_rule" "FileCoordinator" {
  name                = "FileCoordinator"
  schedule_expression = "rate(4 minutes)"
  is_enabled          = false
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

resource "aws_lambda_function" "FileCoordinator" {
  description      = "Checks for files to be downloaded and triggers their execution"
  filename         = "./../build/artifacts/dist.zip"
  function_name    = "FileCoordinator"
  role             = aws_iam_role.FileCoordinatorRole.arn
  handler          = "dist/main.schedulerFileCoordinator"
  runtime          = "nodejs12.x"
  layers           = [aws_lambda_layer_version.NodeModules.arn]
  depends_on       = [aws_iam_role_policy_attachment.FileCoordinatorPolicy]
  source_code_hash = filebase64sha256("./../build/artifacts/dist.zip")

  environment {
    variables = {
      StateMachineArn = aws_sfn_state_machine.MultipartUpload.id
      DynamoDBTable   = aws_dynamodb_table.Files.name
    }
  }

  vpc_config {
    subnet_ids         = [aws_subnet.Private.id]
    security_group_ids = [aws_security_group.Lambdas.id]
  }
}
