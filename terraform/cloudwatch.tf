# CloudWatch Dashboard and Alarms for Media Downloader
# =============================================================================
# COST OPTIMIZATION: CloudWatch is the primary cost driver (~70% of total).
#
# Dashboard: $3/month per dashboard with >50 metrics
#   - Controlled by var.enable_cloudwatch_dashboard (default: false)
#   - Use AWS Console on-demand instead for cost savings
#
# Alarms: First 10 FREE, then $0.10/alarm
#   - Controlled by var.enable_cloudwatch_alarms
#   - Production: 3 critical alarms (within free tier)
#   - Staging: 0 alarms
#
# See: thoughts/shared/plans/2026-01-23-staging-production-environments.md
# =============================================================================

locals {
  # Lambda function names with environment prefix
  lambda_functions = [
    "${var.resource_prefix}-ApiGatewayAuthorizer",
    "${var.resource_prefix}-CleanupExpiredRecords",
    "${var.resource_prefix}-CloudfrontMiddleware",
    "${var.resource_prefix}-DeviceEvent",
    "${var.resource_prefix}-ListFiles",
    "${var.resource_prefix}-LoginUser",
    "${var.resource_prefix}-LogoutUser",
    "${var.resource_prefix}-MigrateDSQL",
    "${var.resource_prefix}-PruneDevices",
    "${var.resource_prefix}-RefreshToken",
    "${var.resource_prefix}-RegisterDevice",
    "${var.resource_prefix}-RegisterUser",
    "${var.resource_prefix}-S3ObjectCreated",
    "${var.resource_prefix}-SendPushNotification",
    "${var.resource_prefix}-StartFileUpload",
    "${var.resource_prefix}-UserDelete",
    "${var.resource_prefix}-UserSubscribe",
    "${var.resource_prefix}-WebhookFeedly"
  ]

  # Split lambdas into groups for CloudWatch alarms (max 10 metrics per alarm)
  lambda_functions_api = [
    "${var.resource_prefix}-ApiGatewayAuthorizer",
    "${var.resource_prefix}-DeviceEvent",
    "${var.resource_prefix}-ListFiles",
    "${var.resource_prefix}-LoginUser",
    "${var.resource_prefix}-LogoutUser",
    "${var.resource_prefix}-RefreshToken",
    "${var.resource_prefix}-RegisterDevice",
    "${var.resource_prefix}-RegisterUser",
    "${var.resource_prefix}-UserDelete",
    "${var.resource_prefix}-UserSubscribe"
  ]

  lambda_functions_background = [
    "${var.resource_prefix}-CleanupExpiredRecords",
    "${var.resource_prefix}-CloudfrontMiddleware",
    "${var.resource_prefix}-MigrateDSQL",
    "${var.resource_prefix}-PruneDevices",
    "${var.resource_prefix}-S3ObjectCreated",
    "${var.resource_prefix}-SendPushNotification",
    "${var.resource_prefix}-StartFileUpload",
    "${var.resource_prefix}-WebhookFeedly"
  ]
}

# Dashboard is disabled by default for cost savings ($3/month)
# Enable with: enable_cloudwatch_dashboard = true in tfvars
resource "aws_cloudwatch_dashboard" "Main" {
  count          = var.enable_cloudwatch_dashboard ? 1 : 0
  dashboard_name = "${var.resource_prefix}-MediaDownloader"

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
            ["AWS/Lambda", "Invocations", "FunctionName", "${var.resource_prefix}-WebhookFeedly", { label = "1. WebhookFeedly" }],
            ["AWS/Events", "Invocations", "RuleName", aws_cloudwatch_event_rule.DownloadRequested.name, { label = "2. EventBridge" }],
            ["AWS/Lambda", "Invocations", "FunctionName", "${var.resource_prefix}-StartFileUpload", { label = "3. StartFileUpload" }],
            ["AWS/Lambda", "Invocations", "FunctionName", "${var.resource_prefix}-S3ObjectCreated", { label = "4. S3ObjectCreated" }],
            ["AWS/Lambda", "Invocations", "FunctionName", "${var.resource_prefix}-SendPushNotification", { label = "5. SendPushNotification" }]
          ]
        }
      },
      # Row 7: YouTube Reliability Metrics
      {
        type   = "metric"
        x      = 0
        y      = 36
        width  = 12
        height = 6
        properties = {
          title  = "YouTube Player Client Success/Failure"
          region = data.aws_region.current.id
          stat   = "Sum"
          period = 300
          view   = "timeSeries"
          metrics = [
            ["MediaDownloader", "YouTubeClientSuccess", "PlayerClient", "mweb", { label = "mweb Success", color = "#2ca02c" }],
            ["MediaDownloader", "YouTubeClientSuccess", "PlayerClient", "android_vr", { label = "android_vr Success", color = "#98df8a" }],
            ["MediaDownloader", "YouTubeClientSuccess", "PlayerClient", "ios", { label = "ios Success", color = "#d4edda" }],
            ["MediaDownloader", "YouTubeClientFailure", "PlayerClient", "mweb", { label = "mweb Failure", color = "#d62728" }],
            ["MediaDownloader", "YouTubeClientFailure", "PlayerClient", "android_vr", { label = "android_vr Failure", color = "#ff9896" }],
            ["MediaDownloader", "YouTubeClientFailure", "PlayerClient", "ios", { label = "ios Failure", color = "#ffcccc" }]
          ]
        }
      },
      # Row 7: YouTube Format Fallback Metrics
      {
        type   = "metric"
        x      = 12
        y      = 36
        width  = 12
        height = 6
        properties = {
          title  = "YouTube Format Fallback (SABR Bypass)"
          region = data.aws_region.current.id
          stat   = "Sum"
          period = 300
          view   = "timeSeries"
          metrics = [
            ["MediaDownloader", "YouTubeFormatSuccess", "FormatSelector", "primary", { label = "Primary Format Success", color = "#2ca02c" }],
            ["MediaDownloader", "YouTubeFormatSuccess", "FormatSelector", "fallback", { label = "Fallback Format Success", color = "#ff7f0e" }],
            ["MediaDownloader", "YouTubeFormatFailure", "FormatSelector", "primary", { label = "Primary Format Failure", color = "#d62728" }],
            ["MediaDownloader", "YouTubeFormatFailure", "FormatSelector", "fallback", { label = "Fallback Format Failure", color = "#9467bd" }]
          ]
        }
      },
      # Row 8: YouTube Auth Failures by Type
      {
        type   = "metric"
        x      = 0
        y      = 42
        width  = 12
        height = 6
        properties = {
          title  = "YouTube Authentication Failures"
          region = data.aws_region.current.id
          stat   = "Sum"
          period = 300
          view   = "timeSeries"
          metrics = [
            ["MediaDownloader", "YouTubeAuthFailure", "ErrorType", "bot_detection", { label = "Bot Detection", color = "#d62728" }],
            ["MediaDownloader", "YouTubeAuthFailure", "ErrorType", "cookie_expired", { label = "Cookie Expired", color = "#ff7f0e" }],
            ["MediaDownloader", "YouTubeAuthFailure", "ErrorType", "rate_limited", { label = "Rate Limited", color = "#9467bd" }]
          ]
          annotations = {
            horizontal = [
              {
                label = "Alert Threshold"
                value = 3
                color = "#d62728"
              }
            ]
          }
        }
      },
      # Row 8: Video Download Metrics
      {
        type   = "metric"
        x      = 12
        y      = 42
        width  = 12
        height = 6
        properties = {
          title  = "Video Download Performance"
          region = data.aws_region.current.id
          stat   = "Sum"
          period = 300
          view   = "timeSeries"
          metrics = [
            ["MediaDownloader", "VideoDownloadSuccess", { label = "Download Success", color = "#2ca02c" }],
            ["MediaDownloader", "VideoDownloadFailure", { label = "Download Failure", color = "#d62728" }]
          ]
        }
      }
    ]
  })
}

output "cloudwatch_dashboard_url" {
  description = "URL to the CloudWatch dashboard (empty if dashboard disabled)"
  value       = var.enable_cloudwatch_dashboard ? "https://${data.aws_region.current.id}.console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.id}#dashboards:name=${aws_cloudwatch_dashboard.Main[0].dashboard_name}" : ""
}

# =============================================================================
# SNS Topic for Operations Alerts
# Only created when alarms are enabled
# Subscribe your email/Slack/PagerDuty manually after deployment
# =============================================================================

resource "aws_sns_topic" "OperationsAlerts" {
  count = var.enable_cloudwatch_alarms ? 1 : 0
  name  = "${var.resource_prefix}-${local.project_name}-operations-alerts"
  tags  = local.common_tags
}

output "operations_alerts_sns_topic_arn" {
  description = "SNS topic ARN for operations alerts (empty if alarms disabled)"
  value       = var.enable_cloudwatch_alarms ? aws_sns_topic.OperationsAlerts[0].arn : ""
}

# =============================================================================
# CloudWatch Alarms
# All alarms notify via SNS topic above
# =============================================================================

# Lambda Errors Alarm (API) - triggers when total errors across API Lambdas exceed threshold
resource "aws_cloudwatch_metric_alarm" "LambdaErrorsApi" {
  count               = var.enable_cloudwatch_alarms ? 1 : 0
  alarm_name          = "${var.resource_prefix}-MediaDownloader-Lambda-Errors-API"
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

  alarm_actions = [aws_sns_topic.OperationsAlerts[0].arn]
  ok_actions    = [aws_sns_topic.OperationsAlerts[0].arn]

  tags = local.common_tags
}

# Lambda Errors Alarm (Background) - triggers when total errors across background Lambdas exceed threshold
resource "aws_cloudwatch_metric_alarm" "LambdaErrorsBackground" {
  count               = var.enable_cloudwatch_alarms ? 1 : 0
  alarm_name          = "${var.resource_prefix}-MediaDownloader-Lambda-Errors-Background"
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

  alarm_actions = [aws_sns_topic.OperationsAlerts[0].arn]
  ok_actions    = [aws_sns_topic.OperationsAlerts[0].arn]

  tags = local.common_tags
}

# Lambda Throttles Alarm (API) - any throttle is concerning
resource "aws_cloudwatch_metric_alarm" "LambdaThrottlesApi" {
  count               = var.enable_cloudwatch_alarms ? 1 : 0
  alarm_name          = "${var.resource_prefix}-MediaDownloader-Lambda-Throttles-API"
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

  alarm_actions = [aws_sns_topic.OperationsAlerts[0].arn]
  ok_actions    = [aws_sns_topic.OperationsAlerts[0].arn]

  tags = local.common_tags
}

# Lambda Throttles Alarm (Background) - any throttle is concerning
resource "aws_cloudwatch_metric_alarm" "LambdaThrottlesBackground" {
  count               = var.enable_cloudwatch_alarms ? 1 : 0
  alarm_name          = "${var.resource_prefix}-MediaDownloader-Lambda-Throttles-Background"
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

  alarm_actions = [aws_sns_topic.OperationsAlerts[0].arn]
  ok_actions    = [aws_sns_topic.OperationsAlerts[0].arn]

  tags = local.common_tags
}

# SQS DLQ Alarm (SendPushNotification) - any message in DLQ requires investigation
resource "aws_cloudwatch_metric_alarm" "SqsDlqMessages" {
  count               = var.enable_cloudwatch_alarms ? 1 : 0
  alarm_name          = "${var.resource_prefix}-MediaDownloader-SQS-DLQ-Messages"
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

  alarm_actions = [aws_sns_topic.OperationsAlerts[0].arn]
  ok_actions    = [aws_sns_topic.OperationsAlerts[0].arn]

  tags = local.common_tags
}

# SQS DLQ Alarm (Download) - any message in DLQ requires investigation
resource "aws_cloudwatch_metric_alarm" "DownloadDlqMessages" {
  count               = var.enable_cloudwatch_alarms ? 1 : 0
  alarm_name          = "${var.resource_prefix}-MediaDownloader-Download-DLQ-Messages"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Messages in Download DLQ require investigation - video downloads failed after retries"
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = aws_sqs_queue.DownloadDLQ.name
  }

  alarm_actions = [aws_sns_topic.OperationsAlerts[0].arn]
  ok_actions    = [aws_sns_topic.OperationsAlerts[0].arn]

  tags = local.common_tags
}

# SQS Queue Age Alarm - messages shouldn't be stuck in queue
resource "aws_cloudwatch_metric_alarm" "SqsQueueAge" {
  count               = var.enable_cloudwatch_alarms ? 1 : 0
  alarm_name          = "${var.resource_prefix}-MediaDownloader-SQS-Queue-Age"
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

  alarm_actions = [aws_sns_topic.OperationsAlerts[0].arn]
  ok_actions    = [aws_sns_topic.OperationsAlerts[0].arn]

  tags = local.common_tags
}

# =============================================================================
# EventBridge Alarms
# Monitors event delivery and throttling for the event-driven pipeline
# =============================================================================

# EventBridge FailedInvocations Alarm
# Triggers when events fail to be delivered to targets (DownloadRequested -> SQS)
resource "aws_cloudwatch_metric_alarm" "EventBridgeFailedInvocations" {
  count               = var.enable_cloudwatch_alarms ? 1 : 0
  alarm_name          = "${var.resource_prefix}-MediaDownloader-EventBridge-FailedInvocations"
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

  alarm_actions = [aws_sns_topic.OperationsAlerts[0].arn]
  ok_actions    = [aws_sns_topic.OperationsAlerts[0].arn]

  tags = local.common_tags
}

# EventBridge Throttled Alarm
# Triggers when EventBridge rules are being throttled due to rate limits
resource "aws_cloudwatch_metric_alarm" "EventBridgeThrottled" {
  count               = var.enable_cloudwatch_alarms ? 1 : 0
  alarm_name          = "${var.resource_prefix}-MediaDownloader-EventBridge-Throttled"
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

  alarm_actions = [aws_sns_topic.OperationsAlerts[0].arn]
  ok_actions    = [aws_sns_topic.OperationsAlerts[0].arn]

  tags = local.common_tags
}

# =============================================================================
# YouTube Cookie Authentication Alarms
# Monitors authentication failures that may indicate cookie expiration
# =============================================================================

# YouTube Auth Failure Alarm (Bot Detection)
# Triggers when YouTube detects automated access, requires cookie refresh
resource "aws_cloudwatch_metric_alarm" "YouTubeAuthFailureBotDetection" {
  count               = var.enable_cloudwatch_alarms ? 1 : 0
  alarm_name          = "${var.resource_prefix}-MediaDownloader-YouTube-Auth-BotDetection"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "YouTubeAuthFailure"
  namespace           = "MediaDownloader"
  period              = 300
  statistic           = "Sum"
  threshold           = 3
  alarm_description   = "Multiple YouTube bot detection failures - cookies may need refresh. Run: pnpm run update-cookies"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ErrorType = "bot_detection"
  }

  alarm_actions = [aws_sns_topic.OperationsAlerts[0].arn]
  ok_actions    = [aws_sns_topic.OperationsAlerts[0].arn]

  tags = local.common_tags
}

# YouTube Auth Failure Alarm (Cookie Expired)
# Triggers when cookies have expired and need refresh
resource "aws_cloudwatch_metric_alarm" "YouTubeAuthFailureCookieExpired" {
  count               = var.enable_cloudwatch_alarms ? 1 : 0
  alarm_name          = "${var.resource_prefix}-MediaDownloader-YouTube-Auth-CookieExpired"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "YouTubeAuthFailure"
  namespace           = "MediaDownloader"
  period              = 300
  statistic           = "Sum"
  threshold           = 2
  alarm_description   = "YouTube cookies have expired - run: pnpm run update-cookies && pnpm run deploy"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ErrorType = "cookie_expired"
  }

  alarm_actions = [aws_sns_topic.OperationsAlerts[0].arn]
  ok_actions    = [aws_sns_topic.OperationsAlerts[0].arn]

  tags = local.common_tags
}

# YouTube Auth Failure Alarm (Rate Limited)
# Triggers when YouTube is rate limiting requests
resource "aws_cloudwatch_metric_alarm" "YouTubeAuthFailureRateLimited" {
  count               = var.enable_cloudwatch_alarms ? 1 : 0
  alarm_name          = "${var.resource_prefix}-MediaDownloader-YouTube-Auth-RateLimited"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "YouTubeAuthFailure"
  namespace           = "MediaDownloader"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "YouTube rate limiting detected - reduce download frequency or wait before retrying"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ErrorType = "rate_limited"
  }

  alarm_actions = [aws_sns_topic.OperationsAlerts[0].arn]
  ok_actions    = [aws_sns_topic.OperationsAlerts[0].arn]

  tags = local.common_tags
}

# =============================================================================
# API Gateway Alarms
# Monitors API Gateway errors that indicate Lambda or integration failures
# =============================================================================

# API Gateway 5xx Errors Alarm
# Triggers when API Gateway returns 5xx errors (Lambda failures, integration errors)
resource "aws_cloudwatch_metric_alarm" "ApiGateway5xxErrors" {
  count               = var.enable_cloudwatch_alarms ? 1 : 0
  alarm_name          = "${var.resource_prefix}-MediaDownloader-API-Gateway-5xx-Errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "5XXError"
  namespace           = "AWS/ApiGateway"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  alarm_description   = "API Gateway 5xx errors detected - check Lambda execution logs"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ApiName = aws_api_gateway_rest_api.Main.name
  }

  alarm_actions = [aws_sns_topic.OperationsAlerts[0].arn]
  ok_actions    = [aws_sns_topic.OperationsAlerts[0].arn]

  tags = local.common_tags
}
