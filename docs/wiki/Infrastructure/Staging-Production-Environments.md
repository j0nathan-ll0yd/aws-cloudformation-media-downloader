# Staging and Production Environments

This document describes the dual-environment architecture for the Media Downloader project, enabling safe testing of infrastructure and application changes before production deployment.

## Overview

The project uses two isolated environments:

| Environment | Prefix | Purpose | Deployment Method |
|-------------|--------|---------|-------------------|
| **Staging** | `stag-` | Development and testing | Local agents via `pnpm run deploy:staging` |
| **Production** | `prod-` | Live system | Automatic on merge to main |

## Architecture

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
        │ env/staging/      │           │ env/production/   │
        │ terraform.tfstate │           │ terraform.tfstate │
        └───────────────────┘           └───────────────────┘
```

## Resource Naming

All AWS resources follow the naming convention documented in [Resource-Naming.md](./Resource-Naming.md):

- **Pattern**: `${var.resource_prefix}-ResourceName`
- **Staging**: `stag-RegisterUser`, `stag-MediaDownloader`, etc.
- **Production**: `prod-RegisterUser`, `prod-MediaDownloader`, etc.

### Examples

| Resource Type | Staging Name | Production Name |
|--------------|--------------|-----------------|
| Lambda Function | `stag-RegisterUser` | `prod-RegisterUser` |
| S3 Bucket | `lifegames-stag-media-files` | `lifegames-prod-media-files` |
| DSQL Cluster | `stag-MediaDownloader-DSQL` | `prod-MediaDownloader-DSQL` |
| API Gateway | `stag-OfflineMediaDownloader` | `prod-OfflineMediaDownloader` |
| SQS Queue | `stag-SendPushNotification` | `prod-SendPushNotification` |

## State Management

OpenTofu workspaces provide isolated state files:

```
s3://lifegames-media-downloader-tfstate/
├── env/staging/terraform.tfstate
├── env/production/terraform.tfstate
└── bootstrap/terraform.tfstate
```

### Workspace Commands

```bash
# List workspaces
tofu workspace list

# Switch to staging
tofu workspace select staging

# Switch to production
tofu workspace select production
```

## Environment Configuration

Each environment has a `.tfvars` file in `terraform/environments/`:

### Staging (`staging.tfvars`)

```hcl
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
```

### Production (`production.tfvars`)

```hcl
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
```

## Secrets Management

Environment-specific secrets are stored in SOPS-encrypted files:

| File | Purpose |
|------|---------|
| `secrets.staging.enc.yaml` | Staging credentials (sandbox/test values) |
| `secrets.prod.enc.yaml` | Production credentials (real values) |

Secrets are encrypted using SOPS with age keys. See the `.sops.yaml` configuration file for encryption rules.

## CI/CD Integration

### GitHub Actions OIDC

The project uses OIDC authentication for secure AWS access without long-lived credentials:

| Role | Purpose | Branch Restriction |
|------|---------|-------------------|
| `GitHubActions-MediaDownloader-Staging` | Staging deployments | Any branch |
| `GitHubActions-MediaDownloader-Production` | Production deployments | `master` only |

See [OIDC-AWS-Authentication.md](./OIDC-AWS-Authentication.md) for details.

### Deployment Triggers

- **Staging**: Local agents deploy directly using `pnpm run deploy:staging`
- **Production**: Automatic deployment on merge to `master` via GitHub Actions

## Cost Considerations

Both environments are designed to run under **$10/month combined**:

| Component | Staging | Production | Notes |
|-----------|---------|------------|-------|
| CloudWatch Dashboard | Disabled | Disabled | Use AWS Console instead |
| CloudWatch Alarms | Disabled | 3 critical only | First 10 free |
| Log Retention | 3 days | 7 days | Reduced storage costs |
| API Quotas | Reduced | Full | Staging uses less capacity |

See PR #370 for detailed cost analysis.

## Related Documentation

- [Environment-Deployment-Guide.md](./Environment-Deployment-Guide.md) - How to deploy
- [Resource-Naming.md](./Resource-Naming.md) - Naming conventions
- [OpenTofu-Patterns.md](./OpenTofu-Patterns.md) - Terraform/OpenTofu patterns
- [OIDC-AWS-Authentication.md](./OIDC-AWS-Authentication.md) - GitHub Actions authentication
