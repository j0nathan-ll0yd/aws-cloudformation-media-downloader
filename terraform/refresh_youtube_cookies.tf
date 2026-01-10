# RefreshYouTubeCookies Lambda
# Scheduled job to refresh YouTube cookies using Playwright browser automation.
# Extracts fresh cookies and stores them in Secrets Manager for yt-dlp usage.
# Trigger: CloudWatch Schedule (every 25 minutes)

locals {
  refresh_youtube_cookies_function_name = "RefreshYouTubeCookies"
}

# =============================================================================
# Secrets Manager - YouTube Cookies Storage
# =============================================================================

resource "aws_secretsmanager_secret" "YouTubeCookies" {
  name                    = "${local.project_name}/youtube-cookies"
  description             = "Fresh YouTube cookies extracted by RefreshYouTubeCookies Lambda for yt-dlp"
  recovery_window_in_days = 0 # Immediate deletion for dev/test cycles
  tags                    = local.common_tags
}

# =============================================================================
# S3 Bucket for Deployment Artifacts (Lambda layers > 70MB)
# =============================================================================

resource "aws_s3_bucket" "DeploymentArtifacts" {
  bucket = "lifegames-media-downloader-artifacts"
  tags   = local.common_tags
}

resource "aws_s3_bucket_lifecycle_configuration" "DeploymentArtifactsLifecycle" {
  bucket = aws_s3_bucket.DeploymentArtifacts.id

  rule {
    id     = "cleanup-old-versions"
    status = "Enabled"

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

resource "aws_s3_bucket_versioning" "DeploymentArtifactsVersioning" {
  bucket = aws_s3_bucket.DeploymentArtifacts.id
  versioning_configuration {
    status = "Enabled"
  }
}

# =============================================================================
# Lambda Layer - Playwright + Chromium (via S3 for large files)
# =============================================================================

resource "aws_s3_object" "PlaywrightLayer" {
  bucket = aws_s3_bucket.DeploymentArtifacts.id
  key    = "layers/playwright-layer.zip"
  source = "./../layers/playwright/playwright-layer.zip"
  etag   = filemd5("./../layers/playwright/playwright-layer.zip")
}

resource "aws_lambda_layer_version" "Playwright" {
  s3_bucket         = aws_s3_bucket.DeploymentArtifacts.id
  s3_key            = aws_s3_object.PlaywrightLayer.key
  s3_object_version = aws_s3_object.PlaywrightLayer.version_id
  layer_name        = "playwright-chromium"
  # Node.js 20.x required for @sparticuz/chromium compatibility (NSS libraries)
  compatible_runtimes = ["nodejs20.x"]

  description = "Puppeteer ${trimspace(file("${path.module}/../layers/playwright/VERSION"))} with @sparticuz/chromium for Lambda browser automation"
}

# =============================================================================
# IAM Role and Policies
# =============================================================================

resource "aws_iam_role" "RefreshYouTubeCookies" {
  name               = local.refresh_youtube_cookies_function_name
  assume_role_policy = data.aws_iam_policy_document.LambdaAssumeRole.json
  tags               = local.common_tags
}

data "aws_iam_policy_document" "RefreshYouTubeCookies" {
  # Secrets Manager write access
  statement {
    actions = [
      "secretsmanager:PutSecretValue",
      "secretsmanager:UpdateSecret"
    ]
    resources = [aws_secretsmanager_secret.YouTubeCookies.arn]
  }
}

resource "aws_iam_policy" "RefreshYouTubeCookies" {
  name   = local.refresh_youtube_cookies_function_name
  policy = data.aws_iam_policy_document.RefreshYouTubeCookies.json
  tags   = local.common_tags
}

resource "aws_iam_role_policy_attachment" "RefreshYouTubeCookies" {
  role       = aws_iam_role.RefreshYouTubeCookies.name
  policy_arn = aws_iam_policy.RefreshYouTubeCookies.arn
}

resource "aws_iam_role_policy" "RefreshYouTubeCookiesLogging" {
  name = "RefreshYouTubeCookiesLogging"
  role = aws_iam_role.RefreshYouTubeCookies.id
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
        "arn:aws:logs:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.refresh_youtube_cookies_function_name}",
        "arn:aws:logs:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.refresh_youtube_cookies_function_name}:*"
      ]
    }]
  })
}

resource "aws_iam_role_policy_attachment" "RefreshYouTubeCookiesXRay" {
  role       = aws_iam_role.RefreshYouTubeCookies.name
  policy_arn = aws_iam_policy.CommonLambdaXRay.arn
}

# =============================================================================
# CloudWatch Schedule (every 25 minutes)
# =============================================================================

resource "aws_cloudwatch_event_rule" "RefreshYouTubeCookies" {
  name                = "RefreshYouTubeCookies"
  description         = "Refresh YouTube cookies every 25 minutes to maintain fresh authentication"
  schedule_expression = "rate(25 minutes)"
  state               = "DISABLED" # Disabled until stealth login is working correctly
  tags                = local.common_tags
}

resource "aws_cloudwatch_event_target" "RefreshYouTubeCookies" {
  rule = aws_cloudwatch_event_rule.RefreshYouTubeCookies.name
  arn  = aws_lambda_function.RefreshYouTubeCookies.arn
}

resource "aws_lambda_permission" "RefreshYouTubeCookies" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.RefreshYouTubeCookies.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.RefreshYouTubeCookies.arn
}

# =============================================================================
# CloudWatch Log Group
# =============================================================================

resource "aws_cloudwatch_log_group" "RefreshYouTubeCookies" {
  name              = "/aws/lambda/${aws_lambda_function.RefreshYouTubeCookies.function_name}"
  retention_in_days = 7
  tags              = local.common_tags
}

# =============================================================================
# Lambda Function
# =============================================================================

data "archive_file" "RefreshYouTubeCookies" {
  type        = "zip"
  source_dir  = "./../build/lambdas/RefreshYouTubeCookies"
  output_path = "./../build/lambdas/RefreshYouTubeCookies.zip"
}

resource "aws_lambda_function" "RefreshYouTubeCookies" {
  description   = "Extracts fresh YouTube cookies using Puppeteer and stores in Secrets Manager"
  function_name = local.refresh_youtube_cookies_function_name
  role          = aws_iam_role.RefreshYouTubeCookies.arn
  handler       = "index.handler"
  # Node.js 20.x required for @sparticuz/chromium compatibility (NSS libraries)
  runtime = "nodejs20.x"
  # Must use x86_64 - @sparticuz/chromium binary is compiled for amd64
  architectures    = ["x86_64"]
  depends_on       = [aws_iam_role_policy_attachment.RefreshYouTubeCookies]
  filename         = data.archive_file.RefreshYouTubeCookies.output_path
  source_code_hash = data.archive_file.RefreshYouTubeCookies.output_base64sha256

  # Playwright layer includes @sparticuz/chromium (~140MB unzipped)
  layers = [
    aws_lambda_layer_version.Playwright.arn,
    local.adot_layer_arn_x86_64
  ]

  # Browser automation requires more memory
  memory_size = 1024
  timeout     = 120

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = merge(local.common_lambda_env, {
      YOUTUBE_COOKIES_SECRET_ID = aws_secretsmanager_secret.YouTubeCookies.id
      OTEL_SERVICE_NAME         = local.refresh_youtube_cookies_function_name
      YOUTUBE_EMAIL             = var.youtube_email
      YOUTUBE_PASSWORD          = var.youtube_password
    })
  }

  tags = merge(local.common_tags, {
    Name = local.refresh_youtube_cookies_function_name
  })
}

# =============================================================================
# Outputs
# =============================================================================

output "youtube_cookies_secret_arn" {
  description = "ARN of the Secrets Manager secret storing YouTube cookies"
  value       = aws_secretsmanager_secret.YouTubeCookies.arn
}

output "refresh_youtube_cookies_lambda_arn" {
  description = "ARN of the RefreshYouTubeCookies Lambda function"
  value       = aws_lambda_function.RefreshYouTubeCookies.arn
}
