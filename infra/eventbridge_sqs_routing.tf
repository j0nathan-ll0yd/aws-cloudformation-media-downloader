# EventBridge-to-SQS Routing Rules (manual — input_transformer not supported by generator)
#
# Routes DownloadRequested events from the event bus to the download SQS queue
# with field extraction and attempt counter injection.

# Rule: Route DownloadRequested events to DownloadQueue
resource "aws_cloudwatch_event_rule" "download_requested" {
  name           = "DownloadRequested"
  event_bus_name = module.eventbridge.bus_name
  description    = "Route DownloadRequested events to download processing queue"

  event_pattern = jsonencode({
    source      = ["media-downloader"]
    detail-type = ["DownloadRequested"]
  })
}

# Target: Send DownloadRequested events to DownloadQueue with transformation
resource "aws_cloudwatch_event_target" "download_requested_to_sqs" {
  rule           = aws_cloudwatch_event_rule.download_requested.name
  event_bus_name = module.eventbridge.bus_name
  target_id      = "DownloadQueue"
  arn            = module.queue_DownloadQueue.queue_arn

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
  queue_url = module.queue_DownloadQueue.queue_url

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowEventBridgeToSendMessage"
      Effect    = "Allow"
      Principal = { Service = "events.amazonaws.com" }
      Action    = "sqs:SendMessage"
      Resource  = module.queue_DownloadQueue.queue_arn
      Condition = {
        ArnEquals = {
          "aws:SourceArn" = aws_cloudwatch_event_rule.download_requested.arn
        }
      }
    }]
  })
}
