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

# =============================================================================
# GitHub Actions OIDC Authentication
# =============================================================================
# Enables GitHub Actions to assume IAM roles without long-lived credentials
# See: docs/wiki/Infrastructure/OIDC-AWS-Authentication.md

resource "aws_iam_openid_connect_provider" "GitHubActionsOIDC" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
  tags            = local.common_tags
}

# Staging deployment role - can be assumed from any branch
resource "aws_iam_role" "GitHubActionsStagingRole" {
  name = "GitHubActions-MediaDownloader-Staging"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.GitHubActionsOIDC.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          "token.actions.githubusercontent.com:sub" = "repo:j0nathan-ll0yd/aws-cloudformation-media-downloader:*"
        }
      }
    }]
  })

  tags = local.common_tags
}

# Production deployment role - restricted to main/master branch
resource "aws_iam_role" "GitHubActionsProductionRole" {
  name = "GitHubActions-MediaDownloader-Production"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.GitHubActionsOIDC.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          "token.actions.githubusercontent.com:sub" = "repo:j0nathan-ll0yd/aws-cloudformation-media-downloader:ref:refs/heads/master"
        }
      }
    }]
  })

  tags = local.common_tags
}

# IAM policy for Terraform operations
resource "aws_iam_policy" "TerraformDeployPolicy" {
  name        = "TerraformDeployPolicy"
  description = "Permissions for Terraform/OpenTofu deployments"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "TerraformState"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.TerraformState.arn,
          "${aws_s3_bucket.TerraformState.arn}/*"
        ]
      },
      {
        Sid    = "TerraformLock"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:DeleteItem"
        ]
        Resource = aws_dynamodb_table.TerraformStateLock.arn
      },
      {
        Sid    = "LambdaManagement"
        Effect = "Allow"
        Action = [
          "lambda:*"
        ]
        Resource = "arn:aws:lambda:us-west-2:${data.aws_caller_identity.current.account_id}:function:*"
      },
      {
        Sid    = "APIGatewayManagement"
        Effect = "Allow"
        Action = [
          "apigateway:*"
        ]
        Resource = "*"
      },
      {
        Sid    = "DSQLManagement"
        Effect = "Allow"
        Action = [
          "dsql:*"
        ]
        Resource = "*"
      },
      {
        Sid    = "S3Management"
        Effect = "Allow"
        Action = [
          "s3:*"
        ]
        Resource = [
          "arn:aws:s3:::lifegames-*-media-files",
          "arn:aws:s3:::lifegames-*-media-files/*"
        ]
      },
      {
        Sid    = "EventBridgeManagement"
        Effect = "Allow"
        Action = [
          "events:*"
        ]
        Resource = "*"
      },
      {
        Sid    = "SQSSNSManagement"
        Effect = "Allow"
        Action = [
          "sqs:*",
          "sns:*"
        ]
        Resource = "*"
      },
      {
        Sid    = "CloudWatchManagement"
        Effect = "Allow"
        Action = [
          "cloudwatch:*",
          "logs:*"
        ]
        Resource = "*"
      },
      {
        Sid    = "CloudFrontManagement"
        Effect = "Allow"
        Action = [
          "cloudfront:*"
        ]
        Resource = "*"
      },
      {
        Sid    = "IAMManagement"
        Effect = "Allow"
        Action = [
          "iam:GetRole",
          "iam:GetRolePolicy",
          "iam:GetPolicy",
          "iam:GetPolicyVersion",
          "iam:ListRolePolicies",
          "iam:ListAttachedRolePolicies",
          "iam:CreateRole",
          "iam:DeleteRole",
          "iam:UpdateRole",
          "iam:AttachRolePolicy",
          "iam:DetachRolePolicy",
          "iam:PutRolePolicy",
          "iam:DeleteRolePolicy",
          "iam:CreatePolicy",
          "iam:DeletePolicy",
          "iam:CreatePolicyVersion",
          "iam:DeletePolicyVersion",
          "iam:PassRole",
          "iam:TagRole",
          "iam:TagPolicy",
          "iam:ListInstanceProfilesForRole"
        ]
        Resource = "*"
      },
      {
        Sid    = "DynamoDBManagement"
        Effect = "Allow"
        Action = [
          "dynamodb:*"
        ]
        Resource = [
          "arn:aws:dynamodb:us-west-2:${data.aws_caller_identity.current.account_id}:table/*-MediaDownloader-*"
        ]
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "staging_deploy" {
  role       = aws_iam_role.GitHubActionsStagingRole.name
  policy_arn = aws_iam_policy.TerraformDeployPolicy.arn
}

resource "aws_iam_role_policy_attachment" "production_deploy" {
  role       = aws_iam_role.GitHubActionsProductionRole.name
  policy_arn = aws_iam_policy.TerraformDeployPolicy.arn
}

output "GitHubActionsStagingRoleArn" {
  description = "ARN of the GitHub Actions staging deployment role"
  value       = aws_iam_role.GitHubActionsStagingRole.arn
}

output "GitHubActionsProductionRoleArn" {
  description = "ARN of the GitHub Actions production deployment role"
  value       = aws_iam_role.GitHubActionsProductionRole.arn
}
