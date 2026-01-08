locals {
  webhook_feedly_function_name    = "WebhookFeedly"
  start_file_upload_function_name = "StartFileUpload"
}

resource "aws_iam_role" "WebhookFeedly" {
  name               = local.webhook_feedly_function_name
  assume_role_policy = data.aws_iam_policy_document.LambdaGatewayAssumeRole.json
  tags               = local.common_tags
}

data "aws_iam_policy_document" "WebhookFeedly" {
  statement {
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.SendPushNotification.arn]
  }
  # Publish DownloadRequested events to EventBridge
  statement {
    actions   = ["events:PutEvents"]
    resources = [aws_cloudwatch_event_bus.MediaDownloader.arn]
  }
  # Powertools Idempotency - read/write to idempotency table
  statement {
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem"
    ]
    resources = [aws_dynamodb_table.IdempotencyTable.arn]
  }
}

resource "aws_iam_policy" "WebhookFeedly" {
  name   = local.webhook_feedly_function_name
  policy = data.aws_iam_policy_document.WebhookFeedly.json
  tags   = local.common_tags
}

resource "aws_iam_role_policy_attachment" "WebhookFeedly" {
  role       = aws_iam_role.WebhookFeedly.name
  policy_arn = aws_iam_policy.WebhookFeedly.arn
}

resource "aws_iam_role_policy" "WebhookFeedlyLogging" {
  name = "WebhookFeedlyLogging"
  role = aws_iam_role.WebhookFeedly.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ]
      Resource = [
        "arn:aws:logs:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.webhook_feedly_function_name}",
        "arn:aws:logs:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.webhook_feedly_function_name}:*"
      ]
    }]
  })
}

resource "aws_iam_role_policy_attachment" "WebhookFeedlyXRay" {
  role       = aws_iam_role.WebhookFeedly.name
  policy_arn = aws_iam_policy.CommonLambdaXRay.arn
}

resource "aws_iam_role_policy_attachment" "WebhookFeedlyDSQL" {
  role       = aws_iam_role.WebhookFeedly.name
  policy_arn = aws_iam_policy.LambdaDSQLReadWrite.arn
}

resource "aws_lambda_permission" "WebhookFeedly" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.WebhookFeedly.function_name
  principal     = "apigateway.amazonaws.com"
}

resource "aws_cloudwatch_log_group" "WebhookFeedly" {
  name              = "/aws/lambda/${aws_lambda_function.WebhookFeedly.function_name}"
  retention_in_days = 7
  tags              = local.common_tags
}

data "archive_file" "WebhookFeedly" {
  type        = "zip"
  source_dir  = "./../build/lambdas/WebhookFeedly"
  output_path = "./../build/lambdas/WebhookFeedly.zip"
}

resource "aws_lambda_function" "WebhookFeedly" {
  description      = "A webhook from Feedly via IFTTT"
  function_name    = local.webhook_feedly_function_name
  role             = aws_iam_role.WebhookFeedly.arn
  handler          = "index.handler"
  runtime          = "nodejs24.x"
  architectures    = [local.lambda_architecture]
  memory_size      = 512
  timeout          = local.default_lambda_timeout
  depends_on       = [aws_iam_role_policy_attachment.WebhookFeedly]
  filename         = data.archive_file.WebhookFeedly.output_path
  source_code_hash = data.archive_file.WebhookFeedly.output_base64sha256
  layers           = [local.adot_layer_arn]

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = merge(local.common_lambda_env, {
      SNS_QUEUE_URL          = aws_sqs_queue.SendPushNotification.id
      IDEMPOTENCY_TABLE_NAME = aws_dynamodb_table.IdempotencyTable.name
      EVENT_BUS_NAME         = aws_cloudwatch_event_bus.MediaDownloader.name
      OTEL_SERVICE_NAME      = local.webhook_feedly_function_name
      DSQL_ACCESS_LEVEL      = "readwrite"
    })
  }

  tags = merge(local.common_tags, {
    Name = local.webhook_feedly_function_name
  })
}

resource "aws_api_gateway_resource" "Feedly" {
  rest_api_id = aws_api_gateway_rest_api.Main.id
  parent_id   = aws_api_gateway_rest_api.Main.root_resource_id
  path_part   = "feedly"
}

resource "aws_api_gateway_method" "WebhookFeedlyPost" {
  rest_api_id      = aws_api_gateway_rest_api.Main.id
  resource_id      = aws_api_gateway_resource.Feedly.id
  http_method      = "POST"
  authorization    = "CUSTOM"
  authorizer_id    = aws_api_gateway_authorizer.ApiGatewayAuthorizer.id
  api_key_required = true
}

resource "aws_api_gateway_integration" "WebhookFeedlyPost" {
  rest_api_id             = aws_api_gateway_rest_api.Main.id
  resource_id             = aws_api_gateway_resource.Feedly.id
  http_method             = aws_api_gateway_method.WebhookFeedlyPost.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.WebhookFeedly.invoke_arn
}

data "aws_iam_policy_document" "MultipartUpload" {
  # Send MetadataNotification to push notification queue
  statement {
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.SendPushNotification.arn]
  }
  # Receive messages from DownloadQueue (event-driven architecture)
  statement {
    actions = [
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes"
    ]
    resources = [
      aws_sqs_queue.DownloadQueue.arn,
      aws_sqs_queue.DownloadDLQ.arn
    ]
  }
  # Publish DownloadCompleted/DownloadFailed events to EventBridge
  statement {
    actions   = ["events:PutEvents"]
    resources = [aws_cloudwatch_event_bus.MediaDownloader.arn]
  }
  statement {
    actions = [
      "s3:PutObject",
      "s3:PutObjectAcl",
      "s3:GetObject",
    ]
    resources = ["${aws_s3_bucket.Files.arn}/*"]
  }
  statement {
    actions = [
      "s3:ListBucket",
      "s3:AbortMultipartUpload",
      "s3:ListMultipartUploadParts",
      "s3:ListBucketMultipartUploads"
    ]
    resources = [aws_s3_bucket.Files.arn]
  }
  statement {
    actions   = ["cloudwatch:PutMetricData"]
    resources = ["*"] # CloudWatch metrics have no resource ARN; scoped by namespace condition
    condition {
      test     = "StringEquals"
      variable = "cloudwatch:namespace"
      values   = ["MediaDownloader"]
    }
  }
}

resource "aws_iam_role" "StartFileUpload" {
  name               = local.start_file_upload_function_name
  assume_role_policy = data.aws_iam_policy_document.LambdaAssumeRole.json
  tags               = local.common_tags
}

resource "aws_iam_policy" "StartFileUpload" {
  name   = local.start_file_upload_function_name
  policy = data.aws_iam_policy_document.MultipartUpload.json
  tags   = local.common_tags
}

resource "aws_iam_role_policy_attachment" "StartFileUpload" {
  role       = aws_iam_role.StartFileUpload.name
  policy_arn = aws_iam_policy.StartFileUpload.arn
}

resource "aws_iam_role_policy" "StartFileUploadLogging" {
  name = "StartFileUploadLogging"
  role = aws_iam_role.StartFileUpload.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ]
      Resource = [
        "arn:aws:logs:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.start_file_upload_function_name}",
        "arn:aws:logs:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.start_file_upload_function_name}:*"
      ]
    }]
  })
}

resource "aws_iam_role_policy_attachment" "StartFileUploadXRay" {
  role       = aws_iam_role.StartFileUpload.name
  policy_arn = aws_iam_policy.CommonLambdaXRay.arn
}

resource "aws_iam_role_policy_attachment" "StartFileUploadDSQL" {
  role       = aws_iam_role.StartFileUpload.name
  policy_arn = aws_iam_policy.LambdaDSQLReadWrite.arn
}

data "archive_file" "StartFileUpload" {
  type        = "zip"
  source_dir  = "./../build/lambdas/StartFileUpload"
  output_path = "./../build/lambdas/StartFileUpload.zip"
}

resource "null_resource" "DownloadYtDlpBinary" {
  triggers = {
    version = fileexists("${path.module}/../layers/yt-dlp/VERSION") ? trimspace(file("${path.module}/../layers/yt-dlp/VERSION")) : "none"
  }

  provisioner "local-exec" {
    command = <<-EOT
      set -e

      VERSION="${trimspace(file("${path.module}/../layers/yt-dlp/VERSION"))}"
      LAYER_BIN_DIR="${path.module}/../layers/yt-dlp/bin"
      BINARY_NAME="yt-dlp_linux"

      echo "Downloading yt-dlp $${VERSION}..."
      mkdir -p "$${LAYER_BIN_DIR}"

      wget -q "https://github.com/yt-dlp/yt-dlp/releases/download/$${VERSION}/$${BINARY_NAME}" -O "$${LAYER_BIN_DIR}/$${BINARY_NAME}"
      wget -q "https://github.com/yt-dlp/yt-dlp/releases/download/$${VERSION}/SHA2-256SUMS" -O /tmp/yt-dlp-SHA2-256SUMS

      echo "Verifying checksum..."
      cd "$${LAYER_BIN_DIR}"
      if command -v shasum >/dev/null 2>&1; then
        grep "$${BINARY_NAME}$" /tmp/yt-dlp-SHA2-256SUMS | shasum -a 256 -c -s
      elif sha256sum --version 2>&1 | grep -q GNU; then
        grep "$${BINARY_NAME}$" /tmp/yt-dlp-SHA2-256SUMS | sha256sum --check --status
      else
        echo "ERROR: No compatible checksum utility found (shasum or GNU sha256sum)"
        exit 1
      fi

      echo "Making binary executable..."
      chmod +x "$${BINARY_NAME}"

      if [ "$(uname -s)" = "Linux" ]; then
        echo "Testing binary..."
        BINARY_VERSION=$(./"$${BINARY_NAME}" --version)
        if [ "$${BINARY_VERSION}" != "$${VERSION}" ]; then
          echo "ERROR: Binary version mismatch (expected: $${VERSION}, got: $${BINARY_VERSION})"
          exit 1
        fi
        echo "✅ Binary version verified: $${BINARY_VERSION}"
      else
        echo "⏭️  Skipping binary test (Linux binary, non-Linux host)"
      fi

      rm -f /tmp/yt-dlp-SHA2-256SUMS
      echo "✅ yt-dlp $${VERSION} downloaded and verified successfully"
    EOT
  }
}

resource "null_resource" "DownloadFfmpegBinary" {
  triggers = {
    version = fileexists("${path.module}/../layers/ffmpeg/VERSION") ? trimspace(file("${path.module}/../layers/ffmpeg/VERSION")) : "none"
  }

  provisioner "local-exec" {
    command = <<-EOT
      set -e

      VERSION="${trimspace(file("${path.module}/../layers/ffmpeg/VERSION"))}"
      LAYER_BIN_DIR="${path.module}/../layers/ffmpeg/bin"
      FFMPEG_URL="https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz"
      FFMPEG_MD5_URL="https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz.md5"

      echo "Downloading ffmpeg (targeting version $${VERSION})..."
      mkdir -p "$${LAYER_BIN_DIR}"
      cd "$${LAYER_BIN_DIR}"

      # Download archive and checksum
      wget -q "$${FFMPEG_URL}" -O ffmpeg-release-amd64-static.tar.xz
      wget -q "$${FFMPEG_MD5_URL}" -O ffmpeg-release-amd64-static.tar.xz.md5

      # Verify checksum
      echo "Verifying checksum..."
      if command -v md5sum >/dev/null 2>&1; then
        md5sum -c ffmpeg-release-amd64-static.tar.xz.md5
      elif command -v md5 >/dev/null 2>&1; then
        EXPECTED=$(cat ffmpeg-release-amd64-static.tar.xz.md5 | awk '{print $1}')
        ACTUAL=$(md5 -q ffmpeg-release-amd64-static.tar.xz)
        if [ "$${EXPECTED}" != "$${ACTUAL}" ]; then
          echo "ERROR: MD5 checksum mismatch"
          exit 1
        fi
        echo "ffmpeg-release-amd64-static.tar.xz: OK"
      else
        echo "WARNING: No compatible checksum utility found, skipping verification"
      fi

      # Extract and install
      tar xf ffmpeg-release-amd64-static.tar.xz
      mv ffmpeg-*-amd64-static/ffmpeg .
      rm -rf ffmpeg-*-amd64-static* ffmpeg-release-amd64-static.tar.xz*

      chmod +x ffmpeg

      # Verify version on Linux
      if [ "$(uname -s)" = "Linux" ]; then
        BINARY_VERSION=$(./ffmpeg -version 2>&1 | head -1 | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -1)
        echo "✅ Installed ffmpeg version: $${BINARY_VERSION}"
      else
        echo "⏭️  Skipping version verification (Linux binary, non-Linux host)"
      fi

      echo "✅ ffmpeg downloaded and verified successfully"
    EOT
  }
}

# yt-dlp layer (binary + cookies only, ~34MB compressed - direct upload)
data "archive_file" "YtDlpLayer" {
  type        = "zip"
  source_dir  = "./../layers/yt-dlp"
  output_path = "./../build/layers/yt-dlp.zip"

  depends_on = [null_resource.DownloadYtDlpBinary]
}

resource "aws_lambda_layer_version" "YtDlp" {
  filename            = data.archive_file.YtDlpLayer.output_path
  layer_name          = "yt-dlp"
  source_code_hash    = data.archive_file.YtDlpLayer.output_base64sha256
  compatible_runtimes = ["nodejs24.x"]

  description = "yt-dlp binary and YouTube cookies for video downloading"
}

# ffmpeg layer (binary only, ~29MB compressed - direct upload)
# Source: John Van Sickle's static builds (https://johnvansickle.com/ffmpeg/)
data "archive_file" "FfmpegLayer" {
  type        = "zip"
  source_dir  = "./../layers/ffmpeg"
  output_path = "./../build/layers/ffmpeg.zip"

  depends_on = [null_resource.DownloadFfmpegBinary]
}

resource "aws_lambda_layer_version" "Ffmpeg" {
  filename            = data.archive_file.FfmpegLayer.output_path
  layer_name          = "ffmpeg"
  source_code_hash    = data.archive_file.FfmpegLayer.output_base64sha256
  compatible_runtimes = ["nodejs24.x"]

  description = "ffmpeg ${trimspace(file("${path.module}/../layers/ffmpeg/VERSION"))} binary (John Van Sickle static build) for video merging"
}

# bgutil layer (Python PO token provider for YouTube bot detection bypass)
# Must be built before deploy with: pnpm run build:bgutil-layer
# @see https://github.com/Brainicism/bgutil-ytdlp-pot-provider
data "archive_file" "BgutilLayer" {
  type        = "zip"
  source_dir  = "./../layers/bgutil/build"
  output_path = "./../build/layers/bgutil.zip"
}

resource "aws_lambda_layer_version" "Bgutil" {
  filename            = data.archive_file.BgutilLayer.output_path
  layer_name          = "bgutil-pot-provider"
  source_code_hash    = data.archive_file.BgutilLayer.output_base64sha256
  compatible_runtimes = ["nodejs24.x"]

  description = "bgutil-ytdlp-pot-provider for PO token generation to bypass YouTube bot detection"
}

resource "aws_lambda_function" "StartFileUpload" {
  description                    = "Downloads videos to temp file then streams to S3 using yt-dlp"
  function_name                  = local.start_file_upload_function_name
  role                           = aws_iam_role.StartFileUpload.arn
  handler                        = "index.handler"
  runtime                        = "nodejs24.x"
  architectures                  = ["x86_64"] # Must use x86_64 - yt-dlp and ffmpeg layers are amd64 binaries
  depends_on                     = [aws_iam_role_policy_attachment.StartFileUpload]
  timeout                        = 900
  memory_size                    = 2048
  reserved_concurrent_executions = 10 # Prevent YouTube rate limiting
  filename                       = data.archive_file.StartFileUpload.output_path
  source_code_hash               = data.archive_file.StartFileUpload.output_base64sha256
  layers = [
    aws_lambda_layer_version.YtDlp.arn,
    aws_lambda_layer_version.Ffmpeg.arn,
    aws_lambda_layer_version.Bgutil.arn, # PO token provider for YouTube bot detection bypass
    local.adot_layer_arn_x86_64          # Must use x86_64 ADOT layer to match Lambda architecture
  ]

  # 10GB ephemeral storage for temp file downloads (handles 1+ hour 1080p videos)
  ephemeral_storage {
    size = 10240
  }

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = merge(local.common_lambda_env, {
      BUCKET                = aws_s3_bucket.Files.id
      CLOUDFRONT_DOMAIN     = aws_cloudfront_distribution.MediaFiles.domain_name
      SNS_QUEUE_URL         = aws_sqs_queue.SendPushNotification.id
      EVENT_BUS_NAME        = aws_cloudwatch_event_bus.MediaDownloader.name
      YTDLP_BINARY_PATH     = "/opt/bin/yt-dlp_linux"
      PATH                  = "/var/lang/bin:/usr/local/bin:/usr/bin/:/bin:/opt/bin"
      PYTHONPATH            = "/opt/python" # bgutil plugin path for PO token generation
      GITHUB_PERSONAL_TOKEN = data.sops_file.secrets.data["github.issue.token"]
      OTEL_SERVICE_NAME     = local.start_file_upload_function_name
      DSQL_ACCESS_LEVEL     = "readwrite"
    })
  }

  tags = merge(local.common_tags, {
    Name = local.start_file_upload_function_name
  })
}

resource "aws_cloudwatch_log_group" "StartFileUpload" {
  name              = "/aws/lambda/${aws_lambda_function.StartFileUpload.function_name}"
  retention_in_days = 7
  tags              = local.common_tags
}
