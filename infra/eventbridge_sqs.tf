# EventBridge Event Bus and Routing Rules
#
# Central event bus for media-downloader domain events.
# Events flow through EventBridge for loose coupling between Lambdas.
#
# Event Flow:
# 1. WebhookFeedly publishes DownloadRequested event
# 2. EventBridge rule routes to DownloadQueue (SQS)
# 3. StartFileUpload consumes from SQS

# Event Bus: Central routing for all domain events
resource "aws_cloudwatch_event_bus" "media_downloader" {
  name = local.event_bus_name
  tags = merge(module.core.common_tags, {
    Description = "Event bus for media-downloader domain events"
  })
}

# Rule: Route DownloadRequested events to DownloadQueue
resource "aws_cloudwatch_event_rule" "download_requested" {
  name           = "DownloadRequested"
  event_bus_name = aws_cloudwatch_event_bus.media_downloader.name
  description    = "Route DownloadRequested events to download processing queue"

  event_pattern = jsonencode({
    source      = ["media-downloader"]
    detail-type = ["DownloadRequested"]
  })
}

# Target: Send DownloadRequested events to DownloadQueue with transformation
resource "aws_cloudwatch_event_target" "download_requested_to_sqs" {
  rule           = aws_cloudwatch_event_rule.download_requested.name
  event_bus_name = aws_cloudwatch_event_bus.media_downloader.name
  target_id      = "DownloadQueue"
  arn            = aws_sqs_queue.download_queue.arn

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
resource "aws_sqs_queue_policy" "download_queue_eventbridge" {
  queue_url = aws_sqs_queue.download_queue.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowEventBridgeToSendMessage"
      Effect    = "Allow"
      Principal = { Service = "events.amazonaws.com" }
      Action    = "sqs:SendMessage"
      Resource  = aws_sqs_queue.download_queue.arn
      Condition = {
        ArnEquals = {
          "aws:SourceArn" = aws_cloudwatch_event_rule.download_requested.arn
        }
      }
    }]
  })
}

# --- SQS Queues ---

# Download Queue (StartFileUpload consumer)
resource "aws_sqs_queue" "download_dlq" {
  name                      = "${module.core.name_prefix}-DownloadQueue-DLQ"
  message_retention_seconds = 1209600
  tags = merge(module.core.common_tags, {
    Purpose = "Dead letter queue for failed download requests"
  })
}

resource "aws_sqs_queue" "download_queue" {
  name                       = "${module.core.name_prefix}-DownloadQueue"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 345600
  receive_wait_time_seconds  = 20
  visibility_timeout_seconds = 5400

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.download_dlq.arn
    maxReceiveCount     = 3
  })

  tags = merge(module.core.common_tags, {
    Purpose = "Queue for video download requests"
  })
}

# Send Push Notification Queue
resource "aws_sqs_queue" "push_notification_dlq" {
  name                      = "${module.core.name_prefix}-SendPushNotification-DLQ"
  message_retention_seconds = 1209600
  tags = merge(module.core.common_tags, {
    Purpose = "Dead letter queue for failed push notifications"
  })
}

resource "aws_sqs_queue" "push_notification_queue" {
  name                       = "${module.core.name_prefix}-SendPushNotification"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 345600
  receive_wait_time_seconds  = 20
  visibility_timeout_seconds = 180

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.push_notification_dlq.arn
    maxReceiveCount     = 3
  })

  tags = merge(module.core.common_tags, {
    Purpose = "Queue for push notification delivery"
  })
}
