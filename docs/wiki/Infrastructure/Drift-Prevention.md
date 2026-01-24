# Terraform State Drift Prevention

This document describes how to prevent, detect, and remediate Terraform state drift in the media-downloader project.

## What is State Drift?

State drift occurs when the actual AWS resources diverge from what Terraform expects (recorded in `terraform.tfstate`). This can cause:

- Duplicate resources created on subsequent applies
- `EntityAlreadyExists` errors during deployment
- Orphaned resources that incur unnecessary costs
- Configuration inconsistencies across environments

## Common Causes

| Cause | Prevention |
|-------|------------|
| Manual AWS Console changes | NEVER modify resources directly; always use Terraform |
| Partial apply failures | Always run `pnpm run state:verify` after deployments |
| Multiple concurrent deployments | DynamoDB locking prevents concurrent applies |
| State file corruption | State is remote (S3) with versioning; use AWS console to recover |
| Worktree state desync | Remote state ensures automatic sync; run `tofu init` if issues |

## Prevention Workflow

### 1. Always Use pnpm Scripts

**NEVER run `tofu apply` directly.** Always use the pnpm scripts which include drift detection:

```bash
# Recommended: Checks for drift before applying
pnpm run deploy

# Force apply (bypasses drift check - use sparingly)
pnpm run deploy:force

# Just check for drift without applying
pnpm run deploy:check

# View planned changes
pnpm run plan
```

### 2. Verify State After Deployment

```bash
pnpm run state:verify
```

This runs `tofu refresh` and `tofu plan` to ensure no unexpected changes.

### 3. Regular Audits

Run the AWS audit periodically to catch drift early:

```bash
pnpm run audit:aws
```

Or use the Claude command `/aws-audit` for an interactive workflow.

## Resource Tagging

All Terraform-managed resources should have the `ManagedBy = terraform` tag. This helps:

- Identify which resources are managed by Terraform vs. created manually
- The audit script filters resources by this tag
- Prevents accidental deletion of non-Terraform resources

Tags are applied via the `local.common_tags` block in `terraform/main.tf`:

```hcl
locals {
  common_tags = {
    ManagedBy   = "terraform"
    Project     = "media-downloader"
    Environment = "production"
  }
}
```

## Worktree Considerations

This project uses git worktrees for isolated development. Terraform state is stored in a **remote S3 backend** with DynamoDB locking:

| Component | Location |
|-----------|----------|
| State bucket | `s3://lifegames-media-downloader-tfstate` |
| Lock table | `MediaDownloader-TerraformStateLock` (DynamoDB) |
| Region | `us-west-2` |

**Important:**
- All worktrees share the same remote state (automatic via S3)
- DynamoDB locking prevents concurrent deployments
- Run `tofu init` in each worktree (done automatically by post-checkout hook)

## Drift Recovery Procedures

### Scenario 1: EntityAlreadyExists Errors

Resources exist in AWS but not in Terraform state.

**Solution:** Import the resources:

```bash
cd terraform
tofu import aws_lambda_function.FunctionName actual-function-name
tofu import aws_iam_role.RoleName actual-role-name
tofu import aws_iam_policy.PolicyName arn:aws:iam::ACCOUNT:policy/policy-name
```

### Scenario 2: Duplicate Resources

Multiple resources with similar names (for example, `ListFiles`, `ListFiles-1`).

**Solution:**
1. Identify which is the "real" one (in Terraform state)
2. Delete duplicates using AWS CLI:
   ```bash
   aws lambda delete-function --function-name ListFiles-1
   ```

### Scenario 3: Orphaned Resources

Resources in AWS that are no longer needed.

**Solution:** Use the audit command with `--prune`:

```bash
./bin/aws-audit.sh --prune
```

This will prompt for confirmation before deleting.

## Automated Detection

The project includes several automated checks:

### Pre-Deploy Check

`bin/pre-deploy-check.sh` runs automatically before `pnpm run deploy`:

- Verifies state file exists and is readable
- Runs `tofu plan -detailed-exitcode`
- Blocks deployment if drift is detected (exit code 2)

### Post-Deploy Verification

`bin/verify-state.sh` can be run after deployment:

- Counts resources in state
- Optionally refreshes state (`--refresh`)
- Runs plan to detect any drift

### AWS Audit

`bin/aws-audit.sh` provides comprehensive audit:

- Compares Terraform state with actual AWS resources
- Identifies orphaned, duplicate, and untagged resources
- Generates remediation commands
- Supports `--prune` for automatic cleanup

## Best Practices

1. **Plan Before Apply**: Always review `pnpm run plan` output before deploying
2. **One Deployer**: Only one person should deploy at a time
3. **Verify After Deploy**: Run `pnpm run state:verify` after each deployment
4. **Regular Audits**: Run `pnpm run audit:aws` weekly
5. **Tag Everything**: Ensure all new resources have `local.common_tags`
6. **Document Manual Changes**: If you MUST make AWS Console changes, document and import immediately

## Related Commands

| Command | Description |
|---------|-------------|
| `pnpm run plan` | Preview infrastructure changes |
| `pnpm run deploy` | Deploy with drift detection |
| `pnpm run deploy:force` | Deploy without drift detection |
| `pnpm run deploy:check` | Check for drift only |
| `pnpm run state:verify` | Verify state after deployment |
| `pnpm run audit:aws` | Full AWS resource audit |
| `/aws-audit` | Claude command for interactive audit |

## See Also

- [OpenTofu Patterns](./OpenTofu-Patterns.md) - Infrastructure coding standards
- [Git Workflow](../Conventions/Git-Workflow.md) - Worktree workflow documentation
