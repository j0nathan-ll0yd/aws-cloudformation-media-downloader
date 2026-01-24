# Staging/Production Environment Implementation Plan

## Overview

This plan implements a complete staging and production environment separation for the media-downloader infrastructure. Building on the remote state backend (S3 + DynamoDB locking) already in place, we will use OpenTofu workspaces with environment-specific tfvars files to maintain isolated, identically-configured environments.

**Key Design Decisions:**
- **Workspaces over separate state files**: Single codebase, workspace-based isolation
- **Resource prefix naming**: `stag-*` and `prod-*` for all resources
- **Separate DSQL clusters**: Complete data isolation between environments
- **CI/CD integration**: Local deploys to staging, PR merge triggers production

## Current State Analysis

### What Exists Now

| Component | Current State | Notes |
|-----------|--------------|-------|
| **Terraform Backend** | S3 + DynamoDB | `lifegames-media-downloader-tfstate` bucket, single state key |
| **Variables** | `terraform/variables.tf` | Environment, resource_prefix, log settings defined |
| **Tfvars Files** | `environments/staging.tfvars`, `environments/production.tfvars` | Already created with appropriate settings |
| **Resource Naming** | Hardcoded names | Most resources use static names like `MediaDownloader`, `OfflineMediaDownloader` |
| **DSQL Cluster** | Single cluster | `aws_dsql_cluster.media_downloader` |
| **S3 Bucket** | Single bucket | `lifegames-media-downloader-files` |
| **API Gateway** | Single API | `OfflineMediaDownloader` with `prod` stage |
| **CloudFront** | Two distributions | `Production` (API), `MediaFiles` (S3) |
| **EventBridge** | Single bus | `MediaDownloader` |

### PR #242 Prior Work

PR #242 (`feature/terraform-env-restructure`) already implemented:
- Deployment scripts: `bin/deploy-stag.sh`, `bin/deploy-prod.sh`, `bin/plan-stag.sh`, `bin/plan-prod.sh`
- Resource naming updates across 23 `.tf` files using `${var.resource_prefix}-*`
- Variable definitions for `environment`, `resource_prefix`, `s3_bucket_name`

**Gap**: PR #242 used `local.name_prefix` but current master uses `var.resource_prefix`. We will align on `local.name_prefix` for consistency.

## Desired End State

After implementation:

```
Staging Environment (workspace: staging)
├── DSQL Cluster: stag-MediaDownloader-DSQL
├── S3 Bucket: stag-lifegames-media-files
├── API Gateway: stag-OfflineMediaDownloader
│   └── Stage: stag
├── CloudFront: stag-Production, stag-MediaFiles
├── EventBridge: stag-MediaDownloader
├── Lambdas: stag-RegisterUser, stag-ListFiles, etc.
├── SQS Queues: stag-DownloadQueue, stag-SendPushNotification
├── CloudWatch: stag-MediaDownloader dashboard (disabled by default)
└── IAM Roles: stag-RegisterUser, stag-ListFiles, etc.

Production Environment (workspace: production)
├── DSQL Cluster: prod-MediaDownloader-DSQL
├── S3 Bucket: prod-lifegames-media-files
├── API Gateway: prod-OfflineMediaDownloader
│   └── Stage: prod
├── CloudFront: prod-Production, prod-MediaFiles
├── EventBridge: prod-MediaDownloader
├── Lambdas: prod-RegisterUser, prod-ListFiles, etc.
├── SQS Queues: prod-DownloadQueue, prod-SendPushNotification
├── CloudWatch: prod-MediaDownloader dashboard (disabled), alarms (enabled)
└── IAM Roles: prod-RegisterUser, prod-ListFiles, etc.
```

### Verification

```bash
# Verify staging deployment
tofu workspace select staging
tofu plan -var-file=environments/staging.tfvars  # Should show 0 changes

# Verify production deployment
tofu workspace select production
tofu plan -var-file=environments/production.tfvars  # Should show 0 changes

# Verify resource isolation
aws lambda list-functions | grep -E "^stag-|^prod-"
aws s3 ls | grep -E "stag-|prod-"
```

## What We're NOT Doing

1. **Blue/green deployments** - Out of scope for initial implementation
2. **Canary releases** - May add later based on needs
3. **Cross-account isolation** - Both environments in same AWS account
4. **Custom domains** - Using CloudFront default domains
5. **Separate secrets files** - Single `secrets.enc.yaml` with environment-aware access
6. **Database migrations per environment** - Schema managed separately

## Implementation Approach

We will use **OpenTofu workspaces** with a **single state backend** and **workspace-keyed state paths**:

```hcl
# backend.tf
terraform {
  backend "s3" {
    bucket         = "lifegames-media-downloader-tfstate"
    key            = "terraform.tfstate"  # Will become env:/staging/terraform.tfstate
    region         = "us-west-2"
    encrypt        = true
    dynamodb_table = "MediaDownloader-TerraformStateLock"
  }
}
```

When using workspaces, OpenTofu automatically prefixes the key with `env:/<workspace>/`.

---

## Phase 1: State Backend & Workspace Setup

### Overview
Configure the state backend for multi-workspace support and create the staging/production workspaces.

### Changes Required

#### 1. Update Backend Configuration
**File**: `terraform/backend.tf`
**Changes**: Add workspace_key_prefix for clarity (optional but recommended)

```hcl
terraform {
  backend "s3" {
    bucket         = "lifegames-media-downloader-tfstate"
    key            = "terraform.tfstate"
    region         = "us-west-2"
    encrypt        = true
    dynamodb_table = "MediaDownloader-TerraformStateLock"
    # Workspaces will create keys like: env:/staging/terraform.tfstate
  }
}
```

#### 2. Create Workspaces
```bash
cd terraform
tofu workspace new staging
tofu workspace new production
tofu workspace list
# Should show: default, staging, production
```

#### 3. Update main.tf Locals
**File**: `terraform/main.tf`
**Changes**: Ensure `name_prefix` uses the variable consistently

```hcl
locals {
  # Project name used for resource naming
  project_name = "media-downloader"

  # Environment-aware resource naming prefix
  # Examples: stag-RegisterUser, prod-RegisterUser
  name_prefix = var.resource_prefix

  # ... rest of locals unchanged
}
```

### Success Criteria

#### Automated Verification:
- [ ] `tofu workspace list` shows staging and production workspaces
- [ ] `tofu validate` passes
- [ ] `tofu init` completes without errors

#### Manual Verification:
- [ ] S3 bucket shows separate state paths for each workspace
- [ ] DynamoDB lock table entries are workspace-specific

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Resource Naming Standardization

### Overview
Update all resources to use the `${local.name_prefix}-` naming convention for environment isolation.

### Changes Required

#### 1. Aurora DSQL Cluster
**File**: `terraform/aurora_dsql.tf`
**Changes**: Add name prefix to cluster and policies

```hcl
resource "aws_dsql_cluster" "media_downloader" {
  deletion_protection_enabled = var.dsql_deletion_protection
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-MediaDownloader-DSQL"
  })
}

resource "aws_iam_policy" "LambdaDSQLConnect" {
  name        = "${local.name_prefix}-LambdaDSQLConnect"
  description = "Allows Lambda functions to connect to Aurora DSQL with per-Lambda PostgreSQL roles"
  policy      = data.aws_iam_policy_document.dsql_connect.json
  tags        = local.common_tags
}

resource "aws_iam_policy" "LambdaDSQLAdminConnect" {
  name        = "${local.name_prefix}-LambdaDSQLAdminConnect"
  description = "Allows Lambda functions admin access to Aurora DSQL (MigrateDSQL only)"
  policy      = data.aws_iam_policy_document.dsql_admin_connect.json
  tags        = local.common_tags
}
```

#### 2. S3 Bucket
**File**: `terraform/file_bucket.tf`
**Changes**: Use variable for bucket name

```hcl
resource "aws_s3_bucket" "Files" {
  bucket = "${local.name_prefix}-lifegames-media-files"
  tags   = local.common_tags
}

resource "aws_cloudfront_origin_access_control" "MediaFilesOAC" {
  name                              = "${local.name_prefix}-media-files-oac"
  description                       = "OAC for ${local.name_prefix} media files S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}
```

#### 3. API Gateway
**File**: `terraform/api_gateway.tf`
**Changes**: Prefix API name and related resources

```hcl
resource "aws_api_gateway_rest_api" "Main" {
  name           = "${local.name_prefix}-OfflineMediaDownloader"
  description    = "The API that supports the App (${var.environment})"
  api_key_source = "HEADER"

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = local.common_tags
}

resource "aws_api_gateway_stage" "Production" {
  stage_name    = var.resource_prefix  # "stag" or "prod"
  rest_api_id   = aws_api_gateway_rest_api.Main.id
  deployment_id = aws_api_gateway_deployment.Main.id

  xray_tracing_enabled = true
  tags                 = local.common_tags
}

resource "aws_api_gateway_usage_plan" "iOSApp" {
  name        = "${local.name_prefix}-iOSApp"
  description = "Internal consumption (${var.environment})"
  # ... rest unchanged
}

resource "aws_api_gateway_api_key" "iOSApp" {
  name        = "${local.name_prefix}-iOSAppKey"
  description = "The key for the iOS App (${var.environment})"
  enabled     = true
  tags        = local.common_tags
}

resource "aws_iam_role" "ApiGatewayCloudwatch" {
  name               = "${local.name_prefix}-ApiGatewayCloudwatch"
  assume_role_policy = data.aws_iam_policy_document.ApiGatewayCloudwatch.json
  tags               = local.common_tags
}
```

#### 4. EventBridge
**File**: `terraform/eventbridge.tf`
**Changes**: Prefix event bus and rules

```hcl
locals {
  event_bus_name = "${local.name_prefix}-MediaDownloader"
}

resource "aws_cloudwatch_event_bus" "MediaDownloader" {
  name = local.event_bus_name

  tags = merge(local.common_tags, {
    Description = "Event bus for ${var.environment} media-downloader domain events"
  })
}

resource "aws_cloudwatch_event_rule" "DownloadRequested" {
  name           = "${local.name_prefix}-DownloadRequested"
  event_bus_name = aws_cloudwatch_event_bus.MediaDownloader.name
  description    = "Route DownloadRequested events to download processing queue (${var.environment})"
  # ... rest unchanged
}
```

#### 5. CloudFront Distributions
**File**: `terraform/cloudfront_middleware.tf`
**Changes**: Prefix distribution and Lambda@Edge

```hcl
resource "aws_iam_role" "CloudfrontMiddleware" {
  name               = "${local.name_prefix}-CloudfrontMiddleware"
  assume_role_policy = data.aws_iam_policy_document.LamdbaEdgeAssumeRole.json
  tags               = local.common_tags
}

resource "aws_lambda_function" "CloudfrontMiddleware" {
  function_name = "${local.name_prefix}-CloudfrontMiddleware"
  # ... rest unchanged
}

resource "aws_cloudfront_distribution" "Production" {
  comment = "${local.name_prefix}-${aws_lambda_function.CloudfrontMiddleware.function_name}"
  # ... rest unchanged

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-Production"
  })
}
```

**File**: `terraform/file_bucket.tf`
**Changes**: Prefix MediaFiles distribution

```hcl
resource "aws_cloudfront_distribution" "MediaFiles" {
  # ... existing config ...

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-MediaFilesDistribution"
  })
}
```

#### 6. Lambda Functions (All 18 functions)
**Files**: All Lambda `.tf` files
**Pattern**: Update function_name and IAM role name

Example for `terraform/register_user.tf`:
```hcl
locals {
  register_user_function_name = "${local.name_prefix}-RegisterUser"
}

resource "aws_lambda_function" "RegisterUser" {
  function_name = local.register_user_function_name
  # ... rest unchanged
}

resource "aws_iam_role" "RegisterUser" {
  name               = local.register_user_function_name
  assume_role_policy = data.aws_iam_policy_document.LambdaAssumeRole.json
  tags               = local.common_tags
}

resource "aws_cloudwatch_log_group" "RegisterUser" {
  name              = "/aws/lambda/${local.register_user_function_name}"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}
```

**Lambda files to update:**
- `terraform/api_gateway_authorizer.tf`
- `terraform/cleanup_expired_records.tf`
- `terraform/cloudfront_middleware.tf`
- `terraform/device_event.tf`
- `terraform/download_queue.tf` (StartFileUpload)
- `terraform/feedly_webhook.tf`
- `terraform/file_bucket.tf` (S3ObjectCreated)
- `terraform/list_files.tf`
- `terraform/login_user.tf`
- `terraform/logout_user.tf`
- `terraform/migrate_dsql.tf`
- `terraform/prune_devices.tf`
- `terraform/refresh_token.tf`
- `terraform/register_device.tf`
- `terraform/register_user.tf`
- `terraform/send_push_notification.tf`
- `terraform/user_delete.tf`
- `terraform/user_subscribe.tf`

#### 7. SQS Queues
**File**: `terraform/download_queue.tf`
```hcl
resource "aws_sqs_queue" "DownloadQueue" {
  name = "${local.name_prefix}-DownloadQueue"
  # ... rest unchanged
}

resource "aws_sqs_queue" "DownloadDLQ" {
  name = "${local.name_prefix}-DownloadDLQ"
  # ... rest unchanged
}
```

**File**: `terraform/send_push_notification.tf`
```hcl
resource "aws_sqs_queue" "SendPushNotification" {
  name = "${local.name_prefix}-SendPushNotification"
  # ... rest unchanged
}

resource "aws_sqs_queue" "SendPushNotificationDLQ" {
  name = "${local.name_prefix}-SendPushNotificationDLQ"
  # ... rest unchanged
}
```

#### 8. DynamoDB Idempotency Table
**File**: `terraform/dynamodb_idempotency.tf`
```hcl
resource "aws_dynamodb_table" "Idempotency" {
  name = "${local.name_prefix}-Idempotency"
  # ... rest unchanged
}
```

#### 9. SNS Platform Application
**File**: `terraform/configuration_apns.tf`
```hcl
resource "aws_sns_platform_application" "APNS" {
  name = "${local.name_prefix}-MediaDownloaderAPNS"
  # ... rest unchanged
}
```

#### 10. CloudWatch Resources
**File**: `terraform/cloudwatch.tf`
**Changes**: Update dashboard name and alarm names

```hcl
resource "aws_cloudwatch_dashboard" "Main" {
  count          = var.enable_cloudwatch_dashboard ? 1 : 0
  dashboard_name = "${var.resource_prefix}-MediaDownloader"
  # Dashboard body needs metric function names updated to use prefixed names
  # ...
}

resource "aws_sns_topic" "OperationsAlerts" {
  count = var.enable_cloudwatch_alarms ? 1 : 0
  name  = "${var.resource_prefix}-${local.project_name}-operations-alerts"
  tags  = local.common_tags
}

# All alarm names should be prefixed:
resource "aws_cloudwatch_metric_alarm" "LambdaErrorsApi" {
  alarm_name = "${local.name_prefix}-Lambda-Errors-API"
  # ... metric queries need updated function names
}
```

#### 11. Common IAM Policy
**File**: `terraform/main.tf`
```hcl
resource "aws_iam_policy" "CommonLambdaXRay" {
  name        = "${local.name_prefix}-CommonLambdaXRay"
  description = "Allows Lambda functions to write X-Ray traces"
  policy      = data.aws_iam_policy_document.CommonLambdaXRay.json
  tags        = local.common_tags
}
```

### Success Criteria

#### Automated Verification:
- [ ] `tofu validate` passes
- [ ] `tofu plan -var-file=environments/staging.tfvars` shows expected resource creations
- [ ] All Lambda function names follow `${prefix}-FunctionName` pattern
- [ ] All IAM role names follow `${prefix}-RoleName` pattern

#### Manual Verification:
- [ ] Review plan output to ensure no unexpected resource recreations
- [ ] Verify CloudWatch dashboard metrics reference correct function names

**Implementation Note**: This is the largest phase. After completing and verifying, pause for review before migration.

---

## Phase 3: Deployment Scripts & CI/CD

### Overview
Create deployment scripts and GitHub Actions workflows for staging and production deployments.

### Changes Required

#### 1. Deployment Scripts
**File**: `bin/deploy-staging.sh` (new)
```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}/../terraform"

echo "Deploying to STAGING environment..."
echo ""

# Select or create workspace
tofu workspace select staging 2>/dev/null || tofu workspace new staging

# Run pre-deploy check
"${SCRIPT_DIR}/pre-deploy-check.sh" "$@"

# Apply with staging variables
tofu apply -var-file=environments/staging.tfvars "$@"

echo ""
echo "Staging deployment complete!"
```

**File**: `bin/deploy-production.sh` (new)
```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}/../terraform"

echo "Deploying to PRODUCTION environment..."
echo ""

# Require explicit confirmation for production
if [[ "${1:-}" != "--confirm" ]]; then
  echo "ERROR: Production deployment requires --confirm flag"
  echo "Usage: $0 --confirm"
  exit 1
fi
shift

# Select or create workspace
tofu workspace select production 2>/dev/null || tofu workspace new production

# Run pre-deploy check
"${SCRIPT_DIR}/pre-deploy-check.sh" "$@"

# Apply with production variables
tofu apply -var-file=environments/production.tfvars "$@"

echo ""
echo "Production deployment complete!"
```

**File**: `bin/plan-staging.sh` (new)
```bash
#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../terraform"
tofu workspace select staging 2>/dev/null || tofu workspace new staging
tofu plan -var-file=environments/staging.tfvars "$@"
```

**File**: `bin/plan-production.sh` (new)
```bash
#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../terraform"
tofu workspace select production 2>/dev/null || tofu workspace new production
tofu plan -var-file=environments/production.tfvars "$@"
```

#### 2. Update package.json Scripts
**File**: `package.json`
**Changes**: Add deployment scripts

```json
{
  "scripts": {
    "deploy:staging": "./bin/deploy-staging.sh",
    "deploy:production": "./bin/deploy-production.sh --confirm",
    "plan:staging": "./bin/plan-staging.sh",
    "plan:production": "./bin/plan-production.sh",
    "deploy": "echo 'Use deploy:staging or deploy:production'"
  }
}
```

#### 3. GitHub Actions: Deploy on PR Merge
**File**: `.github/workflows/deploy-production.yml` (new)
```yaml
name: Deploy to Production

on:
  push:
    branches: [master]
    paths:
      - 'terraform/**'
      - 'src/**'
      - 'build/**'

concurrency:
  group: deploy-production
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production

    steps:
      - name: Checkout code
        uses: actions/checkout@v6

      - uses: ./.github/actions/setup-node-pnpm

      - name: Setup OpenTofu
        uses: opentofu/setup-opentofu@v1
        with:
          tofu_version: 1.8.0

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-west-2

      - name: Build Lambdas
        run: pnpm run build

      - name: Initialize Terraform
        working-directory: terraform
        run: tofu init

      - name: Select Production Workspace
        working-directory: terraform
        run: tofu workspace select production || tofu workspace new production

      - name: Plan
        working-directory: terraform
        run: tofu plan -var-file=environments/production.tfvars -out=tfplan

      - name: Apply
        working-directory: terraform
        run: tofu apply -auto-approve tfplan

      - name: Post deployment summary
        run: |
          echo "## Production Deployment" >> "$GITHUB_STEP_SUMMARY"
          echo "" >> "$GITHUB_STEP_SUMMARY"
          echo "Deployed commit: ${{ github.sha }}" >> "$GITHUB_STEP_SUMMARY"
          echo "Triggered by: ${{ github.actor }}" >> "$GITHUB_STEP_SUMMARY"
```

#### 4. Update pre-deploy-check.sh for Workspaces
**File**: `bin/pre-deploy-check.sh`
**Changes**: Add workspace awareness

```bash
# Add after line 78:
# Get current workspace
CURRENT_WORKSPACE=$(tofu workspace show)
echo "  Current workspace: ${CURRENT_WORKSPACE}"

# Determine tfvars file based on workspace
case "${CURRENT_WORKSPACE}" in
  staging)
    TFVARS_FILE="environments/staging.tfvars"
    ;;
  production)
    TFVARS_FILE="environments/production.tfvars"
    ;;
  *)
    echo -e "${YELLOW}WARNING: Using default workspace, no tfvars file${NC}"
    TFVARS_FILE=""
    ;;
esac

# Update plan command to use tfvars:
if [[ -n "${TFVARS_FILE}" ]]; then
  PLAN_OUTPUT=$(tofu plan -var-file="${TFVARS_FILE}" -detailed-exitcode -input=false -no-color 2>&1)
else
  PLAN_OUTPUT=$(tofu plan -detailed-exitcode -input=false -no-color 2>&1)
fi
```

### Success Criteria

#### Automated Verification:
- [ ] `./bin/plan-staging.sh` runs successfully
- [ ] `./bin/plan-production.sh` runs successfully
- [ ] `shellcheck bin/deploy-*.sh bin/plan-*.sh` passes
- [ ] GitHub Actions workflow syntax is valid: `act -n` or manual review

#### Manual Verification:
- [ ] Staging deployment works from local machine
- [ ] Production deployment requires --confirm flag
- [ ] GitHub Actions workflow triggers on merge to master

---

## Phase 4: Secrets Management Per Environment

### Overview
Configure SOPS to support environment-specific secrets access patterns.

### Changes Required

#### 1. Update SOPS Configuration
**File**: `.sops.yaml`
**Changes**: Add environment-aware key patterns (if using different KMS keys per env)

```yaml
creation_rules:
  # Production secrets (default)
  - path_regex: secrets\.enc\.yaml$
    kms: arn:aws:kms:us-west-2:ACCOUNT_ID:key/KEY_ID

  # Staging-specific secrets (future use)
  - path_regex: secrets\.staging\.enc\.yaml$
    kms: arn:aws:kms:us-west-2:ACCOUNT_ID:key/KEY_ID
```

**Note**: For now, both environments share the same secrets file. Environment isolation happens at the Lambda environment variable level (different API keys, endpoints, etc.).

#### 2. Environment-Aware Secret Access in Terraform
**File**: `terraform/main.tf`
**Changes**: Secrets are already loaded; no changes needed if using same file

```hcl
# Existing - works for both environments
data "sops_file" "secrets" {
  source_file = "../secrets.enc.yaml"
}

# Access secrets in Lambda env vars - same secrets, different resource names
environment {
  variables = merge(local.common_lambda_env, {
    # Environment-specific config comes from tfvars
    # Shared secrets come from SOPS
    FEEDLY_WEBHOOK_SECRET = data.sops_file.secrets.data["FEEDLY_WEBHOOK_SECRET"]
  })
}
```

### Success Criteria

#### Automated Verification:
- [ ] `tofu plan` can decrypt secrets in both workspaces
- [ ] SOPS file validates: `sops -d secrets.enc.yaml > /dev/null`

#### Manual Verification:
- [ ] Secrets are accessible in both staging and production Lambdas

---

## Phase 5: Production Migration Strategy

### Overview
Migrate existing production resources to the new `prod-*` naming convention.

### Migration Options

#### Option A: Destroy and Recreate (Recommended for this project)

**Rationale**:
- Single-user iOS app with acceptable downtime
- Clean state, no rename complexity
- DSQL data can be backed up and restored
- S3 data can be copied between buckets

**Steps**:

1. **Backup existing data**
   ```bash
   # Backup S3 files
   aws s3 sync s3://lifegames-media-downloader-files ./backup/s3-files/

   # Export DSQL data (using pg_dump equivalent)
   # DSQL uses IAM auth, so use AWS CLI for credentials
   ```

2. **Deploy staging first** (validates the new configuration)
   ```bash
   tofu workspace select staging
   tofu apply -var-file=environments/staging.tfvars
   ```

3. **Test staging thoroughly**
   - Verify all Lambda functions
   - Test API Gateway endpoints
   - Verify DSQL connectivity
   - Test S3 uploads/downloads

4. **Schedule maintenance window**
   - Notify users of downtime
   - Estimate 30-60 minutes

5. **Destroy old production resources**
   ```bash
   # In default workspace with current state
   tofu workspace select default
   tofu destroy
   ```

6. **Deploy new production**
   ```bash
   tofu workspace select production
   tofu apply -var-file=environments/production.tfvars
   ```

7. **Restore data**
   ```bash
   # Copy S3 files to new bucket
   aws s3 sync ./backup/s3-files/ s3://prod-lifegames-media-files/

   # Run DSQL migrations
   pnpm run migrate:production

   # Restore DSQL data if needed
   ```

8. **Update iOS app configuration**
   - Update API Gateway URL
   - Update CloudFront domain
   - Release app update

#### Option B: State Manipulation (Complex, not recommended)

Using `tofu state mv` to rename resources in-place. This is error-prone and requires careful coordination.

### Rollback Procedure

If production deployment fails:

1. **Redeploy old configuration**
   ```bash
   git checkout <previous-commit>
   tofu workspace select default
   tofu apply
   ```

2. **Restore data from backup**
   ```bash
   aws s3 sync ./backup/s3-files/ s3://lifegames-media-downloader-files/
   ```

3. **Investigate and fix**
   - Review Terraform plan output
   - Check CloudWatch logs
   - Fix configuration issues

### Success Criteria

#### Automated Verification:
- [ ] `tofu workspace select production && tofu plan -var-file=environments/production.tfvars` shows 0 changes
- [ ] All integration tests pass against production
- [ ] `pnpm run test:integration` (with production env vars)

#### Manual Verification:
- [ ] iOS app connects successfully
- [ ] Files can be uploaded and downloaded
- [ ] Push notifications work
- [ ] All API endpoints respond correctly

---

## Phase 6: Monitoring & Alerting Per Environment

### Overview
Configure environment-specific monitoring with appropriate thresholds.

### Changes Required

#### 1. CloudWatch Dashboard Updates
**File**: `terraform/cloudwatch.tf`
**Changes**: Dashboard already uses `var.resource_prefix`, but metric queries need Lambda function name updates

```hcl
# Update all metric references to use prefixed function names
metrics = [
  for fn in local.lambda_functions :
  ["AWS/Lambda", "Invocations", "FunctionName", "${local.name_prefix}-${fn}"]
]
```

#### 2. Environment-Specific Alarm Thresholds
**File**: `terraform/variables.tf`
**Changes**: Add alarm threshold variables

```hcl
variable "alarm_lambda_error_threshold" {
  description = "Lambda error count threshold for alarms"
  type        = number
  default     = 5
}

variable "alarm_sqs_age_threshold" {
  description = "SQS message age threshold in seconds"
  type        = number
  default     = 3600
}
```

**File**: `terraform/environments/staging.tfvars`
```hcl
# Relaxed thresholds for staging (more tolerant of errors during testing)
alarm_lambda_error_threshold = 20
alarm_sqs_age_threshold      = 7200  # 2 hours
```

**File**: `terraform/environments/production.tfvars`
```hcl
# Strict thresholds for production
alarm_lambda_error_threshold = 5
alarm_sqs_age_threshold      = 3600  # 1 hour
```

### Success Criteria

#### Automated Verification:
- [ ] Dashboard shows correct function names per environment
- [ ] Alarms trigger at environment-specific thresholds

#### Manual Verification:
- [ ] CloudWatch console shows separate dashboards/alarms per environment
- [ ] Alarm notifications route to correct SNS topics

---

## Cost Analysis

### Current Monthly Cost (Estimated)
| Resource | Cost |
|----------|------|
| Lambda | ~$5 (within free tier mostly) |
| S3 | ~$2 (intelligent tiering) |
| DSQL | ~$10 (serverless, pay-per-use) |
| CloudFront | ~$1 |
| API Gateway | ~$1 |
| CloudWatch | ~$3 (if dashboard enabled) |
| **Total** | **~$20-25/month** |

### With Staging Environment
| Resource | Staging Cost | Production Cost |
|----------|-------------|-----------------|
| Lambda | ~$2 | ~$5 |
| S3 | ~$1 | ~$2 |
| DSQL | ~$5 | ~$10 |
| CloudFront | ~$0.50 | ~$1 |
| API Gateway | ~$0.50 | ~$1 |
| CloudWatch | $0 (disabled) | ~$1 (alarms only) |
| **Total** | **~$9/month** | **~$20/month** |
| **Combined** | | **~$29/month** |

### Cost Optimization Strategies

1. **Staging DSQL**: Consider destroying when not in use
   ```bash
   # Destroy staging to save ~$5/month when not needed
   tofu workspace select staging
   tofu destroy -target=aws_dsql_cluster.media_downloader
   ```

2. **Staging S3**: Use shorter lifecycle policies
   ```hcl
   # In staging.tfvars
   s3_lifecycle_expiration_days = 7  # Delete files after 7 days
   ```

3. **CloudWatch**: Keep dashboards disabled, use console on-demand

---

## Testing Strategy

### Unit Tests
- Existing tests remain unchanged
- Tests use mocked AWS services
- Run with: `pnpm run test:unit`

### Integration Tests
- Use LocalStack for local testing
- Tests create isolated resources per run
- Run with: `pnpm run test:integration`

### Staging Validation Tests
```bash
# After staging deployment, run:
pnpm run test:e2e:staging

# This should:
# 1. Hit staging API Gateway endpoints
# 2. Verify Lambda responses
# 3. Check DSQL connectivity
# 4. Test file upload/download flow
```

### Production Smoke Tests
```bash
# After production deployment, run:
pnpm run test:smoke:production

# Quick validation:
# 1. Health check endpoints
# 2. Authentication flow
# 3. Basic file operations
```

---

## References

- Original ticket: `ma-df0`
- PR #242: `feature/terraform-env-restructure`
- Terraform remote state PR: Recent commits in master
- OpenTofu workspaces: https://opentofu.org/docs/language/state/workspaces/
- AWS DSQL documentation: https://docs.aws.amazon.com/dsql/

---

## Appendix A: Complete File Change List

### New Files
- `bin/deploy-staging.sh`
- `bin/deploy-production.sh`
- `bin/plan-staging.sh`
- `bin/plan-production.sh`
- `.github/workflows/deploy-production.yml`

### Modified Files
| File | Changes |
|------|---------|
| `terraform/main.tf` | Add name_prefix usage, update CommonLambdaXRay |
| `terraform/aurora_dsql.tf` | Prefix cluster name, policies |
| `terraform/file_bucket.tf` | Prefix bucket, OAC, S3ObjectCreated |
| `terraform/api_gateway.tf` | Prefix API, stage, usage plan, keys |
| `terraform/eventbridge.tf` | Prefix bus, rules |
| `terraform/cloudfront_middleware.tf` | Prefix Lambda, distribution |
| `terraform/cloudwatch.tf` | Prefix dashboard, alarms, update metrics |
| `terraform/register_user.tf` | Prefix Lambda, role, log group |
| `terraform/login_user.tf` | Prefix Lambda, role, log group |
| `terraform/logout_user.tf` | Prefix Lambda, role, log group |
| `terraform/list_files.tf` | Prefix Lambda, role, log group |
| `terraform/register_device.tf` | Prefix Lambda, role, log group |
| `terraform/device_event.tf` | Prefix Lambda, role, log group |
| `terraform/refresh_token.tf` | Prefix Lambda, role, log group |
| `terraform/user_delete.tf` | Prefix Lambda, role, log group |
| `terraform/user_subscribe.tf` | Prefix Lambda, role, log group |
| `terraform/feedly_webhook.tf` | Prefix Lambda, role, log group |
| `terraform/download_queue.tf` | Prefix queues, StartFileUpload |
| `terraform/send_push_notification.tf` | Prefix queues, Lambda |
| `terraform/cleanup_expired_records.tf` | Prefix Lambda, role |
| `terraform/prune_devices.tf` | Prefix Lambda, role |
| `terraform/migrate_dsql.tf` | Prefix Lambda, role |
| `terraform/api_gateway_authorizer.tf` | Prefix authorizer Lambda |
| `terraform/dynamodb_idempotency.tf` | Prefix table |
| `terraform/configuration_apns.tf` | Prefix platform app |
| `terraform/dsql_permissions.tf` | Update for prefixed role names |
| `terraform/generated_service_permissions.tf` | Update for prefixed names |
| `bin/pre-deploy-check.sh` | Add workspace awareness |
| `package.json` | Add deployment scripts |

---

## Appendix B: Verification Checklist

### Pre-Migration
- [ ] All tests pass on master
- [ ] S3 data backed up
- [ ] DSQL data exported
- [ ] iOS app version noted
- [ ] Maintenance window scheduled

### Post-Staging Deployment
- [ ] `tofu plan` shows 0 changes
- [ ] All Lambda functions invoke successfully
- [ ] API Gateway returns expected responses
- [ ] DSQL queries execute correctly
- [ ] S3 operations work
- [ ] CloudWatch logs appear
- [ ] No errors in any log group

### Post-Production Migration
- [ ] `tofu plan` shows 0 changes
- [ ] iOS app connects successfully
- [ ] File upload flow works end-to-end
- [ ] Push notifications deliver
- [ ] All API endpoints respond correctly
- [ ] CloudWatch alarms configured
- [ ] SNS notifications work
- [ ] No errors in log groups for 24 hours
