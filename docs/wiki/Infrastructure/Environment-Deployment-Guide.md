# Environment Deployment Guide

This guide explains how to deploy to staging and production environments.

## Quick Reference

| Action | Command |
|--------|---------|
| Deploy to staging | `pnpm run deploy:staging` |
| Deploy to production | Merge PR to `master` (auto-deploys) |
| Plan staging changes | `pnpm run deploy:staging -- --plan-only` |
| Rollback production | `git revert` + merge to `master` |

## Prerequisites

Before deploying, ensure:

1. **AWS credentials configured** - Either via `~/.aws/credentials` or environment variables
2. **SOPS age key available** - Set `SOPS_AGE_KEY_FILE` environment variable
3. **Dependencies built** - Run `pnpm run build:dependencies && pnpm run build`

## Deploying to Staging

Staging is your development environment. Deploy freely to test changes.

### Using the Deploy Script

```bash
# Full deployment
pnpm run deploy:staging

# Plan only (see what would change)
pnpm run deploy:staging -- --plan-only
```

### Manual Deployment

```bash
cd terraform

# Select workspace
tofu workspace select staging

# Plan changes
tofu plan -var-file=environments/staging.tfvars

# Apply changes
tofu apply -var-file=environments/staging.tfvars
```

### What Happens

1. Switches to `staging` workspace
2. Decrypts `secrets.staging.enc.yaml`
3. Runs `tofu apply` with staging configuration
4. Creates/updates resources with `stag-` prefix

## Deploying to Production

Production deployments happen **automatically** when PRs are merged to `master`.

### Standard Workflow

1. Create a feature branch
2. Make changes and test in staging
3. Open a PR to `master`
4. Get approval and merge
5. GitHub Actions automatically deploys to production

### Manual Production Deployment (Emergency Only)

For emergency fixes when CI/CD is unavailable:

```bash
# CAUTION: Only use in emergencies
pnpm run deploy:production

# Or with auto-approve (dangerous)
pnpm run deploy:production -- --auto-approve
```

### What Happens (CI/CD)

1. GitHub Actions triggers on merge to `master`
2. Assumes `GitHubActions-MediaDownloader-Production` IAM role via OIDC
3. Decrypts `secrets.prod.enc.yaml`
4. Runs `tofu apply` with production configuration
5. Creates/updates resources with `prod-` prefix

## Verifying Deployments

### Check Resource Count

```bash
cd terraform

# Staging
tofu workspace select staging
tofu state list | wc -l

# Production
tofu workspace select production
tofu state list | wc -l
```

### Verify Lambda Functions

```bash
# Staging
aws lambda list-functions --query "Functions[?starts_with(FunctionName, 'stag-')].FunctionName" --output table

# Production
aws lambda list-functions --query "Functions[?starts_with(FunctionName, 'prod-')].FunctionName" --output table
```

### Check API Gateway

```bash
aws apigateway get-rest-apis --query "items[*].[name,id]" --output table
```

## Rollback Procedures

### Rollback Staging

```bash
# Option 1: Redeploy from previous commit
git checkout <previous-commit>
pnpm run build:dependencies && pnpm run build
pnpm run deploy:staging

# Option 2: Use OpenTofu directly
cd terraform
tofu workspace select staging
tofu apply -var-file=environments/staging.tfvars -target=<resource>
```

### Rollback Production

**Preferred Method**: Git revert

```bash
# Revert the problematic commit
git revert <commit-sha>
git push origin master

# GitHub Actions will auto-deploy the reverted state
```

**Alternative**: GitHub Actions Rollback Workflow

1. Go to Actions tab in GitHub
2. Select "Rollback Deployment" workflow
3. Enter environment (`production`) and optional commit SHA
4. Run workflow

### Manual Emergency Rollback

```bash
# CAUTION: Only use if CI/CD is unavailable
git checkout <known-good-commit>
pnpm run build:dependencies && pnpm run build
pnpm run deploy:production -- --auto-approve
```

## Workspace Management

### Initialize Workspaces (First Time)

```bash
./bin/init-workspaces.sh
```

This creates:
- `staging` workspace
- `production` workspace

### List Workspaces

```bash
cd terraform
tofu workspace list
```

### Switch Workspace

```bash
tofu workspace select staging
# or
tofu workspace select production
```

## Troubleshooting

### State Lock Error

```
Error: Error acquiring the state lock
```

**Solution**: Force unlock (only if you're sure no other deployment is running)

```bash
cd terraform
tofu force-unlock <lock-id>
```

### SOPS Decryption Failed

```
Error: Failed to decrypt secrets
```

**Solution**: Verify age key is available

```bash
export SOPS_AGE_KEY_FILE=~/.config/sops/age/keys.txt
sops --decrypt secrets.staging.enc.yaml > /dev/null
```

### Resource Already Exists

```
Error: EntityAlreadyExists
```

**Solution**: Resource naming collision. Ensure all resources use `${var.resource_prefix}-` prefix.

### OIDC Authentication Failed

```
Error: WebIdentityErr: failed to retrieve credentials
```

**Solutions**:
1. Verify GitHub Actions is running from correct branch
2. Check IAM role trust policy
3. Verify OIDC provider exists in AWS

## Environment-Specific Notes

### Staging

- **Log Level**: DEBUG (verbose logging)
- **Log Retention**: 3 days
- **API Quotas**: Reduced (1000/day)
- **Deletion Protection**: Disabled
- **CloudWatch Alarms**: Disabled

### Production

- **Log Level**: INFO
- **Log Retention**: 7 days
- **API Quotas**: Full (10000/day)
- **Deletion Protection**: Enabled
- **CloudWatch Alarms**: Enabled (3 critical alarms)

## Related Documentation

- [Staging-Production-Environments.md](./Staging-Production-Environments.md) - Architecture overview
- [OpenTofu-Patterns.md](./OpenTofu-Patterns.md) - Terraform patterns
- [OIDC-AWS-Authentication.md](./OIDC-AWS-Authentication.md) - GitHub Actions auth
- [Drift-Prevention.md](./Drift-Prevention.md) - Preventing configuration drift
