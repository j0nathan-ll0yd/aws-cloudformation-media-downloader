# Download Queue - SQS queue for video download processing
#
# Replaces Lambda-to-Lambda async invocation with durable messaging.
# Messages flow from EventBridge DownloadRequested rule to this queue,
# then consumed by StartFileUpload Lambda.
#
# Error Handling:
# - Transient failures: SQS retries after visibility timeout
# - Permanent failures: After maxReceiveCount (3), message moves to DLQ
#
# @see terraform/eventbridge.tf for routing rules
# @see src/lambdas/StartFileUpload for consumer

locals {
  download_queue_name = "${var.resource_prefix}-DownloadQueue"
  # StartFileUpload timeout is 900s (15 min)
  # Visibility timeout should be 6x Lambda timeout = 5400s (90 min)
  download_queue_visibility_timeout = 5400
}

# Dead Letter Queue for failed download requests
# Messages that fail maxReceiveCount times are moved here for investigation
resource "aws_sqs_queue" "DownloadDLQ" {
  name                      = "${local.download_queue_name}-DLQ"
  message_retention_seconds = 1209600 # 14 days for investigation

  tags = merge(local.common_tags, {
    Purpose = "Dead letter queue for failed download requests"
  })
}

# Main Download Queue
# Receives messages from EventBridge DownloadRequested rule
resource "aws_sqs_queue" "DownloadQueue" {
  name                       = local.download_queue_name
  delay_seconds              = 0
  max_message_size           = 262144 # 256 KB
  message_retention_seconds  = 345600 # 4 days
  receive_wait_time_seconds  = 20     # Long polling for efficiency
  visibility_timeout_seconds = local.download_queue_visibility_timeout

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.DownloadDLQ.arn
    maxReceiveCount     = 3 # 3 retries before DLQ
  })

  tags = merge(local.common_tags, {
    Purpose = "Queue for video download requests"
  })
}

# Event Source Mapping: DownloadQueue -> StartFileUpload
# Triggers StartFileUpload Lambda when messages arrive in queue
resource "aws_lambda_event_source_mapping" "StartFileUploadSQS" {
  event_source_arn        = aws_sqs_queue.DownloadQueue.arn
  function_name           = aws_lambda_function.StartFileUpload.arn
  batch_size              = 1 # Process one download at a time (avoid rate limiting)
  function_response_types = ["ReportBatchItemFailures"]
}

# CloudWatch Alarm: Alert when messages are in DLQ
# DLQ messages indicate permanent failures requiring investigation
resource "aws_cloudwatch_metric_alarm" "DownloadDLQMessages" {
  count               = var.enable_cloudwatch_alarms ? 1 : 0
  alarm_name          = "${var.resource_prefix}-MediaDownloader-Download-DLQ-Messages"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Messages in Download DLQ require investigation"
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = aws_sqs_queue.DownloadDLQ.name
  }

  alarm_actions = [aws_sns_topic.OperationsAlerts[0].arn]
  ok_actions    = [aws_sns_topic.OperationsAlerts[0].arn]

  tags = local.common_tags
}

output "download_queue_url" {
  description = "Download Queue URL"
  value       = aws_sqs_queue.DownloadQueue.id
}

output "download_queue_arn" {
  description = "Download Queue ARN"
  value       = aws_sqs_queue.DownloadQueue.arn
}
