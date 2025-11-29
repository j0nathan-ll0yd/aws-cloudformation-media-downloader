resource "aws_iam_role" "WebhookFeedlyRole" {
  name               = "WebhookFeedlyRole"
  assume_role_policy = data.aws_iam_policy_document.LambdaGatewayAssumeRole.json
}

data "aws_iam_policy_document" "WebhookFeedlyRole" {
  statement {
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.SendPushNotification.arn]
  }
  statement {
    actions   = ["lambda:InvokeFunction"]
    resources = [aws_lambda_function.StartFileUpload.arn]
  }
  # PutItem/UpdateItem on base table for Files and UserFiles
  # GetItem to check existing files
  statement {
    actions = [
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:GetItem"
    ]
    resources = [aws_dynamodb_table.MediaDownloader.arn]
  }
}

resource "aws_iam_policy" "WebhookFeedlyRolePolicy" {
  name   = "WebhookFeedlyRolePolicy"
  policy = data.aws_iam_policy_document.WebhookFeedlyRole.json
}

resource "aws_iam_role_policy_attachment" "WebhookFeedlyPolicy" {
  role       = aws_iam_role.WebhookFeedlyRole.name
  policy_arn = aws_iam_policy.WebhookFeedlyRolePolicy.arn
}

resource "aws_iam_role_policy_attachment" "WebhookFeedlyPolicyLogging" {
  role       = aws_iam_role.WebhookFeedlyRole.name
  policy_arn = aws_iam_policy.CommonLambdaLogging.arn
}

resource "aws_iam_role_policy_attachment" "WebhookFeedlyPolicyXRay" {
  role       = aws_iam_role.WebhookFeedlyRole.name
  policy_arn = aws_iam_policy.CommonLambdaXRay.arn
}

resource "aws_lambda_permission" "WebhookFeedly" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.WebhookFeedly.function_name
  principal     = "apigateway.amazonaws.com"
}

resource "aws_cloudwatch_log_group" "WebhookFeedly" {
  name              = "/aws/lambda/${aws_lambda_function.WebhookFeedly.function_name}"
  retention_in_days = 14
}

data "archive_file" "WebhookFeedly" {
  type        = "zip"
  source_file = "./../build/lambdas/WebhookFeedly.js"
  output_path = "./../build/lambdas/WebhookFeedly.zip"
}

resource "aws_lambda_function" "WebhookFeedly" {
  description      = "A webhook from Feedly via IFTTT"
  function_name    = "WebhookFeedly"
  role             = aws_iam_role.WebhookFeedlyRole.arn
  handler          = "WebhookFeedly.handler"
  runtime          = "nodejs22.x"
  depends_on       = [aws_iam_role_policy_attachment.WebhookFeedlyPolicy]
  filename         = data.archive_file.WebhookFeedly.output_path
  source_code_hash = data.archive_file.WebhookFeedly.output_base64sha256

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      DynamoDBTableName = aws_dynamodb_table.MediaDownloader.name
      SNSQueueUrl       = aws_sqs_queue.SendPushNotification.id
    }
  }
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
  # UpdateItem on base table to update File metadata during upload
  statement {
    actions   = ["dynamodb:UpdateItem"]
    resources = [aws_dynamodb_table.MediaDownloader.arn]
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
    resources = ["*"]
  }
}

resource "aws_iam_role" "MultipartUploadRole" {
  name               = "MultipartUploadRole"
  assume_role_policy = data.aws_iam_policy_document.LambdaAssumeRole.json
}

resource "aws_iam_policy" "MultipartUploadRolePolicy" {
  name   = "MultipartUploadRolePolicy"
  policy = data.aws_iam_policy_document.MultipartUpload.json
}

resource "aws_iam_role_policy_attachment" "MultipartUploadPolicy" {
  role       = aws_iam_role.MultipartUploadRole.name
  policy_arn = aws_iam_policy.MultipartUploadRolePolicy.arn
}

resource "aws_iam_role_policy_attachment" "MultipartUploadPolicyLogging" {
  role       = aws_iam_role.MultipartUploadRole.name
  policy_arn = aws_iam_policy.CommonLambdaLogging.arn
}

resource "aws_iam_role_policy_attachment" "MultipartUploadPolicyXRay" {
  role       = aws_iam_role.MultipartUploadRole.name
  policy_arn = aws_iam_policy.CommonLambdaXRay.arn
}

data "archive_file" "StartFileUpload" {
  type        = "zip"
  source_file = "./../build/lambdas/StartFileUpload.js"
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

data "archive_file" "YtDlpLayer" {
  type        = "zip"
  source_dir  = "./../layers/yt-dlp"
  output_path = "./../build/layers/yt-dlp.zip"

  depends_on = [null_resource.DownloadYtDlpBinary]
}

resource "aws_lambda_layer_version" "YtDlp" {
  filename            = data.archive_file.YtDlpLayer.output_path
  layer_name          = "yt-dlp"
  compatible_runtimes = ["nodejs22.x"]
  source_code_hash    = data.archive_file.YtDlpLayer.output_base64sha256

  description = "yt-dlp binary (Linux x86_64) and YouTube cookies for authenticated video downloading"
}

resource "aws_lambda_function" "StartFileUpload" {
  description      = "Streams video downloads directly to S3 using yt-dlp"
  function_name    = "StartFileUpload"
  role             = aws_iam_role.MultipartUploadRole.arn
  handler          = "StartFileUpload.handler"
  runtime          = "nodejs22.x"
  depends_on       = [aws_iam_role_policy_attachment.MultipartUploadPolicy]
  timeout          = 900
  memory_size      = 2048
  filename         = data.archive_file.StartFileUpload.output_path
  source_code_hash = data.archive_file.StartFileUpload.output_base64sha256
  layers           = [aws_lambda_layer_version.YtDlp.arn]

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      Bucket              = aws_s3_bucket.Files.id
      DynamoDBTableName   = aws_dynamodb_table.MediaDownloader.name
      YtdlpBinaryPath     = "/opt/bin/yt-dlp_linux"
      PATH                = "/var/lang/bin:/usr/local/bin:/usr/bin/:/bin:/opt/bin"
      GithubPersonalToken = data.sops_file.secrets.data["github.issue.token"]
    }
  }
}

resource "aws_lambda_permission" "StartFileUpload" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.StartFileUpload.function_name
  principal     = "events.amazonaws.com"
}

resource "aws_cloudwatch_log_group" "StartFileUpload" {
  name              = "/aws/lambda/${aws_lambda_function.StartFileUpload.function_name}"
  retention_in_days = 14
}
