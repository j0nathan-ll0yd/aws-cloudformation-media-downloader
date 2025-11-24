# EventBridge Custom Event Bus for Media Downloader
# Enables decoupled event-driven architecture with schema registry

resource "aws_cloudwatch_event_bus" "MediaDownloader" {
  name = "MediaDownloaderEvents"

  tags = {
    Name        = "MediaDownloaderEvents"
    Description = "Custom event bus for media download workflow events"
  }
}

# EventBridge Schema Registry for type-safe event contracts
resource "aws_schemas_registry" "MediaDownloader" {
  name        = "MediaDownloaderSchemas"
  description = "Schema registry for media download events with versioning"
}

# Schema for FileMetadataReady event
# Published when video metadata has been retrieved
resource "aws_schemas_schema" "FileMetadataReady" {
  name          = "FileMetadataReady"
  registry_name = aws_schemas_registry.MediaDownloader.name
  type          = "OpenApi3"
  description   = "Event published when video metadata is ready for download"

  content = jsonencode({
    openapi = "3.0.0"
    info = {
      title   = "FileMetadataReady"
      version = "1.0.0"
    }
    paths = {}
    components = {
      schemas = {
        FileMetadataReady = {
          type = "object"
          properties = {
            version = {
              type    = "string"
              pattern = "^1\\.0$"
            }
            detail-type = {
              type = "string"
              enum = ["FileMetadataReady"]
            }
            source = {
              type = "string"
              enum = ["aws.mediadownloader.metadata"]
            }
            detail = {
              type = "object"
              properties = {
                fileId = {
                  type        = "string"
                  description = "YouTube video ID"
                }
                title = {
                  type        = "string"
                  description = "Video title"
                }
                description = {
                  type        = "string"
                  description = "Video description"
                }
                authorName = {
                  type        = "string"
                  description = "Channel author name"
                }
                authorUser = {
                  type        = "string"
                  description = "Channel author username"
                }
                publishDate = {
                  type        = "string"
                  format      = "date-time"
                  description = "Video publication date"
                }
                contentType = {
                  type        = "string"
                  description = "MIME type of the video"
                }
                size = {
                  type        = "integer"
                  description = "File size in bytes"
                }
              }
              required = ["fileId", "title", "contentType"]
            }
          }
          required = ["version", "detail-type", "source", "detail"]
        }
      }
    }
  })
}

# Schema for FileDownloadStarted event
# Published when download begins
resource "aws_schemas_schema" "FileDownloadStarted" {
  name          = "FileDownloadStarted"
  registry_name = aws_schemas_registry.MediaDownloader.name
  type          = "OpenApi3"
  description   = "Event published when file download starts"

  content = jsonencode({
    openapi = "3.0.0"
    info = {
      title   = "FileDownloadStarted"
      version = "1.0.0"
    }
    paths = {}
    components = {
      schemas = {
        FileDownloadStarted = {
          type = "object"
          properties = {
            version = {
              type    = "string"
              pattern = "^1\\.0$"
            }
            detail-type = {
              type = "string"
              enum = ["FileDownloadStarted"]
            }
            source = {
              type = "string"
              enum = ["aws.mediadownloader.download"]
            }
            detail = {
              type = "object"
              properties = {
                fileId = {
                  type        = "string"
                  description = "YouTube video ID"
                }
                timestamp = {
                  type        = "integer"
                  description = "Download start timestamp"
                }
              }
              required = ["fileId", "timestamp"]
            }
          }
          required = ["version", "detail-type", "source", "detail"]
        }
      }
    }
  })
}

# Schema for FileDownloadCompleted event
# Published when file is successfully uploaded to S3
resource "aws_schemas_schema" "FileDownloadCompleted" {
  name          = "FileDownloadCompleted"
  registry_name = aws_schemas_registry.MediaDownloader.name
  type          = "OpenApi3"
  description   = "Event published when file download and S3 upload completes"

  content = jsonencode({
    openapi = "3.0.0"
    info = {
      title   = "FileDownloadCompleted"
      version = "1.0.0"
    }
    paths = {}
    components = {
      schemas = {
        FileDownloadCompleted = {
          type = "object"
          properties = {
            version = {
              type    = "string"
              pattern = "^1\\.0$"
            }
            detail-type = {
              type = "string"
              enum = ["FileDownloadCompleted"]
            }
            source = {
              type = "string"
              enum = ["aws.mediadownloader.download"]
            }
            detail = {
              type = "object"
              properties = {
                fileId = {
                  type        = "string"
                  description = "YouTube video ID"
                }
                s3Key = {
                  type        = "string"
                  description = "S3 object key"
                }
                s3Url = {
                  type        = "string"
                  description = "S3 object URL"
                }
                size = {
                  type        = "integer"
                  description = "File size in bytes"
                }
                contentType = {
                  type        = "string"
                  description = "MIME type"
                }
              }
              required = ["fileId", "s3Key", "size"]
            }
          }
          required = ["version", "detail-type", "source", "detail"]
        }
      }
    }
  })
}

# Schema for FileDownloadFailed event
# Published when download fails
resource "aws_schemas_schema" "FileDownloadFailed" {
  name          = "FileDownloadFailed"
  registry_name = aws_schemas_registry.MediaDownloader.name
  type          = "OpenApi3"
  description   = "Event published when file download fails"

  content = jsonencode({
    openapi = "3.0.0"
    info = {
      title   = "FileDownloadFailed"
      version = "1.0.0"
    }
    paths = {}
    components = {
      schemas = {
        FileDownloadFailed = {
          type = "object"
          properties = {
            version = {
              type    = "string"
              pattern = "^1\\.0$"
            }
            detail-type = {
              type = "string"
              enum = ["FileDownloadFailed"]
            }
            source = {
              type = "string"
              enum = ["aws.mediadownloader.download"]
            }
            detail = {
              type = "object"
              properties = {
                fileId = {
                  type        = "string"
                  description = "YouTube video ID"
                }
                error = {
                  type        = "string"
                  description = "Error message"
                }
                errorCode = {
                  type        = "string"
                  description = "Error code"
                }
                timestamp = {
                  type        = "integer"
                  description = "Failure timestamp"
                }
              }
              required = ["fileId", "error", "timestamp"]
            }
          }
          required = ["version", "detail-type", "source", "detail"]
        }
      }
    }
  })
}

# EventBridge Archive for production debugging and replay
resource "aws_cloudwatch_event_archive" "MediaDownloader" {
  name             = "MediaDownloaderArchive"
  event_source_arn = aws_cloudwatch_event_bus.MediaDownloader.arn
  description      = "90-day archive of all media download events for debugging and replay"
  retention_days   = 90

  event_pattern = jsonencode({
    source = [{
      prefix = "aws.mediadownloader"
    }]
  })
}

# IAM role for EventBridge to invoke targets
resource "aws_iam_role" "EventBridgeInvokeTargets" {
  name               = "EventBridgeInvokeTargets"
  assume_role_policy = data.aws_iam_policy_document.EventBridgeAssumeRole.json
}

data "aws_iam_policy_document" "EventBridgeAssumeRole" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "EventBridgeInvokeTargets" {
  statement {
    actions = [
      "states:StartExecution"
    ]
    resources = [
      "arn:aws:states:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:stateMachine:*"
    ]
  }
}

resource "aws_iam_policy" "EventBridgeInvokeTargets" {
  name   = "EventBridgeInvokeTargets"
  policy = data.aws_iam_policy_document.EventBridgeInvokeTargets.json
}

resource "aws_iam_role_policy_attachment" "EventBridgeInvokeTargets" {
  role       = aws_iam_role.EventBridgeInvokeTargets.name
  policy_arn = aws_iam_policy.EventBridgeInvokeTargets.arn
}

# Outputs for use in other modules
output "eventbridge_bus_name" {
  value       = aws_cloudwatch_event_bus.MediaDownloader.name
  description = "Name of the custom EventBridge event bus"
}

output "eventbridge_bus_arn" {
  value       = aws_cloudwatch_event_bus.MediaDownloader.arn
  description = "ARN of the custom EventBridge event bus"
}

output "schema_registry_name" {
  value       = aws_schemas_registry.MediaDownloader.name
  description = "Name of the EventBridge schema registry"
}

output "schema_registry_arn" {
  value       = aws_schemas_registry.MediaDownloader.arn
  description = "ARN of the EventBridge schema registry"
}

output "event_archive_name" {
  value       = aws_cloudwatch_event_archive.MediaDownloader.name
  description = "Name of the EventBridge event archive"
}
