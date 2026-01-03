# Environment Comparison

Compare configurations, versions, and infrastructure between environments.

## Quick Start

```bash
# Usage: /env-compare [source] [target]
# Example: /env-compare staging production
# Default: /env-compare (compares local to deployed)
```

## Workflow

### Step 1: Identify Environments

Parse environment parameters:
- **local**: Current worktree configuration
- **staging**: Staging AWS environment
- **production**: Production AWS environment

### Step 2: Compare Lambda Configurations

```
MCP Tool: query_lambda
Query: config
```

For each Lambda, compare:
- Memory allocation
- Timeout settings
- Environment variables (names only, not values)
- Runtime version

### Step 3: Compare Infrastructure

```
MCP Tool: query_infrastructure
Resource: all
Query: config
```

Compare:
- S3 bucket configurations
- API Gateway settings
- Database configuration

### Step 4: Compare Dependencies

```bash
# Local package versions
cat package.json | jq '.dependencies'

# Deployed Lambda versions
aws lambda get-function --function-name ListFiles \
  --query 'Configuration.Environment.Variables'
```

### Step 5: Generate Comparison Report

Present differences in structured format.

---

## Output Format

```markdown
## Environment Comparison: staging vs production

### Summary
- **Differences Found**: 5
- **Critical**: 1
- **Warning**: 2
- **Info**: 2

### Lambda Configuration Differences

| Lambda | Setting | Staging | Production | Status |
|--------|---------|---------|------------|--------|
| StartFileUpload | Memory | 512 MB | 1024 MB | WARN |
| WebhookFeedly | Timeout | 30s | 60s | INFO |
| ListFiles | Memory | 256 MB | 256 MB | OK |

### Environment Variable Differences

| Lambda | Variable | Staging | Production | Status |
|--------|----------|---------|------------|--------|
| All | LOG_LEVEL | debug | warn | INFO |
| LoginUser | AUTH_TIMEOUT | 300 | 600 | WARN |

### Infrastructure Differences

| Resource | Setting | Staging | Production | Status |
|----------|---------|---------|------------|--------|
| API Gateway | Throttle | 100/s | 1000/s | CRITICAL |
| S3 | Versioning | Disabled | Enabled | WARN |
| CloudFront | Cache TTL | 60s | 3600s | INFO |

### Database Schema

| Entity | Staging | Production | Status |
|--------|---------|------------|--------|
| Users | v2.3 | v2.3 | OK |
| Files | v1.5 | v1.5 | OK |
| Devices | v1.2 | v1.2 | OK |

### Dependency Versions

| Package | Local | Deployed | Status |
|---------|-------|----------|--------|
| @aws-sdk/client-s3 | 3.958.0 | 3.950.0 | WARN |
| drizzle-orm | 0.45.1 | 0.45.1 | OK |
| better-auth | 1.4.10 | 1.4.8 | WARN |

### Recommendations

1. **CRITICAL**: Align API Gateway throttle limits
   - Staging is too restrictive for load testing
   - Or production is too permissive

2. **WARNING**: Memory configuration drift
   - StartFileUpload: Consider 1024 MB for staging
   - Prevents "works in staging, fails in prod" issues

3. **INFO**: Log levels appropriate for environments
   - No action needed

### Actions Required

- [ ] Review API Gateway throttle differences
- [ ] Align Lambda memory configurations
- [ ] Update staging dependencies to match production
- [ ] Document intentional differences
```

---

## Human Checkpoints

1. **Review differences** - Confirm which are intentional vs drift
2. **Approve sync actions** - Before aligning configurations
3. **Validate after sync** - Confirm environments match

---

## Intentional Differences

Some differences are expected:

| Setting | Staging | Production | Reason |
|---------|---------|------------|--------|
| LOG_LEVEL | debug | warn | Debugging vs performance |
| Throttle | Lower | Higher | Cost vs capacity |
| Cache TTL | Short | Long | Testing vs optimization |

Document intentional differences in `terraform/environments/`.

---

## Sync Commands

To align environments:

### Sync Lambda Configuration

```bash
# Update staging to match production memory
cd terraform
tofu workspace select staging
tofu apply -var="list_files_memory=256"
```

### Sync Dependencies

```bash
# Update deployed Lambda
cd ~/wt/aws-cloudformation-media-downloader-staging
pnpm update
pnpm run build
pnpm run deploy
```

---

## Notes

- Run before deployments to catch drift
- Document intentional environment differences
- Use separate Terraform workspaces per environment
- Secrets are compared by presence, not value
