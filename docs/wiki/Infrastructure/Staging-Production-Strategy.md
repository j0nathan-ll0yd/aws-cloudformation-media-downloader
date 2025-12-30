# Staging and Production Environment Setup Strategy

## 1. Executive Summary

This document outlines the strategy for establishing distinct Staging and Production environments for the `aws-cloudformation-media-downloader` repository. The goal is to enable safe testing of infrastructure and application changes in an isolated Staging environment before promoting them to Production, reducing the risk of "blast radius" incidents and ensuring business continuity.

**Key Recommendations:**
*   **Infrastructure as Code:** Adopt a "Hybrid" approach using Terraform/OpenTofu Workspaces for state isolation combined with environment-specific `.tfvars` files.
*   **Secrets Management:** Extend the existing SOPS configuration to support environment-specific secret files (`secrets.staging.enc.yaml`, `secrets.prod.enc.yaml`).
*   **CI/CD:** Implement a GitHub Actions pipeline that automates the `plan` and `apply` lifecycle, strictly gating Production deployments behind manual approvals and successful Staging deployments.
*   **Account Strategy:** Ideally, use separate AWS accounts for Staging and Production to enforce hard security boundaries. If a single account is used, strict naming conventions and tagging must be enforced.

## 2. Current State Assessment

*   **Infrastructure Tool:** OpenTofu (via `terraform` directory).
*   **State Management:** Currently implies a single state or local state usage (based on `terraform/main.tf` not showing a remote backend block explicitly in the snippet read, though it might be in `backend.tf` or implied).
*   **Secrets:** SOPS (`sops.yaml`, `secrets.enc.yaml`) is correctly integrated.
*   **Deployment:** Manual scripts (`npm run deploy`) using local `.env` files.
*   **Environment Awareness:** The `terraform/main.tf` currently hardcodes `Environment = "production"`, which indicates a single-environment setup.

## 3. Recommended Architecture

### 3.1. Infrastructure Structure

We recommend using **OpenTofu Workspaces** to manage the environments without duplicating the `.tf` code, as the infrastructure is expected to be nearly identical between Staging and Production.

**Proposed Directory/File Changes:**
```text
terraform/
├── main.tf             # Core logic (remains mostly as is)
├── variables.tf        # Define input variables (e.g., environment_name, instance_size)
├── backend.tf          # Configured for dynamic state paths or separate keys
├── environments/       # New directory for env-specific vars
│   ├── staging.tfvars  # e.g., environment="staging", log_level="DEBUG"
│   └── prod.tfvars     # e.g., environment="production", log_level="INFO"
```

### 3.2. Secrets Management (SOPS)

The current `secrets.enc.yaml` should be split or augmented.

**Strategy:**
1.  Create `secrets.staging.enc.yaml` and `secrets.prod.enc.yaml`.
2.  Update `terraform/main.tf` to select the secret file dynamically based on the workspace or an input variable.

```hcl
# Example Terraform modification
variable "environment" {
  description = "The environment name (staging, prod)"
  type        = string
}

data "sops_file" "secrets" {
  source_file = "../secrets.${var.environment}.enc.yaml"
}
```

### 3.3. AWS Account Strategy

**Best Practice:** Separate AWS Accounts.
*   **Staging Account:** Used for all `develop` branch deploys. Loose limits, cost-optimized (e.g., smaller instances, reduced retention).
*   **Production Account:** Used for `main` branch deploys. Strict IAM roles, high availability.

**Single Account Fallback:**
If separate accounts are not feasible immediately, we must use:
*   **Resource Naming Prefixes:** `${var.environment}-media-downloader-...`
*   **Tagging:** Enforce `Environment = var.environment` on ALL resources.

## 4. CI/CD Pipeline (GitHub Actions)

We will replace the manual `npm run deploy` scripts with an automated pipeline.

**Workflow Stages:**

1.  **Pull Request (CI):**
    *   Lint & Test (Code).
    *   `tofu fmt -check`.
    *   `tofu validate`.
    *   `tofu plan` (targeting Staging) -> Post plan as PR comment.

2.  **Merge to `main` (CD - Staging):**
    *   Trigger: Push to `main`.
    *   `tofu apply` using `staging.tfvars`.
    *   Run Integration Tests against Staging.

3.  **Promotion to Production (CD - Production):**
    *   Trigger: Manual Approval (GitHub Environment Gate) after Staging succeeds.
    *   `tofu apply` using `prod.tfvars`.

## 5. Implementation Plan

### Phase 1: Preparation (Local)
1.  **Refactor Terraform:**
    *   Extract hardcoded strings (like "production") into variables.
    *   Create `environments/staging.tfvars` and `environments/prod.tfvars`.
2.  **Update SOPS:**
    *   Create `secrets.staging.enc.yaml` (encrypted with Staging KMS/PGP).
    *   Create `secrets.prod.enc.yaml`.
3.  **Backend Config:** Ensure the backend (S3/DynamoDB) can handle multiple states (e.g., using `workspace_key_prefix` or distinct keys).

### Phase 2: Pipeline Creation
1.  Create `.github/workflows/deploy.yml`.
2.  Configure OIDC (OpenID Connect) in AWS to allow GitHub Actions to assume roles without long-lived keys.
3.  Create GitHub Environments (`staging`, `production`) with protection rules.

### Phase 3: Migration
1.  Import existing resources into the "production" workspace state to avoid recreation.
2.  Deploy the "staging" environment from scratch to verify the template.
3.  Switch deployment method to GitHub Actions.

## 6. Resources & References

*   **OpenTofu Best Practices:** [Env0 Guide](https://www.env0.com/blog/terraform-best-practices)
*   **GitHub Actions + Terraform:** [HashiCorp Setup Terraform](https://github.com/hashicorp/setup-terraform)
*   **SOPS Provider:** [carlpett/sops-provider](https://registry.terraform.io/providers/carlpett/sops/latest/docs)
