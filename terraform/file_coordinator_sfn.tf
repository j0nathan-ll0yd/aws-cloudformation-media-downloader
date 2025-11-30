# FileCoordinator Step Functions State Machine
# Replaces the FileCoordinator Lambda with a visual, retry-capable workflow

# =============================================================================
# State Machine Definition
# =============================================================================

locals {
  file_coordinator_asl = templatefile("${path.module}/step_functions/file_coordinator.asl.json", {
    DynamoDBTableName  = aws_dynamodb_table.MediaDownloader.name
    StartFileUploadArn = aws_lambda_function.StartFileUpload.arn
    EventBusName       = aws_cloudwatch_event_bus.MediaDownloaderEvents.name
  })
}

resource "aws_sfn_state_machine" "FileCoordinator" {
  name     = "FileCoordinator"
  role_arn = aws_iam_role.FileCoordinatorSfnRole.arn
  type     = "STANDARD"

  definition = local.file_coordinator_asl

  logging_configuration {
    log_destination        = "${aws_cloudwatch_log_group.FileCoordinatorSfn.arn}:*"
    include_execution_data = true
    level                  = "ALL"
  }

  tracing_configuration {
    enabled = true
  }

  tags = {
    Name        = "FileCoordinator"
    Description = "Orchestrates pending file downloads with visual debugging"
  }
}

# =============================================================================
# CloudWatch Log Group for Step Functions
# =============================================================================

resource "aws_cloudwatch_log_group" "FileCoordinatorSfn" {
  name              = "/aws/states/FileCoordinator"
  retention_in_days = 14
}

# =============================================================================
# IAM Role for Step Functions
# =============================================================================

resource "aws_iam_role" "FileCoordinatorSfnRole" {
  name               = "FileCoordinatorSfnRole"
  assume_role_policy = data.aws_iam_policy_document.StatesAssumeRole.json
}

data "aws_iam_policy_document" "FileCoordinatorSfn" {
  # DynamoDB Query on StatusIndex
  statement {
    actions   = ["dynamodb:Query"]
    resources = ["${aws_dynamodb_table.MediaDownloader.arn}/index/StatusIndex"]
  }

  # Lambda Invoke for StartFileUpload
  statement {
    actions   = ["lambda:InvokeFunction"]
    resources = [aws_lambda_function.StartFileUpload.arn]
  }

  # EventBridge PutEvents for workflow events
  statement {
    actions   = ["events:PutEvents"]
    resources = [aws_cloudwatch_event_bus.MediaDownloaderEvents.arn]
  }

  # CloudWatch Logs for state machine logging
  statement {
    actions = [
      "logs:CreateLogDelivery",
      "logs:GetLogDelivery",
      "logs:UpdateLogDelivery",
      "logs:DeleteLogDelivery",
      "logs:ListLogDeliveries",
      "logs:PutLogEvents",
      "logs:PutResourcePolicy",
      "logs:DescribeResourcePolicies",
      "logs:DescribeLogGroups"
    ]
    resources = ["*"]
  }

  # X-Ray Tracing
  statement {
    actions = [
      "xray:PutTraceSegments",
      "xray:PutTelemetryRecords",
      "xray:GetSamplingRules",
      "xray:GetSamplingTargets"
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "FileCoordinatorSfnRolePolicy" {
  name   = "FileCoordinatorSfnRolePolicy"
  policy = data.aws_iam_policy_document.FileCoordinatorSfn.json
}

resource "aws_iam_role_policy_attachment" "FileCoordinatorSfnPolicy" {
  role       = aws_iam_role.FileCoordinatorSfnRole.name
  policy_arn = aws_iam_policy.FileCoordinatorSfnRolePolicy.arn
}

# =============================================================================
# EventBridge Scheduler to Trigger Step Functions
# =============================================================================

resource "aws_scheduler_schedule" "FileCoordinator" {
  name       = "FileCoordinator"
  group_name = "default"

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression = "rate(4 minutes)"
  state               = "DISABLED" # Start disabled - enable after validation

  target {
    arn      = aws_sfn_state_machine.FileCoordinator.arn
    role_arn = aws_iam_role.FileCoordinatorSchedulerRole.arn

    input = jsonencode({
      source        = "scheduler"
      scheduledTime = "<aws.scheduler.scheduled-time>"
    })
  }
}

# =============================================================================
# IAM Role for EventBridge Scheduler
# =============================================================================

resource "aws_iam_role" "FileCoordinatorSchedulerRole" {
  name = "FileCoordinatorSchedulerRole"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "scheduler.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_policy" "FileCoordinatorSchedulerPolicy" {
  name = "FileCoordinatorSchedulerPolicy"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action   = "states:StartExecution"
      Effect   = "Allow"
      Resource = aws_sfn_state_machine.FileCoordinator.arn
    }]
  })
}

resource "aws_iam_role_policy_attachment" "FileCoordinatorSchedulerPolicy" {
  role       = aws_iam_role.FileCoordinatorSchedulerRole.name
  policy_arn = aws_iam_policy.FileCoordinatorSchedulerPolicy.arn
}

# =============================================================================
# Outputs
# =============================================================================

output "file_coordinator_sfn_arn" {
  description = "ARN of the FileCoordinator Step Functions state machine"
  value       = aws_sfn_state_machine.FileCoordinator.arn
}

output "file_coordinator_sfn_name" {
  description = "Name of the FileCoordinator Step Functions state machine"
  value       = aws_sfn_state_machine.FileCoordinator.name
}
