# CloudWatch Dashboard for Media Downloader
# Provides visibility into Lambda performance, storage, and API metrics
# See: https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/issues/147

locals {
  lambda_functions = [
    "ApiGatewayAuthorizer",
    "CloudfrontMiddleware",
    "ListFiles",
    "LogClientEvent",
    "LoginUser",
    "PruneDevices",
    "RefreshToken",
    "RegisterDevice",
    "RegisterUser",
    "S3ObjectCreated",
    "SendPushNotification",
    "StartFileUpload",
    "UserDelete",
    "UserSubscribe",
    "WebhookFeedly"
  ]

  # Split lambdas into groups for CloudWatch alarms (max 10 metrics per alarm)
  lambda_functions_api = [
    "ApiGatewayAuthorizer",
    "ListFiles",
    "LogClientEvent",
    "LoginUser",
    "RefreshToken",
    "RegisterDevice",
    "RegisterUser",
    "UserDelete",
    "UserSubscribe",
    "WebhookFeedly"
  ]

  lambda_functions_background = [
    "CloudfrontMiddleware",
    "PruneDevices",
    "S3ObjectCreated",
    "SendPushNotification",
    "StartFileUpload"
  ]
}

resource "aws_cloudwatch_dashboard" "Main" {
  dashboard_name = "MediaDownloader"

  dashboard_body = jsonencode({
    widgets = [
      # Row 1: Lambda Invocations
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          title   = "Lambda Invocations"
          region  = data.aws_region.current.id
          stat    = "Sum"
          period  = 300
          view    = "timeSeries"
          stacked = true
          metrics = [for fn in local.lambda_functions : ["AWS/Lambda", "Invocations", "FunctionName", fn]]
        }
      },
      # Row 1: Lambda Errors
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          title   = "Lambda Errors"
          region  = data.aws_region.current.id
          stat    = "Sum"
          period  = 300
          view    = "timeSeries"
          metrics = [for fn in local.lambda_functions : ["AWS/Lambda", "Errors", "FunctionName", fn]]
          annotations = {
            horizontal = [
              {
                label = "Error Threshold"
                value = 5
                color = "#d62728"
              }
            ]
          }
        }
      },
      # Row 2: Lambda Duration (P50/P95)
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 8
        height = 6
        properties = {
          title  = "Lambda Duration (ms)"
          region = data.aws_region.current.id
          period = 300
          view   = "timeSeries"
          metrics = concat(
            [for fn in local.lambda_functions : ["AWS/Lambda", "Duration", "FunctionName", fn, { stat = "p50", label = "${fn} p50" }]],
            [for fn in local.lambda_functions : ["AWS/Lambda", "Duration", "FunctionName", fn, { stat = "p95", label = "${fn} p95" }]]
          )
        }
      },
      # Row 2: Cold Starts (Init Duration)
      {
        type   = "metric"
        x      = 8
        y      = 6
        width  = 8
        height = 6
        properties = {
          title   = "Lambda Cold Starts (Init Duration)"
          region  = data.aws_region.current.id
          stat    = "Average"
          period  = 300
          view    = "timeSeries"
          metrics = [for fn in local.lambda_functions : ["AWS/Lambda", "InitDuration", "FunctionName", fn]]
        }
      },
      # Row 2: Throttles
      {
        type   = "metric"
        x      = 16
        y      = 6
        width  = 8
        height = 6
        properties = {
          title   = "Lambda Throttles (should be 0)"
          region  = data.aws_region.current.id
          stat    = "Sum"
          period  = 300
          view    = "timeSeries"
          metrics = [for fn in local.lambda_functions : ["AWS/Lambda", "Throttles", "FunctionName", fn]]
          annotations = {
            horizontal = [
              {
                label = "Any throttle is bad"
                value = 1
                color = "#d62728"
              }
            ]
          }
        }
      },
      # Row 3: S3 Storage
      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 12
        height = 6
        properties = {
          title  = "S3 Storage (Bytes)"
          region = data.aws_region.current.id
          stat   = "Average"
          period = 86400
          view   = "timeSeries"
          metrics = [
            ["AWS/S3", "BucketSizeBytes", "BucketName", aws_s3_bucket.Files.id, "StorageType", "StandardStorage"]
          ]
        }
      },
      # Row 3: S3 Object Count
      {
        type   = "metric"
        x      = 12
        y      = 12
        width  = 12
        height = 6
        properties = {
          title  = "S3 Object Count"
          region = data.aws_region.current.id
          stat   = "Average"
          period = 86400
          view   = "timeSeries"
          metrics = [
            ["AWS/S3", "NumberOfObjects", "BucketName", aws_s3_bucket.Files.id, "StorageType", "AllStorageTypes"]
          ]
        }
      },
      # Row 4: API Gateway Requests
      {
        type   = "metric"
        x      = 0
        y      = 18
        width  = 12
        height = 6
        properties = {
          title  = "API Gateway Requests"
          region = data.aws_region.current.id
          stat   = "Sum"
          period = 300
          view   = "timeSeries"
          metrics = [
            ["AWS/ApiGateway", "Count", "ApiName", aws_api_gateway_rest_api.Main.name],
            ["AWS/ApiGateway", "4XXError", "ApiName", aws_api_gateway_rest_api.Main.name],
            ["AWS/ApiGateway", "5XXError", "ApiName", aws_api_gateway_rest_api.Main.name]
          ]
        }
      },
      # Row 4: API Gateway Latency
      {
        type   = "metric"
        x      = 12
        y      = 18
        width  = 12
        height = 6
        properties = {
          title  = "API Gateway Latency (ms)"
          region = data.aws_region.current.id
          period = 300
          view   = "timeSeries"
          metrics = [
            ["AWS/ApiGateway", "Latency", "ApiName", aws_api_gateway_rest_api.Main.name, { stat = "p50", label = "p50" }],
            ["AWS/ApiGateway", "Latency", "ApiName", aws_api_gateway_rest_api.Main.name, { stat = "p95", label = "p95" }],
            ["AWS/ApiGateway", "IntegrationLatency", "ApiName", aws_api_gateway_rest_api.Main.name, { stat = "p50", label = "Integration p50" }]
          ]
        }
      },
      # Row 5: SQS Queue Depth
      {
        type   = "metric"
        x      = 0
        y      = 24
        width  = 12
        height = 6
        properties = {
          title  = "SQS Queue Depth"
          region = data.aws_region.current.id
          stat   = "Average"
          period = 300
          view   = "timeSeries"
          metrics = [
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", aws_sqs_queue.SendPushNotification.name, { label = "Push Notification Queue" }],
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", aws_sqs_queue.SendPushNotificationDLQ.name, { label = "Push Notification DLQ", color = "#d62728" }],
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", aws_sqs_queue.DownloadQueue.name, { label = "Download Queue" }],
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", aws_sqs_queue.DownloadDLQ.name, { label = "Download DLQ", color = "#ff7f0e" }]
          ]
        }
      },
      # Row 5: SQS Message Age
      {
        type   = "metric"
        x      = 12
        y      = 24
        width  = 12
        height = 6
        properties = {
          title  = "SQS Message Age (seconds)"
          region = data.aws_region.current.id
          stat   = "Maximum"
          period = 300
          view   = "timeSeries"
          metrics = [
            ["AWS/SQS", "ApproximateAgeOfOldestMessage", "QueueName", aws_sqs_queue.SendPushNotification.name, { label = "Push Notification Queue" }],
            ["AWS/SQS", "ApproximateAgeOfOldestMessage", "QueueName", aws_sqs_queue.DownloadQueue.name, { label = "Download Queue" }]
          ]
          annotations = {
            horizontal = [
              {
                label = "1 hour threshold"
                value = 3600
                color = "#d62728"
              }
            ]
          }
        }
      },
      # Row 6: EventBridge Pipeline Health
      {
        type   = "metric"
        x      = 0
        y      = 30
        width  = 12
        height = 6
        properties = {
          title  = "EventBridge Pipeline Health"
          region = data.aws_region.current.id
          stat   = "Sum"
          period = 300
          view   = "timeSeries"
          metrics = [
            ["AWS/Events", "Invocations", "RuleName", aws_cloudwatch_event_rule.DownloadRequested.name, { label = "DownloadRequested Invocations" }],
            ["AWS/Events", "MatchedEvents", "RuleName", aws_cloudwatch_event_rule.DownloadRequested.name, { label = "Matched Events" }],
            ["AWS/Events", "FailedInvocations", "RuleName", aws_cloudwatch_event_rule.DownloadRequested.name, { label = "Failed Invocations", color = "#d62728" }],
            ["AWS/Events", "ThrottledRules", "RuleName", aws_cloudwatch_event_rule.DownloadRequested.name, { label = "Throttled", color = "#ff7f0e" }]
          ]
        }
      },
      # Row 6: Event-Driven Flow Summary
      {
        type   = "metric"
        x      = 12
        y      = 30
        width  = 12
        height = 6
        properties = {
          title  = "Event-Driven Flow (Webhook to Notification)"
          region = data.aws_region.current.id
          stat   = "Sum"
          period = 300
          view   = "timeSeries"
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", "WebhookFeedly", { label = "1. WebhookFeedly" }],
            ["AWS/Events", "Invocations", "RuleName", aws_cloudwatch_event_rule.DownloadRequested.name, { label = "2. EventBridge" }],
            ["AWS/Lambda", "Invocations", "FunctionName", "StartFileUpload", { label = "3. StartFileUpload" }],
            ["AWS/Lambda", "Invocations", "FunctionName", "S3ObjectCreated", { label = "4. S3ObjectCreated" }],
            ["AWS/Lambda", "Invocations", "FunctionName", "SendPushNotification", { label = "5. SendPushNotification" }]
          ]
        }
      }
    ]
  })
}

# =============================================================================
# CloudWatch Alarms
# Note: SNS notification actions deferred - add alarm_actions when SNS configured
# =============================================================================

# Lambda Errors Alarm (API) - triggers when total errors across API Lambdas exceed threshold
resource "aws_cloudwatch_metric_alarm" "LambdaErrorsApi" {
  alarm_name          = "MediaDownloader-Lambda-Errors-API"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  threshold           = 5
  alarm_description   = "Lambda errors exceed threshold across API functions"
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "errors"
    expression  = join(" + ", [for fn in local.lambda_functions_api : "m_${replace(fn, "-", "_")}"])
    label       = "Total Lambda Errors (API)"
    return_data = true
  }

  dynamic "metric_query" {
    for_each = local.lambda_functions_api
    content {
      id = "m_${replace(metric_query.value, "-", "_")}"
      metric {
        metric_name = "Errors"
        namespace   = "AWS/Lambda"
        period      = 300
        stat        = "Sum"
        dimensions = {
          FunctionName = metric_query.value
        }
      }
    }
  }

  # alarm_actions = [] # Add SNS topic ARN when configured
}

# Lambda Errors Alarm (Background) - triggers when total errors across background Lambdas exceed threshold
resource "aws_cloudwatch_metric_alarm" "LambdaErrorsBackground" {
  alarm_name          = "MediaDownloader-Lambda-Errors-Background"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  threshold           = 3
  alarm_description   = "Lambda errors exceed threshold across background functions"
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "errors"
    expression  = join(" + ", [for fn in local.lambda_functions_background : "m_${replace(fn, "-", "_")}"])
    label       = "Total Lambda Errors (Background)"
    return_data = true
  }

  dynamic "metric_query" {
    for_each = local.lambda_functions_background
    content {
      id = "m_${replace(metric_query.value, "-", "_")}"
      metric {
        metric_name = "Errors"
        namespace   = "AWS/Lambda"
        period      = 300
        stat        = "Sum"
        dimensions = {
          FunctionName = metric_query.value
        }
      }
    }
  }

  # alarm_actions = [] # Add SNS topic ARN when configured
}

# Lambda Throttles Alarm (API) - any throttle is concerning
resource "aws_cloudwatch_metric_alarm" "LambdaThrottlesApi" {
  alarm_name          = "MediaDownloader-Lambda-Throttles-API"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  threshold           = 0
  alarm_description   = "API Lambda functions are being throttled"
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "throttles"
    expression  = join(" + ", [for fn in local.lambda_functions_api : "m_${replace(fn, "-", "_")}"])
    label       = "Total Lambda Throttles (API)"
    return_data = true
  }

  dynamic "metric_query" {
    for_each = local.lambda_functions_api
    content {
      id = "m_${replace(metric_query.value, "-", "_")}"
      metric {
        metric_name = "Throttles"
        namespace   = "AWS/Lambda"
        period      = 300
        stat        = "Sum"
        dimensions = {
          FunctionName = metric_query.value
        }
      }
    }
  }

  # alarm_actions = [] # Add SNS topic ARN when configured
}

# Lambda Throttles Alarm (Background) - any throttle is concerning
resource "aws_cloudwatch_metric_alarm" "LambdaThrottlesBackground" {
  alarm_name          = "MediaDownloader-Lambda-Throttles-Background"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  threshold           = 0
  alarm_description   = "Background Lambda functions are being throttled"
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "throttles"
    expression  = join(" + ", [for fn in local.lambda_functions_background : "m_${replace(fn, "-", "_")}"])
    label       = "Total Lambda Throttles (Background)"
    return_data = true
  }

  dynamic "metric_query" {
    for_each = local.lambda_functions_background
    content {
      id = "m_${replace(metric_query.value, "-", "_")}"
      metric {
        metric_name = "Throttles"
        namespace   = "AWS/Lambda"
        period      = 300
        stat        = "Sum"
        dimensions = {
          FunctionName = metric_query.value
        }
      }
    }
  }

  # alarm_actions = [] # Add SNS topic ARN when configured
}

# SQS DLQ Alarm - any message in DLQ requires investigation
resource "aws_cloudwatch_metric_alarm" "SqsDlqMessages" {
  alarm_name          = "MediaDownloader-SQS-DLQ-Messages"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Messages in SendPushNotification DLQ require investigation"
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = aws_sqs_queue.SendPushNotificationDLQ.name
  }

  # alarm_actions = [] # Add SNS topic ARN when configured
}

# SQS Queue Age Alarm - messages shouldn't be stuck in queue
resource "aws_cloudwatch_metric_alarm" "SqsQueueAge" {
  alarm_name          = "MediaDownloader-SQS-Queue-Age"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ApproximateAgeOfOldestMessage"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Maximum"
  threshold           = 3600 # 1 hour
  alarm_description   = "Messages are stuck in SendPushNotification queue for too long"
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = aws_sqs_queue.SendPushNotification.name
  }

  # alarm_actions = [] # Add SNS topic ARN when configured
}

# =============================================================================
# EventBridge Alarms
# Monitors event delivery and throttling for the event-driven pipeline
# =============================================================================

# EventBridge FailedInvocations Alarm
# Triggers when events fail to be delivered to targets (DownloadRequested -> SQS)
resource "aws_cloudwatch_metric_alarm" "EventBridgeFailedInvocations" {
  alarm_name          = "MediaDownloader-EventBridge-FailedInvocations"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FailedInvocations"
  namespace           = "AWS/Events"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "EventBridge rule failed to deliver events to target - check SQS queue permissions"
  treat_missing_data  = "notBreaching"

  dimensions = {
    RuleName = aws_cloudwatch_event_rule.DownloadRequested.name
  }

  # alarm_actions = [] # Add SNS topic ARN when configured
}

# EventBridge Throttled Alarm
# Triggers when EventBridge rules are being throttled due to rate limits
resource "aws_cloudwatch_metric_alarm" "EventBridgeThrottled" {
  alarm_name          = "MediaDownloader-EventBridge-Throttled"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ThrottledRules"
  namespace           = "AWS/Events"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "EventBridge rules are being throttled - increase rate limits or reduce event frequency"
  treat_missing_data  = "notBreaching"

  dimensions = {
    RuleName = aws_cloudwatch_event_rule.DownloadRequested.name
  }

  # alarm_actions = [] # Add SNS topic ARN when configured
}
