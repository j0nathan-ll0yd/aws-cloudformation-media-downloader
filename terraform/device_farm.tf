# =============================================================================
# AWS DEVICE FARM E2E TESTING INFRASTRUCTURE
# =============================================================================
# Provides end-to-end testing for iOS app on real devices via AWS Device Farm.
# Uses CodePipeline for orchestration with manual trigger for cost control.
#
# Cost optimization:
# - Single device pool (max_devices = 1)
# - Manual trigger only (no automatic polling)
# - 30-minute timeout prevents runaway tests
# - S3 lifecycle rules for artifact cleanup
# - AWS Budgets alert at $50/month
#
# Estimated cost: ~$10-26/month for 4-10 test runs (15 min each)

locals {
  e2e_test_project_name = "media-downloader-ios-e2e"
}

# -----------------------------------------------------------------------------
# Device Farm Project
# -----------------------------------------------------------------------------

resource "aws_devicefarm_project" "ios_e2e_tests" {
  name                        = local.e2e_test_project_name
  default_job_timeout_minutes = 30

  tags = merge(local.common_tags, {
    Component   = "E2E-Testing"
    Description = "iOS E2E testing for media downloader app"
  })
}

# -----------------------------------------------------------------------------
# Device Pool - Single Latest iPhone
# -----------------------------------------------------------------------------

resource "aws_devicefarm_device_pool" "latest_iphone" {
  name        = "LatestIPhone-SingleDevice"
  project_arn = aws_devicefarm_project.ios_e2e_tests.arn
  description = "Single latest iPhone device for cost-effective E2E testing"

  max_devices = 1

  rule {
    attribute = "PLATFORM"
    operator  = "EQUALS"
    value     = "\"IOS\""
  }

  rule {
    attribute = "MANUFACTURER"
    operator  = "EQUALS"
    value     = "\"Apple\""
  }

  # Target iPhone 15 Pro or newer
  rule {
    attribute = "MODEL"
    operator  = "CONTAINS"
    value     = "\"iPhone 15 Pro\""
  }

  # iOS 17.0 or newer
  rule {
    attribute = "OS_VERSION"
    operator  = "GREATER_THAN_OR_EQUALS"
    value     = "\"17.0\""
  }

  rule {
    attribute = "AVAILABILITY"
    operator  = "EQUALS"
    value     = "\"AVAILABLE\""
  }

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# S3 Bucket for Test Artifacts
# -----------------------------------------------------------------------------

resource "aws_s3_bucket" "e2e_test_artifacts" {
  bucket = "media-downloader-e2e-artifacts-${data.aws_caller_identity.current.account_id}"

  tags = merge(local.common_tags, {
    Component = "E2E-Testing"
  })
}

resource "aws_s3_bucket_versioning" "e2e_test_artifacts" {
  bucket = aws_s3_bucket.e2e_test_artifacts.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "e2e_test_artifacts" {
  bucket = aws_s3_bucket.e2e_test_artifacts.id

  rule {
    id     = "cleanup-old-test-artifacts"
    status = "Enabled"

    filter {
      prefix = "builds/"
    }

    expiration {
      days = 30
    }

    noncurrent_version_expiration {
      noncurrent_days = 7
    }
  }

  rule {
    id     = "cleanup-test-results"
    status = "Enabled"

    filter {
      prefix = "results/"
    }

    expiration {
      days = 90
    }
  }
}

resource "aws_s3_bucket_public_access_block" "e2e_test_artifacts" {
  bucket = aws_s3_bucket.e2e_test_artifacts.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# -----------------------------------------------------------------------------
# IAM Role for CodePipeline
# -----------------------------------------------------------------------------

data "aws_iam_policy_document" "codepipeline_e2e_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["codepipeline.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "codepipeline_e2e" {
  name               = "codepipeline-e2e-service-role"
  assume_role_policy = data.aws_iam_policy_document.codepipeline_e2e_assume_role.json

  tags = local.common_tags
}

# S3 Access Policy for CodePipeline
data "aws_iam_policy_document" "codepipeline_e2e_s3_access" {
  statement {
    sid = "S3Access"
    actions = [
      "s3:GetObject",
      "s3:GetObjectVersion",
      "s3:GetBucketVersioning",
      "s3:PutObject",
      "s3:PutObjectAcl"
    ]
    resources = [
      aws_s3_bucket.e2e_test_artifacts.arn,
      "${aws_s3_bucket.e2e_test_artifacts.arn}/*"
    ]
  }
}

resource "aws_iam_role_policy" "codepipeline_e2e_s3" {
  name   = "s3-access"
  role   = aws_iam_role.codepipeline_e2e.id
  policy = data.aws_iam_policy_document.codepipeline_e2e_s3_access.json
}

# Device Farm Access Policy for CodePipeline
data "aws_iam_policy_document" "codepipeline_e2e_device_farm" {
  statement {
    sid = "DeviceFarmAccess"
    actions = [
      "devicefarm:ListProjects",
      "devicefarm:ListDevicePools",
      "devicefarm:GetRun",
      "devicefarm:GetUpload",
      "devicefarm:CreateUpload",
      "devicefarm:ScheduleRun",
      "devicefarm:ListArtifacts",
      "devicefarm:GetDevice",
      "devicefarm:ListDevices"
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "codepipeline_e2e_device_farm" {
  name   = "device-farm-access"
  role   = aws_iam_role.codepipeline_e2e.id
  policy = data.aws_iam_policy_document.codepipeline_e2e_device_farm.json
}

# -----------------------------------------------------------------------------
# CodePipeline for E2E Testing
# -----------------------------------------------------------------------------

resource "aws_codepipeline" "ios_e2e_tests" {
  name          = "ios-e2e-test-pipeline"
  role_arn      = aws_iam_role.codepipeline_e2e.arn
  pipeline_type = "V2"

  artifact_store {
    location = aws_s3_bucket.e2e_test_artifacts.bucket
    type     = "S3"
  }

  # Source Stage: S3
  stage {
    name = "Source"

    action {
      name             = "S3-Source"
      category         = "Source"
      owner            = "AWS"
      provider         = "S3"
      version          = "1"
      output_artifacts = ["SourceArtifact"]

      configuration = {
        S3Bucket             = aws_s3_bucket.e2e_test_artifacts.bucket
        S3ObjectKey          = "builds/ios-app.zip"
        PollForSourceChanges = "false"
      }
    }
  }

  # Approval Stage: Manual Gate
  stage {
    name = "Approval"

    action {
      name     = "Manual-Approval"
      category = "Approval"
      owner    = "AWS"
      provider = "Manual"
      version  = "1"

      configuration = {
        CustomData         = "Approve to run E2E tests on iOS device. Estimated cost: $2.55 (15 min @ $0.17/min)"
        ExternalEntityLink = "https://console.aws.amazon.com/devicefarm/home?region=us-west-2#/projects/${split("/", aws_devicefarm_project.ios_e2e_tests.arn)[1]}"
      }
    }
  }

  # Test Stage: Device Farm
  stage {
    name = "Test"

    action {
      name            = "Device-Farm-Test"
      category        = "Test"
      owner           = "AWS"
      provider        = "DeviceFarm"
      version         = "1"
      input_artifacts = ["SourceArtifact"]

      configuration = {
        AppType       = "iOS"
        ProjectId     = split("/", aws_devicefarm_project.ios_e2e_tests.arn)[1]
        App           = "app.ipa"
        TestType      = "XCTEST_UI"
        Test          = "tests.zip"
        DevicePoolArn = aws_devicefarm_device_pool.latest_iphone.arn
      }
    }
  }

  tags = merge(local.common_tags, {
    Component = "E2E-Testing"
  })
}

# -----------------------------------------------------------------------------
# AWS Budgets Alert for Cost Monitoring
# -----------------------------------------------------------------------------

variable "budget_notification_email" {
  description = "Email address for budget notifications"
  type        = string
  default     = ""
}

resource "aws_budgets_budget" "device_farm" {
  count = var.budget_notification_email != "" ? 1 : 0

  name              = "device-farm-e2e-testing"
  budget_type       = "COST"
  limit_amount      = "50"
  limit_unit        = "USD"
  time_unit         = "MONTHLY"
  time_period_start = "2025-01-01_00:00"

  cost_filter {
    name   = "Service"
    values = ["AWS Device Farm"]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.budget_notification_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.budget_notification_email]
  }

  tags = merge(local.common_tags, {
    Component = "E2E-Testing"
  })
}

# -----------------------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------------------

output "device_farm_project_arn" {
  description = "ARN of the Device Farm project"
  value       = aws_devicefarm_project.ios_e2e_tests.arn
}

output "device_farm_project_id" {
  description = "ID of the Device Farm project"
  value       = split("/", aws_devicefarm_project.ios_e2e_tests.arn)[1]
}

output "device_farm_device_pool_arn" {
  description = "ARN of the device pool"
  value       = aws_devicefarm_device_pool.latest_iphone.arn
}

output "e2e_test_artifacts_bucket" {
  description = "S3 bucket for test artifacts"
  value       = aws_s3_bucket.e2e_test_artifacts.bucket
}

output "codepipeline_e2e_arn" {
  description = "ARN of the E2E test pipeline"
  value       = aws_codepipeline.ios_e2e_tests.arn
}

output "codepipeline_e2e_console_url" {
  description = "URL to the CodePipeline console"
  value       = "https://console.aws.amazon.com/codesuite/codepipeline/pipelines/${aws_codepipeline.ios_e2e_tests.name}/view?region=us-west-2"
}
