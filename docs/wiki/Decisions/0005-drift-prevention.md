# ADR-0005: Infrastructure Drift Prevention

## Status
Accepted

## Date
2025-12-25

## Context

Terraform/OpenTofu state drift has caused significant issues:

1. **EntityAlreadyExists Errors**: Resources exist in AWS but not in state, causing deployment failures
2. **Duplicate Resources**: Multiple resources with similar names (for example, `ListFiles`, `ListFiles-1`)
3. **Orphaned Resources**: Resources in AWS that are no longer managed, incurring unnecessary costs
4. **Configuration Inconsistencies**: Manual AWS Console changes not reflected in IaC

Root causes:
- Running `tofu apply` directly bypasses safety checks
- No pre-deploy drift detection
- Manual AWS Console modifications
- Multiple worktrees sharing state without coordination

## Decision

Implement mandatory drift prevention workflow with automated checks.

### Mandatory Workflow
1. **NEVER run `tofu apply` directly** - Always use `pnpm run deploy`
2. **Pre-deploy drift check** - `bin/pre-deploy-check.sh` runs automatically
3. **Post-deploy verification** - `pnpm run state:verify`
4. **Regular audits** - `pnpm run audit:aws` weekly

### Pre-Deploy Check Behavior
The script runs `tofu plan -detailed-exitcode`:
- Exit 0: No changes needed (proceed)
- Exit 1: Error (block deployment)
- Exit 2: Drift detected (block deployment)

### Resource Tagging
All resources must have `ManagedBy = terraform` tag via `local.common_tags`:

```hcl
locals {
  common_tags = {
    ManagedBy   = "terraform"
    Project     = "media-downloader"
    Environment = "production"
  }
}
```

### Worktree Coordination
- State files are symlinked from main repository
- Only one deployer at a time (no remote state locking)
- Post-checkout hook validates state file integrity

## Consequences

### Positive
- Drift detected before deployment, not after
- No more `EntityAlreadyExists` errors
- Orphaned resources identified via audit
- Clear remediation procedures documented
- Tag-based resource identification

### Negative
- Deployment is slightly slower (plan + apply)
- Cannot bypass check without explicit `deploy:force`
- Requires discipline to not use AWS Console
- Single deployer constraint

## Enforcement

| Method | Purpose |
|--------|---------|
| `pnpm run deploy` | Enforces pre-deploy check |
| `bin/pre-deploy-check.sh` | Blocks on drift (exit code 2) |
| MCP rule `drift-prevention` | Validates `pnpm deploy` usage |
| Post-checkout hook | Validates state file integrity |

## Related

- [Drift Prevention](../Infrastructure/Drift-Prevention.md) - Implementation guide
- [OpenTofu Patterns](../Infrastructure/OpenTofu-Patterns.md) - IaC standards
- [Git Workflow](../Conventions/Git-Workflow.md) - Worktree workflow
