# AWS Infrastructure Audit

Comprehensive audit of AWS resources comparing Terraform state against live AWS resources. Identifies orphaned, duplicate, and unmanaged resources.

## Quick Start

Run the automated audit script:

```bash
./bin/aws-audit.sh
```

Or with auto-pruning (will prompt for confirmation):

```bash
./bin/aws-audit.sh --prune
```

## Pre-flight Checks

Before running the audit, verify:

1. **AWS credentials are configured**:
```bash
aws sts get-caller-identity
```

2. **Terraform state is accessible**:
```bash
cd terraform && tofu state list | wc -l
```

3. **Check for obvious drift first**:
```bash
cd terraform && tofu plan -detailed-exitcode
```

## Manual Audit Steps

If you need more control than the automated script provides:

### Phase 1: Collect Terraform State

```bash
cd terraform
tofu state list | grep -E "^aws_" > /tmp/tf-resources.txt
echo "Resources in state: $(wc -l < /tmp/tf-resources.txt)"
```

### Phase 2: Collect AWS Resources

**Lambda Functions**:
```bash
aws lambda list-functions \
  --query 'Functions[*].[FunctionName,Tags.ManagedBy]' \
  --output table
```

**CloudFront Distributions**:
```bash
aws cloudfront list-distributions \
  --query 'DistributionList.Items[*].[Id,Comment,Status]' \
  --output table
```

**API Gateway REST APIs**:
```bash
aws apigateway get-rest-apis \
  --query 'items[*].[id,name]' \
  --output table
```

**DynamoDB Tables**:
```bash
aws dynamodb list-tables \
  --query 'TableNames' \
  --output table
```

**IAM Roles (project-related)**:
```bash
aws iam list-roles \
  --query 'Roles[?contains(RoleName,`ListFiles`) || contains(RoleName,`Login`) || contains(RoleName,`Register`)].[RoleName,CreateDate]' \
  --output table
```

**S3 Buckets**:
```bash
aws s3api list-buckets \
  --query 'Buckets[?contains(Name,`media-downloader`)].[Name,CreationDate]' \
  --output table
```

**SQS Queues**:
```bash
aws sqs list-queues --output table
```

**CloudWatch Log Groups**:
```bash
aws logs describe-log-groups \
  --log-group-name-prefix "/aws/lambda/" \
  --query 'logGroups[*].[logGroupName]' \
  --output table
```

### Phase 3: Identify Issues

For each resource type, compare:
1. Resources in Terraform state
2. Resources in AWS

**Issue Types**:
- **Orphaned**: In AWS but NOT in Terraform state (needs import or delete)
- **Duplicates**: Multiple resources with similar names (e.g., `ListFiles`, `ListFiles-1`)
- **Untagged**: Resources missing `ManagedBy = terraform` tag

### Phase 4: Remediation

**To import an orphaned resource** (add to Terraform state):
```bash
cd terraform
tofu import aws_lambda_function.<ResourceName> <function-name>
tofu import aws_iam_role.<ResourceName> <role-name>
tofu import aws_iam_policy.<ResourceName> arn:aws:iam::<account>:policy/<policy-name>
```

**To delete an orphaned resource** (remove from AWS):
```bash
aws lambda delete-function --function-name <function-name>
aws iam delete-role --role-name <role-name>  # Detach policies first!
aws iam delete-policy --policy-arn arn:aws:iam::<account>:policy/<policy-name>
```

**To delete a duplicate CloudFront distribution**:
```bash
# First disable it
aws cloudfront get-distribution-config --id <dist-id> > /tmp/cf-config.json
# Edit to set Enabled=false
aws cloudfront update-distribution --id <dist-id> --if-match <etag> --distribution-config file:///tmp/cf-config-disabled.json
# Wait for deployment, then delete
aws cloudfront delete-distribution --id <dist-id> --if-match <etag>
```

### Phase 5: Verification

After remediation:
```bash
cd terraform && tofu plan -detailed-exitcode
```

Expected output: "No changes. Your infrastructure matches the configuration."

## Safety Guidelines

1. **NEVER auto-delete** without confirmation - the `--prune` flag prompts before deleting
2. **Backup state** before imports:
   ```bash
   cp terraform/terraform.tfstate terraform/terraform.tfstate.backup
   ```
3. **Test imports** with `tofu plan` after each import
4. **Document deletions** in git commit message
5. **Skip resources without `ManagedBy` tag** - they may be created by other processes

## Common Scenarios

### Scenario 1: Resources exist in AWS but not in state

This happens when:
- Manual AWS Console changes
- Previous `tofu apply` partially failed
- State file corruption/loss

**Resolution**: Either import the resource or delete it from AWS.

### Scenario 2: Duplicate resources with numeric suffixes

Example: `ListFiles`, `ListFiles-1`, `ListFiles-2`

This happens when:
- Multiple `tofu apply` runs without state sync
- Terraform decided to replace a resource but only created, not destroyed

**Resolution**: Delete the duplicates (keep the one in Terraform state).

### Scenario 3: Drift detected but no orphans

This happens when:
- Configuration changed but not applied
- AWS auto-scaled or modified resources
- Terraform provider behavior changed

**Resolution**: Run `tofu apply` to reconcile.

## Automation

For regular audits, add to your CI/CD:

```yaml
# .github/workflows/aws-audit.yml
name: AWS Audit
on:
  schedule:
    - cron: '0 8 * * 1'  # Weekly Monday 8am
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: ./bin/aws-audit.sh
```

## MCP Tool Integration

Use MCP tools for enhanced audit capabilities:

### Query Infrastructure State

```
MCP Tool: query_infrastructure
Resource: all
Query: config
```

Returns configured AWS services with their dependencies.

### Validate Lambda Configurations

```
MCP Tool: query_lambda
Query: list
```

Cross-reference with live AWS Lambda list to identify discrepancies.

### Check Infrastructure Dependencies

```
MCP Tool: query_infrastructure
Resource: all
Query: dependencies
```

Understand service relationships before deleting orphaned resources.

---

## Human Checkpoints

1. **Review orphaned resources** - Before any deletion, present list for approval
2. **Confirm import vs delete decision** - For each orphaned resource
3. **Verify remediation** - After changes, confirm `tofu plan` shows no drift
4. **Approve prune operations** - Never auto-delete without explicit confirmation

---

## Structured Output Format

```markdown
## AWS Audit Report

### Summary
- **Terraform Resources**: [count]
- **AWS Resources**: [count]
- **Orphaned**: [count]
- **Duplicates**: [count]
- **Drift Detected**: [Yes/No]

### Orphaned Resources (CRITICAL)
| Resource Type | Resource Name | Action Recommended |
|---------------|---------------|-------------------|
| Lambda | OldFunction-1 | DELETE |
| IAM Role | LegacyRole | IMPORT |

### Duplicates (HIGH)
| Original | Duplicates | Action |
|----------|------------|--------|
| ListFiles | ListFiles-1, ListFiles-2 | DELETE duplicates |

### Drift (MEDIUM)
| Resource | Expected | Actual | Resolution |
|----------|----------|--------|------------|
| Lambda memory | 256 MB | 512 MB | Apply config |

### Recommended Actions
1. [ ] Delete orphaned resources: [list]
2. [ ] Import resources to state: [list]
3. [ ] Run `tofu apply` to fix drift
```

---

## Rollback & Recovery

### If Import Fails

```bash
# Restore state backup
cp terraform/terraform.tfstate.backup terraform/terraform.tfstate

# Re-sync state
cd terraform && tofu refresh
```

### If Accidental Deletion

1. Check AWS CloudTrail for resource ARN
2. Recreate resource via Terraform (add to config, apply)
3. Or restore from AWS backup if available

### State Recovery

```bash
# If state is corrupted
cd terraform
tofu state pull > /tmp/state-backup.json

# Remove corrupted resource
tofu state rm aws_lambda_function.CorruptedResource

# Re-import if needed
tofu import aws_lambda_function.ResourceName actual-function-name
```

---

## Notes

- Primary region: `us-west-2`
- Lambda@Edge functions are in `us-east-1`
- IAM is global (no region filter)
- Resource patterns are defined in `bin/aws-audit.sh` (adjust if naming conventions change)
