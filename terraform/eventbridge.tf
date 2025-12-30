# EventBridge Event Bus and Routing Rules
#
# Central event bus for media-downloader domain events.
# Events flow through EventBridge for loose coupling between Lambdas.
#
# Event Flow:
# 1. WebhookFeedly publishes DownloadRequested event
# 2. EventBridge rule routes to DownloadQueue (SQS)
# 3. StartFileUpload consumes from SQS
#
# @see src/types/events.ts for event type definitions
# @see terraform/download_queue.tf for SQS configuration

locals {
  event_bus_name = "${var.resource_prefix}-EventBus"
}

# Event Bus: Central routing for all domain events
resource "aws_cloudwatch_event_bus" "MediaDownloader" {
  name = local.event_bus_name

  tags = merge(local.common_tags, {
    Description = "Event bus for media-downloader domain events"
  })
}

# Rule: Route DownloadRequested events to DownloadQueue
resource "aws_cloudwatch_event_rule" "DownloadRequested" {
  name           = "${var.resource_prefix}-DownloadRequested"
  event_bus_name = aws_cloudwatch_event_bus.MediaDownloader.name
  description    = "Route DownloadRequested events to download processing queue"

  event_pattern = jsonencode({
    source      = ["media-downloader"]
    detail-type = ["DownloadRequested"]
  })
}

# Target: Send DownloadRequested events to DownloadQueue with transformation
resource "aws_cloudwatch_event_target" "DownloadRequestedToSQS" {
  rule           = aws_cloudwatch_event_rule.DownloadRequested.name
  event_bus_name = aws_cloudwatch_event_bus.MediaDownloader.name
  target_id      = "DownloadQueue"
  arn            = aws_sqs_queue.DownloadQueue.arn

  # Transform EventBridge envelope to DownloadQueueMessage structure
  # @see src/types/events.ts DownloadQueueMessage interface
  input_transformer {
    input_paths = {
      fileId        = "$.detail.fileId"
      sourceUrl     = "$.detail.sourceUrl"
      correlationId = "$.detail.correlationId"
      userId        = "$.detail.userId"
    }
    input_template = <<EOF
{
  "fileId": <fileId>,
  "sourceUrl": <sourceUrl>,
  "correlationId": <correlationId>,
  "userId": <userId>,
  "attempt": 1
}
EOF
  }
}

# IAM: Allow EventBridge to send messages to DownloadQueue
resource "aws_sqs_queue_policy" "DownloadQueueEventBridge" {
  queue_url = aws_sqs_queue.DownloadQueue.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowEventBridgeToSendMessage"
      Effect    = "Allow"
      Principal = { Service = "events.amazonaws.com" }
      Action    = "sqs:SendMessage"
      Resource  = aws_sqs_queue.DownloadQueue.arn
      Condition = {
        ArnEquals = {
          "aws:SourceArn" = aws_cloudwatch_event_rule.DownloadRequested.arn
        }
      }
    }]
  })
}

output "event_bus_name" {
  description = "EventBridge event bus name for media-downloader"
  value       = aws_cloudwatch_event_bus.MediaDownloader.name
}

output "event_bus_arn" {
  description = "EventBridge event bus ARN"
  value       = aws_cloudwatch_event_bus.MediaDownloader.arn
}
