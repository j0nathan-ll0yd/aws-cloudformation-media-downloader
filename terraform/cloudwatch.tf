# CloudWatch Dashboard for Media Downloader
# Provides visibility into Lambda performance, storage, and API metrics
# See: https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/issues/147

locals {
  lambda_functions = [
    "ApiGatewayAuthorizer",
    "CloudfrontMiddleware",
    "FileCoordinator",
    "ListFiles",
    "LogClientEvent",
    "LoginUser",
    "PruneDevices",
    "RegisterDevice",
    "RegisterUser",
    "S3ObjectCreated",
    "SendPushNotification",
    "StartFileUpload",
    "UserDelete",
    "UserSubscribe",
    "WebhookFeedly"
  ]
}

resource "aws_cloudwatch_dashboard" "main" {
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
      # Row 3: DynamoDB Capacity
      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 8
        height = 6
        properties = {
          title  = "DynamoDB Consumed Capacity"
          region = data.aws_region.current.id
          stat   = "Sum"
          period = 300
          view   = "timeSeries"
          metrics = [
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", aws_dynamodb_table.MediaDownloader.name],
            ["AWS/DynamoDB", "ConsumedWriteCapacityUnits", "TableName", aws_dynamodb_table.MediaDownloader.name]
          ]
        }
      },
      # Row 3: S3 Storage
      {
        type   = "metric"
        x      = 8
        y      = 12
        width  = 8
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
        x      = 16
        y      = 12
        width  = 8
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
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", aws_sqs_queue.SendPushNotification.name, { label = "Main Queue" }],
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", aws_sqs_queue.SendPushNotificationDLQ.name, { label = "DLQ", color = "#d62728" }]
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
            ["AWS/SQS", "ApproximateAgeOfOldestMessage", "QueueName", aws_sqs_queue.SendPushNotification.name]
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
      }
    ]
  })
}

output "cloudwatch_dashboard_url" {
  description = "URL to the CloudWatch dashboard"
  value       = "https://${data.aws_region.current.id}.console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.id}#dashboards:name=${aws_cloudwatch_dashboard.main.dashboard_name}"
}

# =============================================================================
# CloudWatch Alarms
# Note: SNS notification actions deferred - add alarm_actions when SNS configured
# =============================================================================

# Lambda Errors Alarm - triggers when total errors across all Lambdas exceed threshold
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "MediaDownloader-Lambda-Errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  threshold           = 5
  alarm_description   = "Lambda errors exceed threshold across all functions"
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "errors"
    expression  = join(" + ", [for fn in local.lambda_functions : "m_${replace(fn, "-", "_")}"])
    label       = "Total Lambda Errors"
    return_data = true
  }

  dynamic "metric_query" {
    for_each = local.lambda_functions
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

# Lambda Throttles Alarm - any throttle is concerning
resource "aws_cloudwatch_metric_alarm" "lambda_throttles" {
  alarm_name          = "MediaDownloader-Lambda-Throttles"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  threshold           = 0
  alarm_description   = "Lambda functions are being throttled"
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "throttles"
    expression  = join(" + ", [for fn in local.lambda_functions : "m_${replace(fn, "-", "_")}"])
    label       = "Total Lambda Throttles"
    return_data = true
  }

  dynamic "metric_query" {
    for_each = local.lambda_functions
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
resource "aws_cloudwatch_metric_alarm" "sqs_dlq_messages" {
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
resource "aws_cloudwatch_metric_alarm" "sqs_queue_age" {
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
