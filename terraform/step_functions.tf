# Step Functions State Machine for File Download Workflow
# Replaces FileCoordinator Lambda with visual, retryable orchestration

# IAM role for Step Functions state machine execution
resource "aws_iam_role" "FileDownloadWorkflow" {
  name               = "FileDownloadWorkflow"
  assume_role_policy = data.aws_iam_policy_document.StatesAssumeRole.json
}

# Policy for state machine to interact with DynamoDB, Lambda, and EventBridge
data "aws_iam_policy_document" "FileDownloadWorkflow" {
  # Query DynamoDB StatusIndex for PendingDownload files
  statement {
    actions = [
      "dynamodb:Query",
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem"
    ]
    resources = [
      aws_dynamodb_table.MediaDownloader.arn,
      "${aws_dynamodb_table.MediaDownloader.arn}/index/StatusIndex"
    ]
  }

  # Invoke Lambda functions
  statement {
    actions   = ["lambda:InvokeFunction"]
    resources = [
      aws_lambda_function.StartFileUpload.arn,
      aws_lambda_function.SendPushNotification.arn
    ]
  }

  # Publish events to EventBridge
  statement {
    actions = ["events:PutEvents"]
    resources = [
      aws_cloudwatch_event_bus.MediaDownloader.arn,
      "arn:aws:events:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:event-bus/default"
    ]
  }

  # X-Ray tracing
  statement {
    actions = [
      "xray:PutTraceSegments",
      "xray:PutTelemetryRecords"
    ]
    resources = ["*"]
  }

  # CloudWatch Logs for state machine execution history
  statement {
    actions = [
      "logs:CreateLogDelivery",
      "logs:GetLogDelivery",
      "logs:UpdateLogDelivery",
      "logs:DeleteLogDelivery",
      "logs:ListLogDeliveries",
      "logs:PutResourcePolicy",
      "logs:DescribeResourcePolicies",
      "logs:DescribeLogGroups"
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "FileDownloadWorkflow" {
  name   = "FileDownloadWorkflow"
  policy = data.aws_iam_policy_document.FileDownloadWorkflow.json
}

resource "aws_iam_role_policy_attachment" "FileDownloadWorkflow" {
  role       = aws_iam_role.FileDownloadWorkflow.name
  policy_arn = aws_iam_policy.FileDownloadWorkflow.arn
}

# CloudWatch Log Group for Step Functions execution logs
resource "aws_cloudwatch_log_group" "FileDownloadWorkflow" {
  name              = "/aws/states/FileDownloadWorkflow"
  retention_in_days = 14
}

# Step Functions State Machine
resource "aws_sfn_state_machine" "FileDownloadWorkflow" {
  name     = "FileDownloadWorkflow"
  role_arn = aws_iam_role.FileDownloadWorkflow.arn

  logging_configuration {
    log_destination        = "${aws_cloudwatch_log_group.FileDownloadWorkflow.arn}:*"
    include_execution_data = true
    level                  = "ALL"
  }

  tracing_configuration {
    enabled = true
  }

  definition = jsonencode({
    Comment = "Media download workflow with visual debugging and built-in retry"
    StartAt = "CheckFileStatus"
    States = {
      # Query DynamoDB to check if file already exists
      CheckFileStatus = {
        Type     = "Task"
        Resource = "arn:aws:states:::dynamodb:getItem"
        Parameters = {
          TableName = aws_dynamodb_table.MediaDownloader.name
          Key = {
            PK = {
              "S.$" = "States.Format('FILE#{}', $.fileId)"
            }
            SK = {
              S = "FILE"
            }
          }
        }
        ResultPath = "$.fileData"
        Next       = "FileExists"
        Catch = [{
          ErrorEquals = ["States.ALL"]
          ResultPath  = "$.error"
          Next        = "HandleError"
        }]
      }

      # Choice state: Does file exist in DynamoDB?
      FileExists = {
        Type = "Choice"
        Choices = [{
          Variable      = "$.fileData.Item"
          IsPresent     = true
          Next          = "CheckDownloadStatus"
        }]
        Default = "CreateFileRecord"
      }

      # Create initial file record if it doesn't exist
      CreateFileRecord = {
        Type     = "Task"
        Resource = "arn:aws:states:::dynamodb:putItem"
        Parameters = {
          TableName = aws_dynamodb_table.MediaDownloader.name
          Item = {
            PK = {
              "S.$" = "States.Format('FILE#{}', $.fileId)"
            }
            SK = {
              S = "FILE"
            }
            fileId = {
              "S.$" = "$.fileId"
            }
            status = {
              S = "PendingMetadata"
            }
            availableAt = {
              "N.$" = "States.Format('{}', $$.State.EnteredTime)"
            }
            size = {
              N = "0"
            }
            authorName = {
              S = ""
            }
            authorUser = {
              S = ""
            }
            publishDate = {
              "S.$" = "$$.State.EnteredTime"
            }
            description = {
              S = ""
            }
            key = {
              "S.$" = "$.fileId"
            }
            contentType = {
              S = ""
            }
            title = {
              S = ""
            }
          }
        }
        ResultPath = "$.createResult"
        Next       = "StartDownload"
        Catch = [{
          ErrorEquals = ["States.ALL"]
          ResultPath  = "$.error"
          Next        = "HandleError"
        }]
      }

      # Check if file is already downloaded
      CheckDownloadStatus = {
        Type = "Choice"
        Choices = [{
          Variable      = "$.fileData.Item.status.S"
          StringEquals  = "Downloaded"
          Next          = "AlreadyDownloaded"
        }]
        Default = "CheckAvailability"
      }

      # Check if file is available for download (availableAt <= now)
      CheckAvailability = {
        Type = "Choice"
        Choices = [{
          Variable     = "$.fileData.Item.availableAt.N"
          NumericLessThanEqualsPath = "$$.State.EnteredTime"
          Next         = "StartDownload"
        }]
        Default = "NotYetAvailable"
      }

      # File not yet available for download
      NotYetAvailable = {
        Type = "Succeed"
      }

      # File already downloaded - publish event for notification
      AlreadyDownloaded = {
        Type     = "Task"
        Resource = "arn:aws:states:::events:putEvents"
        Parameters = {
          Entries = [{
            Source       = "aws.mediadownloader.workflow"
            DetailType   = "FileAlreadyDownloaded"
            Detail = {
              "fileId.$" = "$.fileId"
            }
            EventBusName = aws_cloudwatch_event_bus.MediaDownloader.name
          }]
        }
        ResultPath = "$.eventResult"
        Next       = "AlreadyDownloadedSuccess"
      }

      AlreadyDownloadedSuccess = {
        Type = "Succeed"
      }

      # Invoke StartFileUpload Lambda with retry logic
      StartDownload = {
        Type     = "Task"
        Resource = "arn:aws:states:::lambda:invoke"
        Parameters = {
          FunctionName = aws_lambda_function.StartFileUpload.arn
          Payload = {
            "fileId.$" = "$.fileId"
          }
        }
        ResultPath = "$.downloadResult"
        Next       = "PublishDownloadStarted"
        # Built-in retry with exponential backoff
        Retry = [{
          ErrorEquals     = ["States.TaskFailed", "Lambda.ServiceException", "Lambda.TooManyRequestsException"]
          IntervalSeconds = 2
          MaxAttempts     = 3
          BackoffRate     = 2.0
        }]
        Catch = [{
          ErrorEquals = ["States.ALL"]
          ResultPath  = "$.error"
          Next        = "DownloadFailed"
        }]
      }

      # Publish FileDownloadStarted event to EventBridge
      PublishDownloadStarted = {
        Type     = "Task"
        Resource = "arn:aws:states:::events:putEvents"
        Parameters = {
          Entries = [{
            Source       = "aws.mediadownloader.download"
            DetailType   = "FileDownloadStarted"
            Detail = {
              "fileId.$"    = "$.fileId"
              "timestamp.$" = "$$.State.EnteredTime"
            }
            EventBusName = aws_cloudwatch_event_bus.MediaDownloader.name
          }]
        }
        ResultPath = "$.eventResult"
        Next       = "DownloadSuccess"
      }

      # Download succeeded
      DownloadSuccess = {
        Type = "Succeed"
      }

      # Download failed - publish failure event
      DownloadFailed = {
        Type     = "Task"
        Resource = "arn:aws:states:::events:putEvents"
        Parameters = {
          Entries = [{
            Source       = "aws.mediadownloader.download"
            DetailType   = "FileDownloadFailed"
            Detail = {
              "fileId.$"    = "$.fileId"
              "error.$"     = "$.error.Error"
              "timestamp.$" = "$$.State.EnteredTime"
            }
            EventBusName = aws_cloudwatch_event_bus.MediaDownloader.name
          }]
        }
        ResultPath = "$.eventResult"
        Next       = "DownloadFailure"
      }

      DownloadFailure = {
        Type = "Fail"
        Error = "DownloadFailed"
        Cause = "File download failed after retries"
      }

      # Generic error handler
      HandleError = {
        Type = "Fail"
        Error = "WorkflowError"
        Cause = "An error occurred in the workflow"
      }
    }
  })

  tags = {
    Name        = "FileDownloadWorkflow"
    Description = "Orchestrates file download with retry logic and event publishing"
  }
}

# EventBridge rule to trigger state machine on FileMetadataReady event
resource "aws_cloudwatch_event_rule" "TriggerFileDownload" {
  name           = "TriggerFileDownload"
  description    = "Trigger file download workflow when metadata is ready"
  event_bus_name = aws_cloudwatch_event_bus.MediaDownloader.name
  state          = "ENABLED"

  event_pattern = jsonencode({
    source      = ["aws.mediadownloader.metadata"]
    detail-type = ["FileMetadataReady"]
  })
}

# Target the Step Functions state machine from EventBridge
resource "aws_cloudwatch_event_target" "FileDownloadWorkflow" {
  rule           = aws_cloudwatch_event_rule.TriggerFileDownload.name
  event_bus_name = aws_cloudwatch_event_bus.MediaDownloader.name
  arn            = aws_sfn_state_machine.FileDownloadWorkflow.arn
  role_arn       = aws_iam_role.EventBridgeInvokeTargets.arn

  # Transform EventBridge event to state machine input
  input_transformer {
    input_paths = {
      fileId = "$.detail.fileId"
    }
    input_template = jsonencode({
      fileId = "<fileId>"
    })
  }
}

# Outputs
output "state_machine_arn" {
  value       = aws_sfn_state_machine.FileDownloadWorkflow.arn
  description = "ARN of the FileDownloadWorkflow state machine"
}

output "state_machine_name" {
  value       = aws_sfn_state_machine.FileDownloadWorkflow.name
  description = "Name of the FileDownloadWorkflow state machine"
}
