# CloudWatch Monitoring for EventBridge and Step Functions
# Provides operational visibility into the event-driven architecture

# =============================================================================
# CloudWatch Dashboard
# =============================================================================

resource "aws_cloudwatch_dashboard" "MediaDownloader" {
  dashboard_name = "MediaDownloader"

  dashboard_body = jsonencode({
    widgets = [
      # Header
      {
        type   = "text"
        x      = 0
        y      = 0
        width  = 24
        height = 1
        properties = {
          markdown = "# Media Downloader Dashboard\n## Step Functions & EventBridge Metrics"
        }
      },
      # Step Functions Executions
      {
        type   = "metric"
        x      = 0
        y      = 1
        width  = 12
        height = 6
        properties = {
          title  = "FileCoordinator Step Functions Executions"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/States", "ExecutionsStarted", "StateMachineArn", aws_sfn_state_machine.FileCoordinator.arn, { label = "Started" }],
            [".", "ExecutionsSucceeded", ".", ".", { label = "Succeeded" }],
            [".", "ExecutionsFailed", ".", ".", { label = "Failed" }],
            [".", "ExecutionsTimedOut", ".", ".", { label = "Timed Out" }]
          ]
          period = 300
          stat   = "Sum"
          view   = "timeSeries"
        }
      },
      # Step Functions Duration
      {
        type   = "metric"
        x      = 12
        y      = 1
        width  = 12
        height = 6
        properties = {
          title  = "FileCoordinator Execution Duration"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/States", "ExecutionTime", "StateMachineArn", aws_sfn_state_machine.FileCoordinator.arn, { label = "Avg Duration" }]
          ]
          period = 300
          stat   = "Average"
          view   = "timeSeries"
        }
      },
      # EventBridge Events
      {
        type   = "metric"
        x      = 0
        y      = 7
        width  = 12
        height = 6
        properties = {
          title  = "EventBridge Events"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/Events", "Invocations", "EventBusName", aws_cloudwatch_event_bus.MediaDownloaderEvents.name, { label = "Invocations" }],
            [".", "FailedInvocations", ".", ".", { label = "Failed" }],
            [".", "MatchedEvents", ".", ".", { label = "Matched" }]
          ]
          period = 300
          stat   = "Sum"
          view   = "timeSeries"
        }
      },
      # StartFileUpload Lambda
      {
        type   = "metric"
        x      = 12
        y      = 7
        width  = 12
        height = 6
        properties = {
          title  = "StartFileUpload Lambda"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", "StartFileUpload", { label = "Invocations" }],
            [".", "Errors", ".", ".", { label = "Errors" }],
            [".", "Duration", ".", ".", { stat = "Average", label = "Avg Duration" }]
          ]
          period = 300
          stat   = "Sum"
          view   = "timeSeries"
        }
      },
      # DLQ Messages
      {
        type   = "metric"
        x      = 0
        y      = 13
        width  = 12
        height = 6
        properties = {
          title  = "EventBridge Dead Letter Queue"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", aws_sqs_queue.EventBridgeDLQ.name, { label = "Messages" }],
            [".", "NumberOfMessagesSent", ".", ".", { label = "Messages Sent" }]
          ]
          period = 300
          stat   = "Sum"
          view   = "timeSeries"
        }
      },
      # Push Notification Queue
      {
        type   = "metric"
        x      = 12
        y      = 13
        width  = 12
        height = 6
        properties = {
          title  = "Push Notification Queue"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", aws_sqs_queue.SendPushNotification.name, { label = "Pending" }],
            [".", "NumberOfMessagesSent", ".", ".", { label = "Sent" }],
            [".", "NumberOfMessagesReceived", ".", ".", { label = "Received" }]
          ]
          period = 300
          stat   = "Sum"
          view   = "timeSeries"
        }
      }
    ]
  })
}

# =============================================================================
# CloudWatch Alarms
# =============================================================================

# Alarm: Step Functions Failures
resource "aws_cloudwatch_metric_alarm" "StepFunctionsFailures" {
  alarm_name          = "FileCoordinatorSfnFailures"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ExecutionsFailed"
  namespace           = "AWS/States"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "FileCoordinator Step Functions execution failures - investigate CloudWatch Logs"
  treat_missing_data  = "notBreaching"

  dimensions = {
    StateMachineArn = aws_sfn_state_machine.FileCoordinator.arn
  }

  # TODO: Add SNS topic ARN for alerts
  alarm_actions = []
}

# Alarm: Step Functions Timeouts
resource "aws_cloudwatch_metric_alarm" "StepFunctionsTimeouts" {
  alarm_name          = "FileCoordinatorSfnTimeouts"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ExecutionsTimedOut"
  namespace           = "AWS/States"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "FileCoordinator Step Functions execution timeouts"
  treat_missing_data  = "notBreaching"

  dimensions = {
    StateMachineArn = aws_sfn_state_machine.FileCoordinator.arn
  }

  alarm_actions = []
}

# Alarm: StartFileUpload Lambda Errors
resource "aws_cloudwatch_metric_alarm" "StartFileUploadErrors" {
  alarm_name          = "StartFileUploadErrors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "StartFileUpload Lambda errors - check CloudWatch Logs"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = "StartFileUpload"
  }

  alarm_actions = []
}

# =============================================================================
# Outputs
# =============================================================================

output "dashboard_url" {
  description = "URL to the CloudWatch dashboard"
  value       = "https://${data.aws_region.current.name}.console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.name}#dashboards:name=${aws_cloudwatch_dashboard.MediaDownloader.dashboard_name}"
}
