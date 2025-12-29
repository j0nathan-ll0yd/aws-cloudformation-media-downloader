# Claude Prompt: Terraform Environment Restructuring

## Context

You are working on the `aws-cloudformation-media-downloader` backend repository. This is an AWS serverless media downloader service built with OpenTofu (Terraform alternative) and TypeScript.

**Repository location:** `/Users/jlloyd/wt/research-2` (or the main worktree)

## Problem Statement

The terraform infrastructure has **ZERO environment separation**. Everything is hardcoded for production with no ability to deploy staging, development, or any other environment. This needs to be fixed to enable:

1. A staging environment for E2E testing and AWS Device Farm integration
2. Proper production environment isolation
3. Safe testing without affecting production

## Current State (Critical Findings)

### What's Wrong

| Issue | Location | Current Value |
|-------|----------|---------------|
| Hardcoded environment tag | `terraform/main.tf:37` | `Environment = "production"` |
| Hardcoded API stage | `terraform/api_gateway.tf:46` | `"prod"` |
| No variable definitions | `terraform/` | No `variables.tf` exists |
| No tfvars files | `terraform/` | Zero `.tfvars` files |
| Hardcoded S3 bucket | `terraform/file_bucket.tf:6` | `"lifegames-media-downloader-files"` |
| Hardcoded Lambda names | All lambda files | e.g., `"ListFiles"`, `"LoginUser"` |
| Single state file | `terraform/` | No workspace isolation |
| Hardcoded CloudWatch dashboard | `terraform/cloudwatch.tf:48` | `"MediaDownloader"` |

### Files That Need Updates

There are **25+ terraform files** that need environment variable support:

```
terraform/
├── main.tf                    # Provider, tags, locals
├── api_gateway.tf             # API name, stage name
├── lambdas.tf                 # 17 Lambda function definitions
├── file_bucket.tf             # S3 bucket name
├── cloudwatch.tf              # Dashboard name, alarms
├── sns.tf                     # Topic names
├── sqs.tf                     # Queue names
├── iam.tf                     # Role names, policy names
├── eventbridge.tf             # Rule names
├── aurora_dsql.tf             # Database cluster
└── ... (other resource files)
```

### Current Deployment Process

```json
// package.json
"plan": "eval export $(cat .env) && cd terraform && tofu plan",
"deploy": "./bin/pre-deploy-check.sh && eval export $(cat .env) && cd terraform && tofu apply -auto-approve"
```

- Uses `.env` file for secrets (SOPS encrypted)
- Single deployment target
- No workspace selection

## Requirements

### 1. Create Variables Infrastructure

**File:** `terraform/variables.tf`

Define variables for:
- `environment` (staging, production) with validation
- `resource_prefix` for naming all resources
- `api_domain_prefix` for API Gateway domain
- Any environment-specific sizing (Lambda memory, timeouts, etc.)

### 2. Create Environment tfvars Files

**Directory:** `terraform/environments/`

Create:
- `staging.tfvars` - Staging environment configuration
- `production.tfvars` - Production environment configuration

### 3. Update All Resource Naming

**Pattern:** `${var.resource_prefix}-{resource-name}`

Examples:
- Lambda: `ListFiles` → `${var.resource_prefix}-ListFiles`
- S3: Keep existing bucket (can't rename), but add environment tag
- API Gateway: `OfflineMediaDownloader` → `${var.resource_prefix}-api`
- CloudWatch: `MediaDownloader` → `${var.resource_prefix}-dashboard`

### 4. Add Workspace-Based Deployment

Create scripts:
- `bin/deploy-staging.sh` - Deploy to staging workspace
- `bin/deploy-production.sh` - Deploy to production workspace

Update `package.json`:
```json
"deploy:staging": "./bin/deploy-staging.sh",
"deploy:production": "./bin/deploy-production.sh",
"plan:staging": "...",
"plan:production": "..."
```

### 5. Handle Production Migration

**CRITICAL:** Production resources already exist. You must:
1. Use `terraform state mv` commands to rename resources in state without recreating
2. Keep the existing S3 bucket name (S3 buckets cannot be renamed)
3. Ensure zero downtime during migration

## Constraints

1. **OpenTofu, not Terraform** - Use `tofu` commands, not `terraform`
2. **Existing production** - Cannot destroy/recreate production resources
3. **S3 bucket limitation** - S3 buckets cannot be renamed; keep existing name, just add tags
4. **Lambda names affect API Gateway** - Lambda permission ARNs depend on function names
5. **State management** - Use workspaces for environment isolation

## Deliverables

1. `terraform/variables.tf` - Variable definitions
2. `terraform/environments/staging.tfvars` - Staging config
3. `terraform/environments/production.tfvars` - Production config
4. `bin/deploy-staging.sh` - Staging deployment script
5. `bin/deploy-production.sh` - Production deployment script
6. Updated terraform files with variable interpolation
7. Migration plan document for existing production resources
8. Updated `package.json` with new scripts

## Success Criteria

- [ ] `tofu workspace list` shows staging and production workspaces
- [ ] `tofu plan -var-file=environments/staging.tfvars` shows new staging resources
- [ ] `tofu plan -var-file=environments/production.tfvars` shows no changes to existing prod
- [ ] Staging deployment creates isolated resources with `-staging` suffix
- [ ] Production resources remain unchanged (or renamed in place without recreation)

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Production downtime | Use `terraform state mv` to rename without recreating |
| S3 data loss | Keep existing bucket name, only add environment tag |
| Lambda invocation failures | Update API Gateway integrations atomically |
| State corruption | Backup state before migration |

## Getting Started

1. Read `terraform/main.tf` to understand current provider setup
2. List all `.tf` files: `ls terraform/*.tf`
3. Search for hardcoded names: `grep -r "production\|ListFiles\|MediaDownloader" terraform/`
4. Create `terraform/variables.tf` first
5. Update `terraform/main.tf` to use variables
6. Proceed file by file, testing with `tofu plan` after each change

## Example Implementation

### variables.tf
```hcl
variable "environment" {
  type        = string
  description = "Environment name (staging, production)"
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be 'staging' or 'production'."
  }
}

variable "resource_prefix" {
  type        = string
  description = "Prefix for all resource names"
}
```

### staging.tfvars
```hcl
environment     = "staging"
resource_prefix = "omd-staging"
```

### Lambda name update (example)
```hcl
# Before
locals {
  lambda_name = "ListFiles"
}

# After
locals {
  lambda_name = "${var.resource_prefix}-ListFiles"
}
```

## Notes

- This is a prerequisite for AWS Device Farm integration
- The staging environment will be used for E2E testing
- iOS app repo (`ios-OfflineMediaDownloader`) will connect to staging API
- Cost estimate for staging: ~$15-50/month (API Gateway + Lambda + Aurora DSQL)
