# OIDC AWS Authentication

## Overview

GitHub Actions can authenticate to AWS using OIDC (OpenID Connect) instead of long-lived access keys. This is more secure and follows AWS best practices.

## Benefits

1. **No long-lived secrets**: Credentials are generated per-workflow run
2. **Automatic rotation**: No manual key rotation required
3. **Fine-grained access**: Can restrict by repository, branch, or workflow
4. **Audit trail**: AWS CloudTrail logs show which workflow assumed the role

## Current State

The project currently uses manual deployments (`pnpm run deploy`). This document outlines the path to automated OIDC-based deployments.

## Prerequisites

1. AWS IAM OIDC Provider configured for GitHub Actions
2. IAM Role with trust policy for this repository
3. Workflow permissions configured

## Implementation Plan

### Step 1: Create IAM OIDC Provider

```bash
# Create the OIDC provider for GitHub Actions
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

### Step 2: Create IAM Role

#### Trust Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:j0nathan-ll0yd/aws-cloudformation-media-downloader:*"
        }
      }
    }
  ]
}
```

#### Permissions Policy

The role needs permissions for:
- OpenTofu state bucket access (S3)
- Lambda deployment
- API Gateway management
- DynamoDB/Aurora DSQL management
- SNS/SQS management
- CloudWatch logs

### Step 3: Workflow Configuration

```yaml
permissions:
  id-token: write
  contents: read

steps:
  - name: Configure AWS credentials
    uses: aws-actions/configure-aws-credentials@v4
    with:
      role-to-assume: arn:aws:iam::ACCOUNT_ID:role/GitHubActionsDeployRole
      aws-region: us-west-2
```

## Security Considerations

### Branch Protection

For production deployments, restrict the trust policy:

```json
{
  "StringEquals": {
    "token.actions.githubusercontent.com:sub": "repo:j0nathan-ll0yd/aws-cloudformation-media-downloader:ref:refs/heads/master"
  }
}
```

### Environment-Specific Roles

Consider separate roles for:
- **Development**: Wider permissions for testing
- **Production**: Restricted to specific workflows and branches

## Implementation Checklist

- [ ] Create IAM OIDC Provider in AWS account
- [ ] Create GitHubActionsDeployRole with appropriate permissions
- [ ] Configure trust policy with repository constraints
- [ ] Create deployment workflow with OIDC authentication
- [ ] Test with non-production resources first
- [ ] Update branch protection rules
- [ ] Document rollback procedures

## References

- [GitHub Docs: OIDC for AWS](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- [AWS Blog: GitHub Actions with OIDC](https://aws.amazon.com/blogs/security/use-iam-roles-to-connect-github-actions-to-actions-in-aws/)
- [AWS IAM OIDC Documentation](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc.html)
