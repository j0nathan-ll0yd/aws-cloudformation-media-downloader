# Bootstrap Terraform for Remote State Backend
#
# This is the chicken-and-egg bootstrap - must be applied manually before
# the main terraform configuration can use the remote state backend.
#
# Usage:
#   cd terraform/bootstrap
#   tofu init
#   tofu apply
#
# After this, configure terraform/backend.tf and run:
#   cd ../
#   tofu init -migrate-state

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.19.0"
    }
  }
}

provider "aws" {
  profile = "default"
  region  = "us-west-2"
}

data "aws_caller_identity" "current" {}

locals {
  common_tags = {
    ManagedBy   = "terraform"
    Project     = "media-downloader"
    Environment = "production"
    Purpose     = "terraform-state"
  }
}

# S3 bucket for Terraform state storage
resource "aws_s3_bucket" "TerraformState" {
  bucket = "lifegames-media-downloader-tfstate"
  tags   = local.common_tags
}

# Enable versioning for state history and rollback capability
resource "aws_s3_bucket_versioning" "TerraformState" {
  bucket = aws_s3_bucket.TerraformState.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Server-side encryption with AWS-managed KMS key
resource "aws_s3_bucket_server_side_encryption_configuration" "TerraformState" {
  bucket = aws_s3_bucket.TerraformState.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

# Block all public access - state files contain sensitive data
resource "aws_s3_bucket_public_access_block" "TerraformState" {
  bucket = aws_s3_bucket.TerraformState.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# DynamoDB table for state locking - prevents concurrent applies
resource "aws_dynamodb_table" "TerraformStateLock" {
  name         = "MediaDownloader-TerraformStateLock"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = local.common_tags
}

output "s3_bucket_name" {
  description = "S3 bucket name for terraform state"
  value       = aws_s3_bucket.TerraformState.bucket
}

output "s3_bucket_arn" {
  description = "S3 bucket ARN for terraform state"
  value       = aws_s3_bucket.TerraformState.arn
}

output "dynamodb_table_name" {
  description = "DynamoDB table name for state locking"
  value       = aws_dynamodb_table.TerraformStateLock.name
}

output "dynamodb_table_arn" {
  description = "DynamoDB table ARN for state locking"
  value       = aws_dynamodb_table.TerraformStateLock.arn
}
