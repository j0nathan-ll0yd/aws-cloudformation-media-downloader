# EventBridge Infrastructure for Media Downloader
# Provides event-driven architecture with event replay capability

# =============================================================================
# Custom Event Bus
# =============================================================================

resource "aws_cloudwatch_event_bus" "MediaDownloaderEvents" {
  name = "MediaDownloaderEvents"
  tags = {
    Name        = "MediaDownloaderEvents"
    Description = "Custom event bus for media downloader workflow events"
  }
}

# =============================================================================
# Schema Discovery
# Auto-discovers event schemas from published events
# =============================================================================

resource "aws_schemas_discoverer" "MediaDownloaderDiscoverer" {
  source_arn  = aws_cloudwatch_event_bus.MediaDownloaderEvents.arn
  description = "Auto-discover schemas from MediaDownloaderEvents bus"
}

# =============================================================================
# Event Archive (90-day retention for replay capability)
# =============================================================================

resource "aws_cloudwatch_event_archive" "MediaDownloaderArchive" {
  name             = "MediaDownloaderEventsArchive"
  event_source_arn = aws_cloudwatch_event_bus.MediaDownloaderEvents.arn
  description      = "90-day archive for event replay and debugging"
  retention_days   = 90

  # Archive all events on the custom bus
  event_pattern = jsonencode({
    source = [{ prefix = "" }]
  })
}

# =============================================================================
# Dead Letter Queue for Failed Events
# =============================================================================

resource "aws_sqs_queue" "EventBridgeDLQ" {
  name                      = "EventBridgeDLQ"
  message_retention_seconds = 1209600 # 14 days
  tags = {
    Purpose = "EventBridge dead letter queue for failed event delivery"
  }
}

# =============================================================================
# CloudWatch Alarm for DLQ Messages
# =============================================================================

resource "aws_cloudwatch_metric_alarm" "EventBridgeDLQAlarm" {
  alarm_name          = "EventBridgeDLQMessages"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Alert when events fail delivery to EventBridge targets"

  dimensions = {
    QueueName = aws_sqs_queue.EventBridgeDLQ.name
  }

  # TODO: Add SNS topic ARN for alerts when monitoring is configured
  alarm_actions = []
}

# =============================================================================
# EventBridge Rules for Audit Logging
# =============================================================================

# Log all FileUploaded events
resource "aws_cloudwatch_event_rule" "FileUploadedToLogs" {
  name           = "FileUploadedToLogs"
  event_bus_name = aws_cloudwatch_event_bus.MediaDownloaderEvents.name
  description    = "Route FileUploaded events to CloudWatch Logs for audit"

  event_pattern = jsonencode({
    source      = [{ prefix = "" }]
    detail-type = ["FileUploaded"]
  })
}

resource "aws_cloudwatch_log_group" "FileUploadedEvents" {
  name              = "/aws/events/FileUploaded"
  retention_in_days = 14
}

resource "aws_cloudwatch_event_target" "FileUploadedToLogs" {
  rule           = aws_cloudwatch_event_rule.FileUploadedToLogs.name
  event_bus_name = aws_cloudwatch_event_bus.MediaDownloaderEvents.name
  target_id      = "CloudWatchLogs"
  arn            = aws_cloudwatch_log_group.FileUploadedEvents.arn
}

# Log all NotificationQueued events
resource "aws_cloudwatch_event_rule" "NotificationQueuedToLogs" {
  name           = "NotificationQueuedToLogs"
  event_bus_name = aws_cloudwatch_event_bus.MediaDownloaderEvents.name
  description    = "Route NotificationQueued events to CloudWatch Logs for audit"

  event_pattern = jsonencode({
    source      = [{ prefix = "" }]
    detail-type = ["NotificationQueued"]
  })
}

resource "aws_cloudwatch_log_group" "NotificationQueuedEvents" {
  name              = "/aws/events/NotificationQueued"
  retention_in_days = 14
}

resource "aws_cloudwatch_event_target" "NotificationQueuedToLogs" {
  rule           = aws_cloudwatch_event_rule.NotificationQueuedToLogs.name
  event_bus_name = aws_cloudwatch_event_bus.MediaDownloaderEvents.name
  target_id      = "CloudWatchLogs"
  arn            = aws_cloudwatch_log_group.NotificationQueuedEvents.arn
}

# Log all FileDownloadFailed events
resource "aws_cloudwatch_event_rule" "FileDownloadFailedToLogs" {
  name           = "FileDownloadFailedToLogs"
  event_bus_name = aws_cloudwatch_event_bus.MediaDownloaderEvents.name
  description    = "Route FileDownloadFailed events to CloudWatch Logs for audit"

  event_pattern = jsonencode({
    source      = [{ prefix = "" }]
    detail-type = ["FileDownloadFailed"]
  })
}

resource "aws_cloudwatch_log_group" "FileDownloadFailedEvents" {
  name              = "/aws/events/FileDownloadFailed"
  retention_in_days = 14
}

resource "aws_cloudwatch_event_target" "FileDownloadFailedToLogs" {
  rule           = aws_cloudwatch_event_rule.FileDownloadFailedToLogs.name
  event_bus_name = aws_cloudwatch_event_bus.MediaDownloaderEvents.name
  target_id      = "CloudWatchLogs"
  arn            = aws_cloudwatch_log_group.FileDownloadFailedEvents.arn
}

# =============================================================================
# CloudWatch Log Resource Policy for EventBridge
# =============================================================================

resource "aws_cloudwatch_log_resource_policy" "EventBridgeLogging" {
  policy_name = "EventBridgeLogging"
  policy_document = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "events.amazonaws.com" }
      Action    = ["logs:CreateLogStream", "logs:PutLogEvents"]
      Resource  = "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:/aws/events/*"
    }]
  })
}

# =============================================================================
# Outputs
# =============================================================================

output "eventbridge_bus_arn" {
  description = "ARN of the MediaDownloaderEvents bus"
  value       = aws_cloudwatch_event_bus.MediaDownloaderEvents.arn
}

output "eventbridge_bus_name" {
  description = "Name of the MediaDownloaderEvents bus"
  value       = aws_cloudwatch_event_bus.MediaDownloaderEvents.name
}

output "event_archive_arn" {
  description = "ARN of the EventBridge archive for replay"
  value       = aws_cloudwatch_event_archive.MediaDownloaderArchive.arn
}
