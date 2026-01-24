# Staging/Production Environment Implementation Plan

## Overview

This plan implements a complete staging/production environment separation for the `aws-cloudformation-media-downloader` project. It builds upon the prior work in PR #242 (feature/terraform-env-restructure) while addressing gaps in CI/CD automation, state management, security, monitoring, and migration strategy.

**Goal**: Enable safe testing of infrastructure and application changes in an isolated staging environment before promoting to production, reducing blast radius and ensuring business continuity.

## Current State Analysis

### Infrastructure (Single Production Environment)
- **State Management**: S3 backend (`lifegames-media-downloader-tfstate`) with DynamoDB locking (`MediaDownloader-TerraformStateLock`)
- **Environment Tag**: Hardcoded `Environment = "production"` in `terraform/main.tf:51`
- **Resource Naming**: No environment prefix (e.g., `RegisterUser`, `MediaDownloader`, `lifegames-media-downloader-files`)
- **Secrets**: Single `secrets.enc.yaml` file (SOPS-encrypted)
- **Deployment**: Manual via `pnpm run deploy` with pre-deploy drift checks

### Key AWS Resources Requiring Environment Isolation
| Resource Type | Current Name | Terraform File |
|--------------|--------------|----------------|
| DSQL Cluster | `MediaDownloader-DSQL` | `aurora_dsql.tf:8` |
| S3 Bucket | `lifegames-media-downloader-files` | `file_bucket.tf:6` |
| S3 State Bucket | `lifegames-media-downloader-tfstate` | `backend.tf:15` |
| EventBridge Bus | `MediaDownloader` | `eventbridge.tf:15` |
| DynamoDB Table | `MediaDownloader-Idempotency` | `dynamodb_idempotency.tf:6` |
| API Gateway | `OfflineMediaDownloader` | `api_gateway.tf:5` |
| CloudFront (API) | `Production` | `cloudfront_middleware.tf:109` |
| CloudFront (Media) | `MediaFilesDistribution` | `file_bucket.tf:35` |
| 18 Lambda Functions | PascalCase names | Various `.tf` files |
| SNS Topic | `media-downloader-operations-alerts` | `cloudwatch.tf` |

### PR #242 Analysis
The prior work proposed:
- OpenTofu workspaces for state isolation
- `stag-*` and `prod-*` resource prefixes
- Environment-specific `.tfvars` files
- Modified 23 `.tf` files for `${var.resource_prefix}-*` naming

**Gaps in PR #242**:
- No CI/CD pipeline implementation
- No state migration strategy for existing production resources
- No OIDC authentication setup
- No environment-specific secrets handling
- No rollback procedures
- No monitoring/alerting per environment
- No cost analysis

## Desired End State

### Architecture
```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Deployment Flow                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  LOCAL AGENTS ──────────────────────────► STAGING (dev environment)     │
│    └─ pnpm run deploy:staging                                            │
│                                                                          │
│  MERGE TO MAIN ─────────────────────────► PRODUCTION (automatic)        │
│    └─ GitHub Actions auto-deploys on merge (no manual gate)             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
        ┌───────────────────┐           ┌───────────────────┐
        │     STAGING       │           │    PRODUCTION     │
        │  (dev/test env)   │           │   (live system)   │
        ├───────────────────┤           ├───────────────────┤
        │ stag-* resources  │           │ prod-* resources  │
        │ DEBUG logging     │           │ INFO logging      │
        │ 3-day retention   │           │ 7-day retention   │
        │ Reduced quotas    │           │ Full quotas       │
        │ Local deploys     │           │ CI/CD deploys     │
        └───────────────────┘           └───────────────────┘
                    │                               │
                    ▼                               ▼
        ┌───────────────────┐           ┌───────────────────┐
        │  S3 State Bucket  │           │  S3 State Bucket  │
        │ env:staging/      │           │ env:production/   │
        │ terraform.tfstate │           │ terraform.tfstate │
        └───────────────────┘           └───────────────────┘
```

### Verification Criteria
- [ ] `tofu workspace list` shows `staging` and `production` workspaces
- [ ] Staging resources have `stag-` prefix in AWS Console
- [ ] Production resources have `prod-` prefix in AWS Console
- [ ] Local agents can deploy directly to staging via `pnpm run deploy:staging`
- [ ] Merge to main triggers AUTOMATIC production deployment (no manual approval)
- [ ] Rollback via `git revert` + re-deploy works correctly
- [ ] Monitoring dashboards exist per environment
- [ ] Separate secrets files for each environment

## What We're NOT Doing

1. **Separate AWS Accounts** - Using single account with resource prefixes (can migrate later)
2. **Development Environment** - Only staging + production initially
3. **Blue/Green Deployments** - Standard replace strategy for Lambda
4. **Custom Domains per Environment** - Using default CloudFront/API Gateway domains
5. **Database Migration Automation** - MigrateDSQL Lambda handles this already
6. **Feature Flags** - Out of scope for infrastructure work

---

## Phase 1: Terraform Refactoring for Environment Variables

### Overview
Extract all hardcoded values into variables and create environment-specific `.tfvars` files. This phase enables the same Terraform code to deploy to different environments.

### Naming Convention Reference
All resource names MUST follow the conventions documented in `docs/wiki/Infrastructure/Resource-Naming.md`:
- **PascalCase for AWS resources** (e.g., `RegisterUser`, `MediaDownloader`)
- **Match Terraform ID to AWS name**
- **Include resource type suffix** where appropriate (Role, Policy, Queue)
- **Environment prefix pattern**: `${var.resource_prefix}-ResourceName` (e.g., `stag-RegisterUser`, `prod-RegisterUser`)

### Changes Required

#### 1.1 Create Variables File
**File**: `terraform/variables.tf` (NEW)

```hcl
# =============================================================================
# Environment Configuration Variables
# =============================================================================

variable "environment" {
  description = "Environment name (staging, production)"
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be 'staging' or 'production'."
  }
}

variable "resource_prefix" {
  description = "Prefix for all resource names (stag, prod)"
  type        = string
  validation {
    condition     = contains(["stag", "prod"], var.resource_prefix)
    error_message = "Resource prefix must be 'stag' or 'prod'."
  }
}

variable "log_level" {
  description = "Lambda log level"
  type        = string
  default     = "INFO"
  validation {
    condition     = contains(["DEBUG", "INFO", "WARN", "ERROR"], var.log_level)
    error_message = "Log level must be DEBUG, INFO, WARN, or ERROR."
  }
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 7
  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90], var.log_retention_days)
    error_message = "Must be a valid CloudWatch retention period."
  }
}

variable "api_throttle_burst_limit" {
  description = "API Gateway throttle burst limit"
  type        = number
  default     = 100
}

variable "api_throttle_rate_limit" {
  description = "API Gateway throttle rate limit"
  type        = number
  default     = 50
}

variable "api_quota_limit" {
  description = "API Gateway daily quota limit"
  type        = number
  default     = 10000
}

variable "dsql_deletion_protection" {
  description = "Enable deletion protection for DSQL cluster"
  type        = bool
  default     = true
}

variable "enable_cloudwatch_alarms" {
  description = "Enable CloudWatch alarms (disable for staging cost savings)"
  type        = bool
  default     = true
}

variable "download_reserved_concurrency" {
  description = "Reserved concurrency for StartFileUpload Lambda"
  type        = number
  default     = 10
}
```

#### 1.2 Create Environment tfvars Files

**File**: `terraform/environments/staging.tfvars` (NEW)
```hcl
# Staging Environment Configuration
# Deploy with: tofu workspace select staging && tofu apply -var-file=environments/staging.tfvars

environment       = "staging"
resource_prefix   = "stag"
log_level         = "DEBUG"
log_retention_days = 3

# Reduced quotas for staging
api_throttle_burst_limit = 20
api_throttle_rate_limit  = 10
api_quota_limit          = 1000

# Allow destruction in staging
dsql_deletion_protection = false

# Disable alarms to reduce costs
enable_cloudwatch_alarms = false

# Lower concurrency in staging
download_reserved_concurrency = 2
```

**File**: `terraform/environments/production.tfvars` (NEW)
```hcl
# Production Environment Configuration
# Deploy with: tofu workspace select production && tofu apply -var-file=environments/production.tfvars

environment       = "production"
resource_prefix   = "prod"
log_level         = "INFO"
log_retention_days = 7

# Full quotas for production
api_throttle_burst_limit = 100
api_throttle_rate_limit  = 50
api_quota_limit          = 10000

# Protect production data
dsql_deletion_protection = true

# Full monitoring
enable_cloudwatch_alarms = true

# Production concurrency
download_reserved_concurrency = 10
```

#### 1.3 Update main.tf Locals

**File**: `terraform/main.tf`
**Changes**: Replace hardcoded values with variables

```hcl
locals {
  # Project name used for resource naming
  project_name = "media-downloader"

  # Environment-aware resource naming
  # Examples: stag-RegisterUser, prod-RegisterUser
  name_prefix = var.resource_prefix

  # Common tags for all resources (drift detection & identification)
  common_tags = {
    ManagedBy   = "terraform"
    Project     = local.project_name
    Environment = var.environment
  }

  # Common environment variables for all lambdas
  common_lambda_env = {
    OPENTELEMETRY_EXTENSION_LOG_LEVEL  = "warn"
    OPENTELEMETRY_COLLECTOR_CONFIG_URI = "/var/task/collector.yaml"
    NODE_OPTIONS                       = "--no-deprecation"
    LOG_LEVEL                          = var.log_level
    DSQL_CLUSTER_ENDPOINT              = "${aws_dsql_cluster.media_downloader.identifier}.dsql.${data.aws_region.current.id}.on.aws"
    DSQL_REGION                        = data.aws_region.current.id
    ENVIRONMENT                        = var.environment
  }
}
```

#### 1.4 Update Resource Names (All 23 .tf Files)

Each resource needs the prefix. Pattern for each resource type:

**Lambda Functions** (e.g., `register_user.tf`):
```hcl
locals {
  register_user_function_name = "${var.resource_prefix}-RegisterUser"
}

resource "aws_lambda_function" "RegisterUser" {
  function_name = local.register_user_function_name
  # ... rest unchanged
}

resource "aws_cloudwatch_log_group" "RegisterUser" {
  name              = "/aws/lambda/${local.register_user_function_name}"
  retention_in_days = var.log_retention_days
  # ...
}
```

**S3 Buckets** (`file_bucket.tf`):
```hcl
resource "aws_s3_bucket" "Files" {
  bucket = "lifegames-${var.resource_prefix}-media-files"
  tags   = local.common_tags
}
```

**DSQL Cluster** (`aurora_dsql.tf`):
```hcl
resource "aws_dsql_cluster" "media_downloader" {
  deletion_protection_enabled = var.dsql_deletion_protection
  tags = merge(local.common_tags, {
    Name = "${var.resource_prefix}-MediaDownloader-DSQL"
  })
}
```

**EventBridge** (`eventbridge.tf`):
```hcl
locals {
  event_bus_name = "${var.resource_prefix}-MediaDownloader"
}
```

**DynamoDB** (`dynamodb_idempotency.tf`):
```hcl
resource "aws_dynamodb_table" "IdempotencyTable" {
  name = "${var.resource_prefix}-MediaDownloader-Idempotency"
  # ...
}
```

**API Gateway** (`api_gateway.tf`):
```hcl
resource "aws_api_gateway_rest_api" "Main" {
  name = "${var.resource_prefix}-OfflineMediaDownloader"
  # ...
}

resource "aws_api_gateway_usage_plan" "iOSApp" {
  name = "${var.resource_prefix}-iOSApp"

  throttle_settings {
    burst_limit = var.api_throttle_burst_limit
    rate_limit  = var.api_throttle_rate_limit
  }

  quota_settings {
    limit  = var.api_quota_limit
    period = "DAY"
  }
  # ...
}
```

**SQS Queues** (`download_queue.tf`):
```hcl
resource "aws_sqs_queue" "DownloadQueue" {
  name = "${var.resource_prefix}-DownloadQueue"
  # ...
}

resource "aws_sqs_queue" "DownloadDLQ" {
  name = "${var.resource_prefix}-DownloadQueue-DLQ"
  # ...
}
```

**CloudWatch Alarms** (`cloudwatch.tf`):
```hcl
resource "aws_cloudwatch_metric_alarm" "LambdaErrorsApi" {
  count      = var.enable_cloudwatch_alarms ? 1 : 0
  alarm_name = "${var.resource_prefix}-MediaDownloader-Lambda-Errors-API"
  # ...
}
```

### Success Criteria

#### Automated Verification:
- [ ] `tofu validate` passes with new variables
- [ ] `tofu fmt -check` passes
- [ ] `tofu plan -var-file=environments/staging.tfvars` completes without errors
- [ ] `tofu plan -var-file=environments/production.tfvars` completes without errors

#### Manual Verification:
- [ ] Review all 23 modified .tf files for consistent naming pattern
- [ ] Verify no hardcoded "production" strings remain (except in tfvars)

---

## Phase 2: State Management and Workspace Configuration

### Overview
Configure OpenTofu workspaces with environment-specific state paths. This enables isolated state files while using a single S3 bucket.

### Changes Required

#### 2.1 Update Backend Configuration

**File**: `terraform/backend.tf`

```hcl
# Terraform Remote State Configuration
#
# State is stored in S3 with DynamoDB locking.
# Each environment (staging/production) uses a separate state file via workspace_key_prefix.
#
# State paths:
#   - staging:    s3://lifegames-media-downloader-tfstate/env:staging/terraform.tfstate
#   - production: s3://lifegames-media-downloader-tfstate/env:production/terraform.tfstate

terraform {
  backend "s3" {
    bucket               = "lifegames-media-downloader-tfstate"
    key                  = "terraform.tfstate"
    region               = "us-west-2"
    encrypt              = true
    dynamodb_table       = "MediaDownloader-TerraformStateLock"
    workspace_key_prefix = "env"
  }
}
```

#### 2.2 Create Workspace Initialization Script

**File**: `bin/init-workspaces.sh` (NEW)

```bash
#!/usr/bin/env bash
#
# Initialize OpenTofu workspaces for staging and production.
# Run once after backend.tf is updated.
#
# Usage:
#   ./bin/init-workspaces.sh

set -euo pipefail

cd "$(dirname "$0")/../terraform"

echo "Initializing OpenTofu backend..."
tofu init -reconfigure

echo ""
echo "Creating workspaces..."

# Create staging workspace if it doesn't exist
if ! tofu workspace list | grep -q "staging"; then
  tofu workspace new staging
  echo "Created workspace: staging"
else
  echo "Workspace exists: staging"
fi

# Create production workspace if it doesn't exist
if ! tofu workspace list | grep -q "production"; then
  tofu workspace new production
  echo "Created workspace: production"
else
  echo "Workspace exists: production"
fi

echo ""
echo "Available workspaces:"
tofu workspace list

echo ""
echo "Done! Use 'tofu workspace select <env>' to switch environments."
```

#### 2.3 Update Deployment Scripts

**File**: `bin/deploy-staging.sh` (NEW)

```bash
#!/usr/bin/env bash
#
# Deploy to staging environment.
#
# Usage:
#   ./bin/deploy-staging.sh [--plan-only]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${PROJECT_ROOT}/terraform"

# Verify workspace
CURRENT_WS=$(tofu workspace show)
if [[ "$CURRENT_WS" != "staging" ]]; then
  echo "Switching to staging workspace..."
  tofu workspace select staging
fi

# Load environment
set -a
source "${PROJECT_ROOT}/.env"
set +a

if [[ "${1:-}" == "--plan-only" ]]; then
  echo "Running plan for staging..."
  tofu plan -var-file=environments/staging.tfvars
else
  echo "Deploying to staging..."
  tofu apply -var-file=environments/staging.tfvars -auto-approve
fi
```

**File**: `bin/deploy-production.sh` (NEW)

```bash
#!/usr/bin/env bash
#
# Deploy to production environment.
# Requires explicit confirmation unless --auto-approve is passed.
#
# Usage:
#   ./bin/deploy-production.sh [--auto-approve]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${PROJECT_ROOT}/terraform"

# Verify workspace
CURRENT_WS=$(tofu workspace show)
if [[ "$CURRENT_WS" != "production" ]]; then
  echo "Switching to production workspace..."
  tofu workspace select production
fi

# Load environment
set -a
source "${PROJECT_ROOT}/.env"
set +a

echo "Running plan for production..."
tofu plan -var-file=environments/production.tfvars -out=tfplan

if [[ "${1:-}" == "--auto-approve" ]]; then
  echo "Applying to production..."
  tofu apply tfplan
else
  echo ""
  echo "Review the plan above. To apply, run:"
  echo "  cd terraform && tofu apply tfplan"
  echo ""
  echo "Or re-run with --auto-approve flag."
fi
```

### Success Criteria

#### Automated Verification:
- [ ] `./bin/init-workspaces.sh` creates both workspaces
- [ ] `tofu workspace list` shows `default`, `staging`, `production`
- [ ] S3 bucket shows `env:staging/` and `env:production/` prefixes after first deploy

#### Manual Verification:
- [ ] Verify state isolation by deploying different configs to each workspace

---

## Phase 3: Secrets Management (Environment-Specific SOPS)

### Overview
Split the single secrets file into environment-specific files with appropriate encryption keys.

### Changes Required

#### 3.1 Update SOPS Configuration

**File**: `.sops.yaml` (UPDATE)

```yaml
# SOPS configuration for environment-specific secrets
# Each environment can have different encryption keys if needed

creation_rules:
  - path_regex: secrets\.staging\.enc\.yaml$
    age: >-
      age1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

  - path_regex: secrets\.prod\.enc\.yaml$
    age: >-
      age1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

  # Legacy single file (for migration period)
  - path_regex: secrets\.enc\.yaml$
    age: >-
      age1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### 3.2 Create Environment-Specific Secrets

**File**: `secrets.staging.yaml` (NEW - to be encrypted)

```yaml
# Staging secrets - can use test/sandbox credentials
apns:
  staging:
    signingKey: "STAGING_SIGNING_KEY"
    team: "STAGING_TEAM"
    keyId: "STAGING_KEY_ID"
    defaultTopic: "com.app.staging"
    privateKey: |
      -----BEGIN PRIVATE KEY-----
      STAGING APNS PRIVATE KEY
      -----END PRIVATE KEY-----
    certificate: |
      -----BEGIN CERTIFICATE-----
      STAGING APNS CERTIFICATE
      -----END CERTIFICATE-----

platform:
  key: "staging-platform-key"

signInWithApple:
  config:
    clientId: "com.app.staging"
    teamId: "STAGING_TEAM"
    keyId: "STAGING_KEY"
    privateKey: |
      -----BEGIN PRIVATE KEY-----
      STAGING SIGN IN WITH APPLE KEY
      -----END PRIVATE KEY-----
```

**File**: `secrets.prod.yaml` (NEW - to be encrypted)

```yaml
# Production secrets - real credentials
# (Structure mirrors staging, with production values)
apns:
  staging:  # Note: key path stays same for Terraform compatibility
    signingKey: "PROD_SIGNING_KEY"
    team: "PROD_TEAM"
    keyId: "PROD_KEY_ID"
    defaultTopic: "com.app.production"
    privateKey: |
      -----BEGIN PRIVATE KEY-----
      PRODUCTION APNS PRIVATE KEY
      -----END PRIVATE KEY-----
    certificate: |
      -----BEGIN CERTIFICATE-----
      PRODUCTION APNS CERTIFICATE
      -----END CERTIFICATE-----

platform:
  key: "production-platform-key"

signInWithApple:
  config:
    clientId: "com.app.production"
    teamId: "PROD_TEAM"
    keyId: "PROD_KEY"
    privateKey: |
      -----BEGIN PRIVATE KEY-----
      PRODUCTION SIGN IN WITH APPLE KEY
      -----END PRIVATE KEY-----
```

#### 3.3 Update Terraform SOPS Data Source

**File**: `terraform/main.tf`

```hcl
# Read encrypted secrets based on environment
data "sops_file" "secrets" {
  source_file = "../secrets.${var.environment == "staging" ? "staging" : "prod"}.enc.yaml"
}
```

#### 3.4 Update Encryption Script

**File**: `bin/build-dependencies.sh` (UPDATE Phase 6)

Add logic to encrypt both secrets files:

```bash
# Phase 6: Secrets Encryption
encrypt_secrets() {
  for env in staging prod; do
    SECRETS_FILE="${PROJECT_ROOT}/secrets.${env}.yaml"
    ENCRYPTED_FILE="${PROJECT_ROOT}/secrets.${env}.enc.yaml"

    if [[ -f "$SECRETS_FILE" ]]; then
      # Check if encryption needed
      if should_encrypt "$SECRETS_FILE" "$ENCRYPTED_FILE"; then
        echo "Encrypting secrets.${env}.yaml..."
        sops --encrypt "$SECRETS_FILE" > "$ENCRYPTED_FILE"
      fi
    fi
  done
}
```

### Success Criteria

#### Automated Verification:
- [ ] `sops --decrypt secrets.staging.enc.yaml` succeeds
- [ ] `sops --decrypt secrets.prod.enc.yaml` succeeds
- [ ] `tofu plan` with staging.tfvars reads staging secrets
- [ ] `tofu plan` with production.tfvars reads production secrets

#### Manual Verification:
- [ ] Verify staging secrets contain non-production values
- [ ] Verify production secrets are properly protected

---

## Phase 4: CI/CD Pipeline Implementation

### Overview
Implement GitHub Actions workflow for automated production deployment with OIDC authentication. Staging is deployed locally by agents; production deploys automatically on merge to main with no manual approval gate.

### Deployment Model
- **Staging**: Local agents deploy directly via `pnpm run deploy:staging`
- **Production**: GitHub Actions auto-deploys on merge to main (no manual approval)

### Naming Convention Reference
All IAM resources created in this phase follow `docs/wiki/Infrastructure/Resource-Naming.md`.

### Changes Required

#### 4.1 Create IAM OIDC Provider (Manual AWS Setup)

**Terraform Bootstrap Addition** (`terraform/bootstrap/main.tf`):

```hcl
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

# Staging deployment role - wider permissions for testing
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

# Production deployment role - restricted to main branch
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

# IAM policy for Terraform operations (attach to both roles)
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
        Resource = "arn:aws:lambda:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:function:*"
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
          "arn:aws:dynamodb:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:table/*-MediaDownloader-*"
        ]
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "staging_deploy" {
  role       = aws_iam_role.GitHubActionsStagingRole.name
  policy_arn = aws_iam_policy.terraform_deploy.arn
}

resource "aws_iam_role_policy_attachment" "production_deploy" {
  role       = aws_iam_role.GitHubActionsProductionRole.name
  policy_arn = aws_iam_policy.terraform_deploy.arn
}

output "GitHubActionsStagingRoleArn" {
  description = "ARN of the GitHub Actions staging deployment role"
  value       = aws_iam_role.GitHubActionsStagingRole.arn
}

output "GitHubActionsProductionRoleArn" {
  description = "ARN of the GitHub Actions production deployment role"
  value       = aws_iam_role.GitHubActionsProductionRole.arn
}
```

#### 4.2 Create Production Deployment Workflow

**File**: `.github/workflows/deploy-production.yml` (NEW)

This workflow automatically deploys to production on merge to main. No manual approval gate.

```yaml
name: Deploy to Production

on:
  push:
    branches: [master, main]
    paths:
      - 'terraform/**'
      - 'src/**'
      - 'package.json'
      - 'pnpm-lock.yaml'
  workflow_dispatch:
    inputs:
      confirm:
        description: 'Type "deploy" to confirm production deployment'
        required: true
        type: string

concurrency:
  group: deploy-production
  cancel-in-progress: false

env:
  AWS_REGION: us-west-2
  TOFU_VERSION: '1.8.0'

jobs:
  # ==========================================================================
  # Build & Test
  # ==========================================================================
  build:
    name: Build & Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: ./.github/actions/setup-node-pnpm

      - uses: ./.github/actions/setup-homebrew-tools

      - name: Build dependencies
        run: pnpm run build:dependencies

      - name: Build
        run: pnpm run build

      - name: Run unit tests
        run: pnpm test

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build-artifacts
          path: |
            build/
            terraform/*.tf
          retention-days: 1

  # ==========================================================================
  # Deploy Production (automatic on merge to main)
  # ==========================================================================
  deploy-production:
    name: Deploy Production
    needs: build
    runs-on: ubuntu-latest
    environment: production  # No approval required - auto-deploy
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4

      - name: Validate manual trigger
        if: github.event_name == 'workflow_dispatch'
        run: |
          if [ "${{ inputs.confirm }}" != "deploy" ]; then
            echo "::error::You must type 'deploy' to confirm production deployment"
            exit 1
          fi

      - name: Download build artifacts
        uses: actions/download-artifact@v4
        with:
          name: build-artifacts

      - name: Setup OpenTofu
        uses: opentofu/setup-opentofu@v1
        with:
          tofu_version: ${{ env.TOFU_VERSION }}

      - name: Configure AWS credentials (Production)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_PRODUCTION }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Decrypt production secrets
        run: |
          echo "${{ secrets.SOPS_AGE_KEY }}" > /tmp/age-key.txt
          export SOPS_AGE_KEY_FILE=/tmp/age-key.txt
          sops --decrypt secrets.prod.enc.yaml > secrets.prod.yaml

      - name: Deploy to Production
        working-directory: terraform
        run: |
          tofu init
          tofu workspace select production || tofu workspace new production
          tofu apply -var-file=environments/production.tfvars -auto-approve

      - name: Post deployment notification
        if: success()
        run: |
          echo "::notice::Production deployment successful! Commit: ${{ github.sha }}"
```

**Note**: Staging is deployed locally by agents using `pnpm run deploy:staging`. No GitHub Actions workflow for staging.

#### 4.3 Create Rollback Workflow

**File**: `.github/workflows/rollback.yml` (NEW)

```yaml
name: Rollback Deployment

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to rollback'
        required: true
        type: choice
        options:
          - staging
          - production
      commit_sha:
        description: 'Commit SHA to rollback to (leave empty for previous commit)'
        required: false
        type: string

env:
  AWS_REGION: us-west-2
  TOFU_VERSION: '1.8.0'

jobs:
  rollback:
    name: Rollback ${{ inputs.environment }}
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    permissions:
      id-token: write
      contents: read
    steps:
      - name: Determine rollback target
        id: target
        run: |
          if [ -n "${{ inputs.commit_sha }}" ]; then
            echo "sha=${{ inputs.commit_sha }}" >> $GITHUB_OUTPUT
          else
            echo "sha=${{ github.event.before }}" >> $GITHUB_OUTPUT
          fi

      - uses: actions/checkout@v4
        with:
          ref: ${{ steps.target.outputs.sha }}

      - uses: ./.github/actions/setup-node-pnpm

      - uses: ./.github/actions/setup-homebrew-tools

      - name: Build
        run: |
          pnpm run build:dependencies
          pnpm run build

      - name: Setup OpenTofu
        uses: opentofu/setup-opentofu@v1
        with:
          tofu_version: ${{ env.TOFU_VERSION }}

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ inputs.environment == 'production' && secrets.AWS_ROLE_PRODUCTION || secrets.AWS_ROLE_STAGING }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Decrypt secrets
        run: |
          echo "${{ secrets.SOPS_AGE_KEY }}" > /tmp/age-key.txt
          export SOPS_AGE_KEY_FILE=/tmp/age-key.txt
          ENV_SUFFIX=${{ inputs.environment == 'production' && 'prod' || 'staging' }}
          sops --decrypt secrets.${ENV_SUFFIX}.enc.yaml > secrets.${ENV_SUFFIX}.yaml

      - name: Rollback deployment
        working-directory: terraform
        run: |
          tofu init
          tofu workspace select ${{ inputs.environment }}

          ENV_FILE=${{ inputs.environment == 'production' && 'production' || 'staging' }}
          tofu apply -var-file=environments/${ENV_FILE}.tfvars -auto-approve

      - name: Post rollback notification
        run: |
          echo "::warning::Rolled back ${{ inputs.environment }} to commit ${{ steps.target.outputs.sha }}"
```

#### 4.4 Configure GitHub Environments

**Manual Steps** (in GitHub Repository Settings):

1. **Create `production` environment**:
   - **No protection rules** (automatic deployment on merge)
   - Add secret: `AWS_ROLE_PRODUCTION` = ARN from bootstrap output

2. **Add repository secrets**:
   - `SOPS_AGE_KEY` = Age private key for decryption
   - `AWS_ROLE_PRODUCTION` = Production IAM role ARN

**Note**: No `staging` GitHub environment needed - staging is deployed locally by agents.

### Success Criteria

#### Automated Verification:
- [ ] Workflow syntax validates: `act --list`
- [ ] OIDC provider created in AWS
- [ ] IAM roles have correct trust policies

#### Manual Verification:
- [ ] Local agents can deploy to staging via `pnpm run deploy:staging`
- [ ] Merge to main triggers automatic production deployment
- [ ] Rollback workflow successfully reverts changes

---

## Phase 5: Production Migration (Destroy and Recreate)

### Overview
Migrate existing production resources to the new naming convention. **We can destroy and recreate all AWS resources** - no complex state manipulation required.

### Migration Approach: Clean Slate

Since we can destroy and recreate all resources, the migration is simple:

1. Deploy staging environment first (validates the new Terraform)
2. Destroy old production resources
3. Deploy new production resources with `prod-*` prefix
4. Update iOS app configuration with new endpoints

### Pre-Migration Checklist

- [ ] Staging environment deployed and tested
- [ ] iOS app can be updated with new API endpoints
- [ ] Schedule maintenance window (1-2 hours)
- [ ] Notify stakeholders of planned downtime

### Migration Steps

```bash
# Step 1: Verify staging works
./bin/deploy-staging.sh
# Test staging endpoints manually

# Step 2: Destroy old production resources
cd terraform
tofu workspace select default  # or current production workspace
tofu destroy -auto-approve

# Step 3: Deploy new production
tofu workspace select production || tofu workspace new production
tofu apply -var-file=environments/production.tfvars -auto-approve

# Step 4: Verify new production
aws lambda list-functions | grep "prod-"
aws apigateway get-rest-apis | grep "prod-"
```

### Post-Migration

1. Update iOS app with new API Gateway/CloudFront endpoints
2. Delete old workspace: `tofu workspace delete default`
3. Update AGENTS.md with new resource names

### Rollback

If issues occur, redeploy from a previous commit:
```bash
git checkout <previous-commit>
pnpm run build:dependencies && pnpm run build
./bin/deploy-production.sh --auto-approve
```

### Success Criteria

#### Automated Verification:
- [ ] `tofu plan` shows no changes after deployment
- [ ] All Lambda functions respond to test invocations
- [ ] API Gateway returns expected responses

#### Manual Verification:
- [ ] iOS app successfully authenticates with new endpoints
- [ ] File downloads work end-to-end
- [ ] Push notifications delivered
- [ ] No errors in CloudWatch logs

---

## Phase 6: Monitoring and Observability

### Overview
Create environment-specific dashboards and alerts to monitor both staging and production independently.

### Changes Required

#### 6.1 Update CloudWatch Dashboard

**File**: `terraform/cloudwatch.tf` (UPDATE)

```hcl
# Environment-specific dashboard name
resource "aws_cloudwatch_dashboard" "MediaDownloader" {
  dashboard_name = "${var.resource_prefix}-MediaDownloader"

  dashboard_body = jsonencode({
    widgets = [
      # Update all widget queries to use prefixed resource names
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "Lambda Errors - ${var.environment}"
          region = data.aws_region.current.id
          metrics = [
            for lambda in local.lambda_functions : [
              "AWS/Lambda",
              "Errors",
              "FunctionName",
              "${var.resource_prefix}-${lambda}",
              { stat = "Sum", period = 300 }
            ]
          ]
        }
      }
      # ... more widgets
    ]
  })
}
```

#### 6.2 Environment-Specific Alarms

```hcl
# Only create alarms if enabled (disabled in staging for cost savings)
resource "aws_cloudwatch_metric_alarm" "LambdaErrorsApi" {
  count = var.enable_cloudwatch_alarms ? 1 : 0

  alarm_name          = "${var.resource_prefix}-Lambda-Errors-API"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = var.environment == "production" ? 5 : 20  # Higher threshold for staging

  dimensions = {
    FunctionName = "${var.resource_prefix}-RegisterUser"  # Example
  }

  alarm_actions = var.environment == "production" ? [aws_sns_topic.OperationsAlerts[0].arn] : []

  tags = local.common_tags
}

# SNS topic for alerts (only in production)
resource "aws_sns_topic" "OperationsAlerts" {
  count = var.enable_cloudwatch_alarms ? 1 : 0
  name  = "${var.resource_prefix}-operations-alerts"
  tags  = local.common_tags
}
```

#### 6.3 X-Ray Tracing Groups

```hcl
resource "aws_xray_group" "MediaDownloader" {
  group_name        = "${var.resource_prefix}-MediaDownloader"
  filter_expression = "service(id(name: \"${var.resource_prefix}-*\"))"
  tags              = local.common_tags
}
```

### Success Criteria

#### Automated Verification:
- [ ] Dashboard renders without errors in AWS Console
- [ ] X-Ray traces appear for both environments
- [ ] Alarms trigger correctly when thresholds exceeded

#### Manual Verification:
- [ ] Production alerts go to correct SNS topic
- [ ] Staging does not generate production alerts
- [ ] Dashboard shows correct environment data

---

## Phase 7: Cost Assessment and Optimization

### Overview

**TARGET: Both environments MUST run under $10/month TOTAL.**

Deep analysis of `thoughts/shared/plans/costs.pdf` (January 2026 AWS bill) reveals the actual cost drivers and optimization opportunities.

### Current Production Costs (January 2026 Actual)

**Source**: `thoughts/shared/plans/costs.pdf` - AWS Bill January 1-24, 2026

| Service | Monthly Cost | % of Total | Cost Driver |
|---------|-------------|------------|-------------|
| **CloudWatch** | **$4.21** | **70%** | Dashboard + Alarms |
| Route 53 | $1.50 | 25% | 3 Hosted Zones |
| Secrets Manager | $0.18 | 3% | ~0.5 secrets |
| S3 | $0.09 | 2% | ~3 GB storage |
| Lambda | $0.00 | 0% | Within free tier |
| API Gateway | $0.00 | 0% | Within free tier |
| Aurora DSQL | $0.00 | 0% | Within free tier |
| DynamoDB | $0.00 | 0% | Within free tier |
| CloudFront | $0.00 | 0% | Within free tier |
| SQS | $0.00 | 0% | Within free tier |
| SNS | $0.00 | 0% | Within free tier |
| EventBridge | $0.00 | 0% | Within free tier |
| X-Ray | $0.00 | 0% | Within free tier |
| **TOTAL** | **$5.98** | 100% | |

### CloudWatch Cost Deep Dive (THE MAIN COST DRIVER)

CloudWatch accounts for **70% of total costs**. Breaking it down:

| CloudWatch Component | Cost | Details |
|---------------------|------|---------|
| **Dashboard** | **$2.25** | 1 dashboard with >50 metrics @ $3/month (prorated) |
| **Alarms** | **$1.96** | ~20 alarms @ $0.10/alarm (first 10 free) |
| Log Ingestion | $0.00 | 0.027 GB (within 5GB free tier) |
| Log Storage | $0.00 | Within 5GB free tier |
| Metrics | $0.00 | First 10 metrics free |
| **Subtotal** | **$4.21** | |

**Alarm Breakdown** (from `terraform/cloudwatch.tf`):

| Alarm Resource | Metric Queries | Billed Alarms |
|---------------|----------------|---------------|
| LambdaErrorsApi | 10 (dynamic) | 10 |
| LambdaErrorsBackground | 8 (dynamic) | 8 |
| LambdaThrottlesApi | 10 (dynamic) | 0 (removed) |
| LambdaThrottlesBackground | 8 (dynamic) | 0 (removed) |
| SqsDlqMessages | 1 | 1 |
| SqsQueueAge | 1 | 0 (removed) |
| EventBridgeFailedInvocations | 1 | 0 (removed) |
| EventBridgeThrottled | 1 | 0 (removed) |
| YouTubeAuthFailureBotDetection | 1 | 0 (removed) |
| YouTubeAuthFailureCookieExpired | 1 | 0 (removed) |
| YouTubeAuthFailureRateLimited | 1 | 0 (removed) |
| ApiGateway5xxErrors | 1 | 1 |
| **Current Total** | ~44 | ~20 billed |

**Key Insight**: Metric-math alarms with `dynamic "metric_query"` blocks count each sub-metric toward the alarm limit.

### Route 53 Cost Analysis

| Component | Cost | Details |
|-----------|------|---------|
| Hosted Zones | $1.50 | 3 zones @ $0.50/zone |
| DNS Queries | $0.00 | 6,314 queries (within free tier) |

### Why Everything Else is Free

The production workload is **INCREDIBLY LIGHT**:

| Service | Usage | Free Tier Limit | Status |
|---------|-------|-----------------|--------|
| Lambda | 3,249 GB-seconds | 400,000 GB-seconds | 0.8% used |
| Lambda Requests | 1,399 requests | 1,000,000 requests | 0.1% used |
| API Gateway | 420 requests | 1,000,000 requests | 0.04% used |
| Aurora DSQL | 950 DPUs | 100,000 DPUs | 0.95% used |
| DynamoDB | 171 RCU/WCU | Millions free | ~0% used |
| CloudFront | 465 requests, 3 GB | 10M requests, 1 TB | ~0% used |
| SQS | 508k requests | 1,000,000 requests | 51% used |
| SNS | 1,281 requests | 1,000,000 requests | 0.1% used |
| EventBridge | 94 events | 1,000,000 events | 0.01% used |
| X-Ray | 884 traces | 100,000 traces | 0.9% used |

**Conclusion**: With this light load, adding a staging environment costs essentially **$0 in compute** - it's all about fixed costs (CloudWatch, Route 53).

---

### Cost Optimization Strategy

#### Optimization 1: Eliminate CloudWatch Dashboard (-$2.25/month)

**Current**: 1 dashboard with 16 widgets, >50 metrics = $3/month

**Action**: Delete the dashboard entirely.

**Rationale**:
- For light load, on-demand CloudWatch Console queries are sufficient
- AWS Console provides the same metrics without the dashboard cost
- CloudWatch Logs Insights can query logs when needed

**Terraform Change** (`terraform/cloudwatch.tf`):
```hcl
# REMOVE entirely - or make conditional
# resource "aws_cloudwatch_dashboard" "Main" { ... }

# OR add variable to disable:
variable "enable_cloudwatch_dashboard" {
  description = "Enable CloudWatch dashboard (costs $3/month)"
  type        = bool
  default     = false  # Disabled by default for cost savings
}

resource "aws_cloudwatch_dashboard" "Main" {
  count          = var.enable_cloudwatch_dashboard ? 1 : 0
  dashboard_name = "${var.resource_prefix}-MediaDownloader"
  # ...
}
```

#### Optimization 2: Reduce Alarms to ≤10 (-$1.96/month)

**Current**: ~20 billed alarms @ $0.10/alarm = $1.96/month

**Action**: Reduce to ≤10 alarms (first 10 are FREE).

**Keep (Critical - 3 alarms)**:
1. `ApiGateway5xxErrors` - API failures (1 metric)
2. `LambdaErrorsCombined` - Combined API + Background errors (1 metric with expression)
3. `SqsDlqMessages` - Dead letter queue (1 metric)

**Remove (Non-Critical for Light Load)**:
- All throttle alarms (light load = no throttles)
- Individual YouTube auth alarms (combine into one or use logs)
- EventBridge alarms (light load = no issues)
- SQS queue age alarm (DLQ alarm is sufficient)
- Separate API/Background error alarms (combine into one)

**Terraform Change** (`terraform/cloudwatch.tf`):
```hcl
# Replace 12 alarms with 3 critical alarms

# 1. Combined Lambda Errors (single alarm, single metric expression)
resource "aws_cloudwatch_metric_alarm" "LambdaErrorsCombined" {
  count               = var.enable_cloudwatch_alarms ? 1 : 0
  alarm_name          = "${var.resource_prefix}-Lambda-Errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  threshold           = 5
  alarm_description   = "Lambda errors across all functions"
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "errors"
    expression  = "SUM(METRICS())"
    label       = "Total Errors"
    return_data = true
  }

  metric_query {
    id = "m1"
    metric {
      metric_name = "Errors"
      namespace   = "AWS/Lambda"
      period      = 300
      stat        = "Sum"
    }
  }

  alarm_actions = var.enable_cloudwatch_alarms ? [aws_sns_topic.OperationsAlerts[0].arn] : []
  tags          = local.common_tags
}

# 2. API Gateway 5xx (keep as-is, 1 metric)
# 3. SQS DLQ (keep as-is, 1 metric)

# DELETE all other alarms
```

#### Optimization 3: Consolidate Route 53 Hosted Zones (-$0.50/month potential)

**Current**: 3 hosted zones @ $0.50 = $1.50/month

**Investigation Needed**: Determine if all 3 zones are required.
- If one zone can be eliminated: saves $0.50/month
- Both environments can share the same hosted zones

#### Optimization 4: Use SSM Parameter Store Instead of Secrets Manager (-$0.18/month potential)

**Current**: ~0.5 secrets @ $0.40/secret = $0.18/month

**Action**: Migrate non-sensitive config to SSM Parameter Store (free tier: 10,000 parameters).

**Note**: Keep truly sensitive values (API keys, certificates) in Secrets Manager.

---

### Projected Costs After Optimization

#### Single Environment (Production - Optimized)

| Service | Before | After | Savings |
|---------|--------|-------|---------|
| CloudWatch Dashboard | $2.25 | $0.00 | $2.25 |
| CloudWatch Alarms | $1.96 | $0.00 | $1.96 |
| Route 53 | $1.50 | $1.00 | $0.50 |
| Secrets Manager | $0.18 | $0.18 | $0.00 |
| S3 | $0.09 | $0.09 | $0.00 |
| Other | $0.00 | $0.00 | $0.00 |
| **TOTAL** | **$5.98** | **$1.27** | **$4.71** |

#### Two Environments (Optimized)

| Environment | Cost | Notes |
|-------------|------|-------|
| Production | $1.50 | Optimized CloudWatch, shared Route 53 |
| Staging | $0.50 | No dashboard, no alarms, shared Route 53 |
| **COMBINED TOTAL** | **$2.00/month** | |

**This is 80% under the $10/month target!**

---

### Changes Required

#### 1. Update `terraform/variables.tf`

```hcl
variable "enable_cloudwatch_dashboard" {
  description = "Enable CloudWatch dashboard (costs $3/month per environment)"
  type        = bool
  default     = false
}

variable "enable_cloudwatch_alarms" {
  description = "Enable CloudWatch alarms (first 10 free, then $0.10/alarm)"
  type        = bool
  default     = false
}
```

#### 2. Update `terraform/environments/staging.tfvars`

```hcl
# Cost optimizations - staging has no monitoring overhead
enable_cloudwatch_dashboard = false
enable_cloudwatch_alarms    = false
```

#### 3. Update `terraform/environments/production.tfvars`

```hcl
# Cost optimizations - minimal critical alarms only
enable_cloudwatch_dashboard = false  # Use AWS Console instead
enable_cloudwatch_alarms    = true   # Keep ≤10 critical alarms (free)
```

#### 4. Refactor `terraform/cloudwatch.tf`

1. Make dashboard conditional (disabled by default)
2. Reduce alarms from 12 to 3:
   - `LambdaErrorsCombined` (1 metric)
   - `ApiGateway5xxErrors` (1 metric)
   - `SqsDlqMessages` (1 metric)
3. Make all alarms conditional on `var.enable_cloudwatch_alarms`

### Success Criteria

#### Automated Verification:
- [ ] `tofu plan` shows dashboard removed (or conditional)
- [ ] `tofu plan` shows ≤10 alarms in production
- [ ] `tofu plan` shows 0 alarms in staging

#### Manual Verification:
- [ ] AWS Cost Explorer shows CloudWatch costs < $0.50/month
- [ ] Combined monthly bill < $10 for both environments
- [ ] Critical alerts (5xx errors, DLQ messages) still function

### Cost Monitoring

Add a monthly cost check to CI/CD:

```bash
# bin/check-costs.sh
#!/usr/bin/env bash
# Alert if monthly costs exceed $10

COST=$(aws ce get-cost-and-usage \
  --time-period Start=$(date -d "30 days ago" +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics "UnblendedCost" \
  --query 'ResultsByTime[0].Total.UnblendedCost.Amount' \
  --output text)

if (( $(echo "$COST > 10" | bc -l) )); then
  echo "WARNING: Monthly cost ($COST) exceeds $10 budget!"
  exit 1
fi
echo "Monthly cost: \$$COST (within budget)"
```

---

## Implementation Timeline

| Phase | Description | Estimated Effort | Dependencies |
|-------|-------------|-----------------|--------------|
| 1 | Terraform Refactoring | 2-3 days | None |
| 2 | State Management | 1 day | Phase 1 |
| 3 | Secrets Management | 1 day | Phase 1 |
| 4 | CI/CD Pipeline | 2-3 days | Phases 1-3 |
| 5 | Production Migration | 1 day (plus maintenance window) | Phases 1-4 |
| 6 | Monitoring | 1 day | Phase 5 |
| 7 | Cost Optimization | 0.5 days | Phase 6 |

**Total: ~9-11 days of implementation work**

---

## References

- PR #242: `feature/terraform-env-restructure` (prior work)
- `thoughts/shared/plans/costs.pdf` (January 2026 AWS bill - cost analysis source)
- `thoughts/shared/plans/costs.csv` (historical cost data)
- `terraform/cloudwatch.tf` (CloudWatch dashboard and alarms - main cost driver)
- `docs/wiki/Infrastructure/Staging-Production-Strategy.md` (existing strategy doc)
- `docs/wiki/Infrastructure/OIDC-AWS-Authentication.md` (OIDC setup guide)
- `docs/wiki/Infrastructure/Resource-Naming.md` (naming conventions)
- `terraform/backend.tf` (current state configuration)
- `terraform/main.tf` (current infrastructure configuration)

---

## Appendix A: Critical Bugs to Fix During Implementation

### Bug 1: SNS Topic Reference Without Count Index

**Location**: Multiple files reference `aws_sns_topic.OperationsAlerts.arn` without `[0]`

Since `aws_sns_topic.OperationsAlerts` uses `count = var.enable_cloudwatch_alarms ? 1 : 0`, all references must use `[0]` index:

**Files Affected**:
- `terraform/cloudwatch.tf` - Lines 496, 497, 534, 535, 572, 573, 610, 611, 633, 634, 656, 657, 685, 686, 709, 710, 738, 739, 763, 764, 787, 788, 815, 816
- `terraform/download_queue.tf` - Lines 79, 80

**Fix Pattern**:
```hcl
# BEFORE (buggy)
alarm_actions = [aws_sns_topic.OperationsAlerts.arn]

# AFTER (correct)
alarm_actions = var.enable_cloudwatch_alarms ? [aws_sns_topic.OperationsAlerts[0].arn] : []
```

### Bug 2: Alarms Not Conditional on `enable_cloudwatch_alarms`

**Problem**: CloudWatch alarms in `cloudwatch.tf` and `download_queue.tf` are always created regardless of `var.enable_cloudwatch_alarms`.

**Files Affected**:
- `terraform/cloudwatch.tf` - All alarm resources (12 alarms)
- `terraform/download_queue.tf` - `aws_cloudwatch_metric_alarm.DownloadDLQMessages`

**Fix Pattern**: Add `count` to each alarm:
```hcl
resource "aws_cloudwatch_metric_alarm" "LambdaErrorsApi" {
  count = var.enable_cloudwatch_alarms ? 1 : 0
  # ... rest of resource
}
```

---

## Appendix B: Complete File Inventory for Phase 1 Changes

All files requiring `${var.resource_prefix}` updates:

### Lambda Function Files (18 files)
| File | Current Name | Target Pattern |
|------|--------------|----------------|
| `register_user.tf` | `RegisterUser` | `${var.resource_prefix}-RegisterUser` |
| `login_user.tf` | `LoginUser` | `${var.resource_prefix}-LoginUser` |
| `logout_user.tf` | `LogoutUser` | `${var.resource_prefix}-LogoutUser` |
| `refresh_token.tf` | `RefreshToken` | `${var.resource_prefix}-RefreshToken` |
| `register_device.tf` | `RegisterDevice` | `${var.resource_prefix}-RegisterDevice` |
| `device_event.tf` | `DeviceEvent` | `${var.resource_prefix}-DeviceEvent` |
| `list_files.tf` | `ListFiles` | `${var.resource_prefix}-ListFiles` |
| `user_delete.tf` | `UserDelete` | `${var.resource_prefix}-UserDelete` |
| `user_subscribe.tf` | `UserSubscribe` | `${var.resource_prefix}-UserSubscribe` |
| `send_push_notification.tf` | `SendPushNotification` | `${var.resource_prefix}-SendPushNotification` |
| `feedly_webhook.tf` | `WebhookFeedly` | `${var.resource_prefix}-WebhookFeedly` |
| `cleanup_expired_records.tf` | `CleanupExpiredRecords` | `${var.resource_prefix}-CleanupExpiredRecords` |
| `prune_devices.tf` | `PruneDevices` | `${var.resource_prefix}-PruneDevices` |
| `migrate_dsql.tf` | `MigrateDSQL` | `${var.resource_prefix}-MigrateDSQL` |
| `api_gateway_authorizer.tf` | `ApiGatewayAuthorizer` | `${var.resource_prefix}-ApiGatewayAuthorizer` |
| `cloudfront_middleware.tf` | `CloudfrontMiddleware` | `${var.resource_prefix}-CloudfrontMiddleware` |
| `file_bucket.tf` | `S3ObjectCreated` | `${var.resource_prefix}-S3ObjectCreated` |
| `configuration_apns.tf` | `ConfigureAPNS` | `${var.resource_prefix}-ConfigureAPNS` (if exists) |

### Infrastructure Files (12 files)
| File | Resource | Current Name | Target Pattern |
|------|----------|--------------|----------------|
| `api_gateway.tf` | REST API | `OfflineMediaDownloader` | `${var.resource_prefix}-OfflineMediaDownloader` |
| `api_gateway.tf` | Usage Plan | `iOSApp` | `${var.resource_prefix}-iOSApp` |
| `api_gateway.tf` | API Key | `iOSAppKey` | `${var.resource_prefix}-iOSAppKey` |
| `aurora_dsql.tf` | DSQL Cluster | `MediaDownloader-DSQL` | `${var.resource_prefix}-MediaDownloader-DSQL` |
| `file_bucket.tf` | S3 Bucket | `lifegames-media-downloader-files` | `lifegames-${var.resource_prefix}-media-files` |
| `file_bucket.tf` | CloudFront OAC | `media-files-oac` | `${var.resource_prefix}-media-files-oac` |
| `eventbridge.tf` | Event Bus | `MediaDownloader` | `${var.resource_prefix}-MediaDownloader` |
| `eventbridge.tf` | Event Rule | `DownloadRequested` | `${var.resource_prefix}-DownloadRequested` |
| `dynamodb_idempotency.tf` | DynamoDB | `MediaDownloader-Idempotency` | `${var.resource_prefix}-MediaDownloader-Idempotency` |
| `download_queue.tf` | SQS Queue | `DownloadQueue` | `${var.resource_prefix}-DownloadQueue` |
| `download_queue.tf` | SQS DLQ | `DownloadQueue-DLQ` | `${var.resource_prefix}-DownloadQueue-DLQ` |
| `send_push_notification.tf` | SQS Queue | `SendPushNotification` | `${var.resource_prefix}-SendPushNotification` |
| `send_push_notification.tf` | SQS DLQ | `SendPushNotification-DLQ` | `${var.resource_prefix}-SendPushNotification-DLQ` |
| `cloudwatch.tf` | Dashboard | `MediaDownloader` | `${var.resource_prefix}-MediaDownloader` |

### IAM Resources (Update names for environment isolation)
| File | Resource Type | Current Pattern | Target Pattern |
|------|---------------|-----------------|----------------|
| Various | IAM Roles | `RegisterUser` | `${var.resource_prefix}-RegisterUser` |
| Various | IAM Policies | `RegisterUserLogging` | `${var.resource_prefix}-RegisterUserLogging` |
| `main.tf` | Common Policy | `CommonLambdaXRay` | `${var.resource_prefix}-CommonLambdaXRay` |
| `aurora_dsql.tf` | DSQL Policy | `LambdaDSQLConnect` | `${var.resource_prefix}-LambdaDSQLConnect` |

---

## Appendix C: Pre-Implementation Checklist

Before starting implementation, verify:

- [ ] PR #242 branch is accessible for reference
- [ ] AWS credentials have permission to create OIDC provider
- [ ] SOPS age key is available for secrets encryption
- [ ] GitHub repository settings allow environment creation
- [ ] No active production deployments in progress
- [ ] `tofu validate` passes on current main branch
- [ ] All unit tests pass: `pnpm test`
- [ ] All integration tests pass: `pnpm run test:integration`

---

## Appendix D: Rollback Procedures

### During Phase 1-3 (No Production Impact)
- Simply `git revert` the commits and re-apply

### During Phase 4 (CI/CD)
- Disable GitHub Actions workflows via repository settings
- Delete IAM OIDC provider and roles via AWS Console

### During Phase 5 (Migration)
```bash
# If new production fails, redeploy from last known good commit
git checkout <last-good-commit>
pnpm run build:dependencies && pnpm run build
cd terraform
tofu workspace select production
tofu apply -var-file=environments/production.tfvars -auto-approve
```

### After Phase 5 (Both Environments Running)
- For staging issues: `./bin/deploy-staging.sh` with previous commit
- For production issues: Trigger rollback workflow or `git revert` + merge to main
