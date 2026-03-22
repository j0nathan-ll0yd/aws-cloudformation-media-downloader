# OIDC AWS Authentication

## Overview

GitHub Actions authenticates to AWS using OIDC (OpenID Connect) instead of long-lived access keys. This is more secure and follows AWS best practices.

## Benefits

1. **No long-lived secrets**: Credentials are generated per-workflow run
2. **Automatic rotation**: No manual key rotation required
3. **Fine-grained access**: Can restrict by repository, branch, or environment
4. **Audit trail**: AWS CloudTrail logs show which workflow assumed the role

## Current State

The project uses OIDC-based deployments via GitHub Actions. Infrastructure is defined in `infra/bootstrap/main.tf`:

- **OIDC Provider**: `aws_iam_openid_connect_provider.GitHubActionsOIDC`
- **Staging Role**: `GitHubActions-MediaDownloader-Staging` (any branch)
- **Production Role**: `GitHubActions-MediaDownloader-Production` (restricted to `production` environment)
- **Deploy Policy**: `TerraformDeployPolicy` (shared by both roles)

## Architecture

### IAM Roles

| Role | Purpose | OIDC Subject Restriction |
|------|---------|--------------------------|
| `GitHubActions-MediaDownloader-Staging` | Staging deployments | `StringLike: repo:...:*` (any branch/environment) |
| `GitHubActions-MediaDownloader-Production` | Production deployments | `StringEquals: repo:...:environment:production` |

### OIDC Subject Claim Formats

When GitHub Actions requests an OIDC token, the `sub` claim format depends on whether the job declares a GitHub environment:

| Job Configuration | `sub` Claim Format | Example |
|-------------------|--------------------|---------|
| No `environment:` key | `repo:OWNER/REPO:ref:refs/heads/BRANCH` | `repo:j0nathan-ll0yd/aws-cloudformation-media-downloader:ref:refs/heads/master` |
| With `environment: production` | `repo:OWNER/REPO:environment:ENVNAME` | `repo:j0nathan-ll0yd/aws-cloudformation-media-downloader:environment:production` |

**Important**: These formats are mutually exclusive. When a job uses `environment:`, the `sub` claim always uses the `environment:` format, never `ref:`.

### Trust Policy Examples

#### Environment-based restriction (production role)

Used when the workflow declares `environment: production`:

```json
{
  "Condition": {
    "StringEquals": {
      "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
      "token.actions.githubusercontent.com:sub": "repo:j0nathan-ll0yd/aws-cloudformation-media-downloader:environment:production"
    }
  }
}
```

**Security requirement**: The GitHub `production` environment must have deployment branch restrictions configured (Settings > Environments > production > Deployment branches > `master` only). Without this, any branch could use the `production` environment and assume the role.

#### Wildcard restriction (staging role)

Used when the role should be accessible from any branch or environment:

```json
{
  "Condition": {
    "StringEquals": {
      "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
    },
    "StringLike": {
      "token.actions.githubusercontent.com:sub": "repo:j0nathan-ll0yd/aws-cloudformation-media-downloader:*"
    }
  }
}
```

#### Branch-based restriction (not used in this project)

For workflows that do NOT use GitHub environments:

```json
{
  "Condition": {
    "StringEquals": {
      "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
      "token.actions.githubusercontent.com:sub": "repo:j0nathan-ll0yd/aws-cloudformation-media-downloader:ref:refs/heads/master"
    }
  }
}
```

**Note**: This does NOT work when the job declares `environment:`. The `sub` claim switches to environment format.

## Workflow Configuration

```yaml
permissions:
  id-token: write
  contents: read

steps:
  - name: Configure AWS credentials
    uses: aws-actions/configure-aws-credentials@v6
    with:
      role-to-assume: ${{ secrets.AWS_ROLE_PRODUCTION }}
      aws-region: us-west-2
```

## GitHub Secrets

| Secret | Purpose | Value |
|--------|---------|-------|
| `AWS_ROLE_PRODUCTION` | Production IAM role ARN | `arn:aws:iam::<ACCOUNT_ID>:role/GitHubActions-MediaDownloader-Production` |
| `AWS_ROLE_STAGING` | Staging IAM role ARN | `arn:aws:iam::<ACCOUNT_ID>:role/GitHubActions-MediaDownloader-Staging` |

Get the ARN values from:
```bash
cd infra/bootstrap
tofu output GitHubActionsProductionRoleArn
tofu output GitHubActionsStagingRoleArn
```

## Security Considerations

1. **Environment branch restrictions**: The `production` GitHub environment must restrict deployments to `master` to prevent any branch from assuming the production role
2. **Separate roles**: Staging and production use different IAM roles with different trust policies
3. **No long-lived keys**: OIDC tokens are short-lived and scoped to individual workflow runs
4. **Audit trail**: All role assumptions are logged in AWS CloudTrail

## Implementation Checklist

- [x] Create IAM OIDC Provider in AWS account
- [x] Create staging role (`GitHubActions-MediaDownloader-Staging`)
- [x] Create production role (`GitHubActions-MediaDownloader-Production`)
- [x] Configure trust policies with repository/environment constraints
- [x] Create deployment workflow with OIDC authentication (`deploy-production.yml`)
- [x] Configure GitHub environment branch restrictions
- [x] Create shared `TerraformDeployPolicy` for both roles
- [x] Document rollback procedures

## Troubleshooting

### "Request ARN is invalid"
The `AWS_ROLE_PRODUCTION` or `AWS_ROLE_STAGING` secret contains a malformed ARN. Re-set it from `tofu output`.

### "Could not assume role with OIDC"
Check the IAM trust policy `sub` condition matches the actual OIDC token format. Remember: `environment:` in the workflow changes the `sub` claim format.

### "Credentials could not be loaded"
The GitHub secret is empty or not configured. Set it via `gh secret set` or the GitHub UI.

## References

- [GitHub Docs: OIDC for AWS](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- [AWS Blog: GitHub Actions with OIDC](https://aws.amazon.com/blogs/security/use-iam-roles-to-connect-github-actions-to-actions-in-aws/)
- [AWS IAM OIDC Documentation](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc.html)
- [GitHub Docs: Environment deployment branches](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)
