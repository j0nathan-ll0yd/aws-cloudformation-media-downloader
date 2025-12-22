# EventBridge Event Bus for Architecture 2.0 - Hybrid Event-Driven Core
# This replaces the polling-based FileCoordinator with event-driven orchestration
# Events: DownloadRequested, DownloadCompleted, DownloadFailed

resource "aws_cloudwatch_event_bus" "media_downloader" {
  name = "media-downloader"
  tags = {
    Purpose = "Event-driven orchestration for media downloads"
  }
}

# DownloadQueue - Main queue for file download requests
resource "aws_sqs_queue" "DownloadQueue" {
  name                       = "DownloadQueue"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 345600 # 4 days
  receive_wait_time_seconds  = 0
  visibility_timeout_seconds = 900 # 15 minutes (matching StartFileUpload timeout)

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.DownloadDLQ.arn
    maxReceiveCount     = 3
  })

  tags = {
    Purpose = "Buffer for incoming download requests"
  }
}

# DownloadDLQ - Dead Letter Queue for permanently failed downloads
resource "aws_sqs_queue" "DownloadDLQ" {
  name                      = "DownloadQueue-DLQ"
  message_retention_seconds = 1209600 # 14 days for investigation
  tags = {
    Purpose = "Captures permanently failed download requests"
  }
}

# EventBridge Rule: DownloadRequested -> DownloadQueue (SQS)
# Triggered by: WebhookFeedly, API
resource "aws_cloudwatch_event_rule" "download_requested" {
  name           = "DownloadRequested"
  description    = "Route DownloadRequested events to DownloadQueue"
  event_bus_name = aws_cloudwatch_event_bus.media_downloader.name

  event_pattern = jsonencode({
    "detail-type" : ["DownloadRequested"]
  })
}

resource "aws_cloudwatch_event_target" "download_requested_to_queue" {
  rule           = aws_cloudwatch_event_rule.download_requested.name
  event_bus_name = aws_cloudwatch_event_bus.media_downloader.name
  target_id      = "DownloadQueueTarget"
  arn            = aws_sqs_queue.DownloadQueue.arn
}

# EventBridge Rule: DownloadCompleted
# Triggered by: StartFileUpload (success)
# Note: No targets yet - will be consumed by Sync Engine (issue #199)
resource "aws_cloudwatch_event_rule" "download_completed" {
  name           = "DownloadCompleted"
  description    = "Captures DownloadCompleted events for future Sync Engine consumption"
  event_bus_name = aws_cloudwatch_event_bus.media_downloader.name

  event_pattern = jsonencode({
    "detail-type" : ["DownloadCompleted"]
  })
}

# EventBridge Rule: DownloadFailed
# Triggered by: StartFileUpload (permanent failure)
# Note: No targets yet - will be consumed by Sync Engine (issue #199)
resource "aws_cloudwatch_event_rule" "download_failed" {
  name           = "DownloadFailed"
  description    = "Captures DownloadFailed events for future Sync Engine consumption"
  event_bus_name = aws_cloudwatch_event_bus.media_downloader.name

  event_pattern = jsonencode({
    "detail-type" : ["DownloadFailed"]
  })
}

# IAM policy for EventBridge to send messages to DownloadQueue
data "aws_iam_policy_document" "eventbridge_to_download_queue" {
  statement {
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.DownloadQueue.arn]
    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values   = [aws_cloudwatch_event_rule.download_requested.arn]
    }
  }
}

resource "aws_sqs_queue_policy" "eventbridge_to_download_queue" {
  queue_url = aws_sqs_queue.DownloadQueue.id
  policy    = data.aws_iam_policy_document.eventbridge_to_download_queue.json
}

# Lambda Event Source Mapping: DownloadQueue -> StartFileUpload
resource "aws_lambda_event_source_mapping" "download_queue_to_start_file_upload" {
  event_source_arn        = aws_sqs_queue.DownloadQueue.arn
  function_name           = aws_lambda_function.StartFileUpload.arn
  batch_size              = 1 # Process one download at a time for isolation
  function_response_types = ["ReportBatchItemFailures"]
}
