#!/usr/bin/env bash
#
# Unified deployment script with environment selection and resilience protocol
#
# Usage:
#   ./bin/deploy.sh staging              # Deploy to staging
#   ./bin/deploy.sh production           # Deploy to production (requires confirmation)
#   ./bin/deploy.sh production --auto-approve  # Auto-approve production deploy (CI/CD)
#
# Resilience Protocol:
#   - All deployments are logged to deployment-logs/
#   - Uncommitted changes block deployment (use --force to override)
#   - Failed deployments prompt for retry or rollback
#
# Environment Variables:
#   SKIP_TESTS=1    - Skip pre-deployment tests
#   FORCE_DEPLOY=1  - Allow deployment with uncommitted changes

set -euo pipefail

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Directory resolution
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_DIR="${PROJECT_ROOT}/deployment-logs"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

# Generate log filename with timestamp
generate_log_filename() {
  local env="$1"
  echo "${LOG_DIR}/deploy-${env}-$(date +%Y%m%d-%H%M%S).log"
}

# Check for uncommitted changes (Resilience Protocol)
check_uncommitted_changes() {
  if [[ -n "$(git status --porcelain)" ]]; then
    if [[ "${FORCE_DEPLOY:-}" == "1" ]]; then
      log_warn "Uncommitted changes detected but FORCE_DEPLOY=1, continuing..."
      return 0
    fi
    log_error "Uncommitted changes detected!"
    echo ""
    echo "Resilience Protocol requires all changes to be committed before deployment."
    echo "This ensures you can rollback to a known state if deployment fails."
    echo ""
    echo "Options:"
    echo "  1. Commit your changes: git add . && git commit -m 'pre-deployment commit'"
    echo "  2. Force deploy (not recommended): FORCE_DEPLOY=1 ./bin/deploy.sh $1"
    echo ""
    exit 1
  fi
  log_success "No uncommitted changes"
}

# Run pre-deployment tests
run_pre_deployment_tests() {
  if [[ "${SKIP_TESTS:-}" == "1" ]]; then
    log_warn "Skipping pre-deployment tests (SKIP_TESTS=1)"
    return 0
  fi

  log_info "Running pre-deployment checks..."

  # Type check and lint
  if ! pnpm run precheck; then
    log_error "Pre-check failed! Fix errors before deploying."
    exit 1
  fi

  # Unit tests
  if ! pnpm test; then
    log_error "Unit tests failed! Fix tests before deploying."
    exit 1
  fi

  log_success "Pre-deployment tests passed"
}

# Deploy to environment
deploy_to_environment() {
  local env="$1"
  local auto_approve="${2:-}"
  local log_file
  log_file=$(generate_log_filename "$env")

  log_info "Deploying to ${env}..."
  log_info "Log file: ${log_file}"

  cd "${PROJECT_ROOT}/terraform"

  # Initialize and select workspace
  tofu init -input=false
  tofu workspace select "$env" || tofu workspace new "$env"

  # Run plan
  log_info "Running terraform plan..."
  if ! tofu plan -var-file="environments/${env}.tfvars" -out=tfplan 2>&1 | tee -a "$log_file"; then
    log_error "Plan failed! Check ${log_file} for details."
    return 1
  fi

  # Apply (with or without auto-approve)
  if [[ "$auto_approve" == "--auto-approve" ]]; then
    log_info "Applying changes (auto-approved)..."
    if ! tofu apply tfplan 2>&1 | tee -a "$log_file"; then
      log_error "Apply failed! Check ${log_file} for details."
      handle_deployment_failure "$env" "$log_file"
      return 1
    fi
  else
    echo ""
    log_warn "Review the plan above. Press Enter to apply, or Ctrl+C to cancel."
    read -r
    if ! tofu apply tfplan 2>&1 | tee -a "$log_file"; then
      log_error "Apply failed! Check ${log_file} for details."
      handle_deployment_failure "$env" "$log_file"
      return 1
    fi
  fi

  # Cleanup
  rm -f tfplan

  log_success "Deployment to ${env} completed successfully!"
  log_info "Full log available at: ${log_file}"
}

# Handle deployment failure (Resilience Protocol)
handle_deployment_failure() {
  local env="$1"
  local log_file="$2"

  echo ""
  log_error "Deployment to ${env} failed!"
  echo ""
  echo "Resilience Protocol - Next Steps:"
  echo "  1. Review the error in: ${log_file}"
  echo "  2. Fix the issue in your code/terraform"
  echo "  3. Commit the fix: git add . && git commit -m 'fix: deployment issue'"
  echo "  4. Retry: ./bin/deploy.sh ${env}"
  echo ""
  echo "If you need to rollback:"
  echo "  git log --oneline -5  # Find last working commit"
  echo "  git checkout <commit> # Checkout that commit"
  echo "  ./bin/deploy.sh ${env} --auto-approve"
  echo ""
}

# Print usage
usage() {
  echo "Usage: $0 <environment> [--auto-approve]"
  echo ""
  echo "Environments:"
  echo "  staging     - Deploy to staging (safe for testing)"
  echo "  production  - Deploy to production (requires confirmation)"
  echo ""
  echo "Options:"
  echo "  --auto-approve  Skip confirmation prompt (for CI/CD)"
  echo ""
  echo "Environment Variables:"
  echo "  SKIP_TESTS=1    Skip pre-deployment tests"
  echo "  FORCE_DEPLOY=1  Allow deployment with uncommitted changes"
  echo ""
  echo "Examples:"
  echo "  $0 staging                        # Deploy to staging"
  echo "  $0 production                     # Deploy to production (with confirmation)"
  echo "  $0 production --auto-approve      # Deploy to production (auto-approve)"
  echo "  SKIP_TESTS=1 $0 staging           # Deploy to staging, skip tests"
}

# Main
main() {
  local environment="${1:-}"
  local auto_approve="${2:-}"

  # Validate environment argument
  if [[ -z "$environment" ]]; then
    usage
    exit 1
  fi

  if [[ "$environment" != "staging" && "$environment" != "production" ]]; then
    log_error "Invalid environment: ${environment}"
    echo "Valid environments: staging, production"
    exit 1
  fi

  echo ""
  echo "================================================"
  echo "  Deployment: ${environment}"
  echo "  Time: $(date)"
  echo "================================================"
  echo ""

  # Load environment variables from .env if exists
  if [[ -f "${PROJECT_ROOT}/.env" ]]; then
    set -a
    # shellcheck source=/dev/null
    source "${PROJECT_ROOT}/.env"
    set +a
    log_info "Loaded .env file"
  fi

  # Resilience Protocol checks
  check_uncommitted_changes "$environment"

  # Production safety check
  if [[ "$environment" == "production" && "$auto_approve" != "--auto-approve" ]]; then
    echo ""
    log_warn "You are about to deploy to PRODUCTION!"
    echo -n "Type 'production' to confirm: "
    read -r confirm
    if [[ "$confirm" != "production" ]]; then
      log_error "Deployment cancelled"
      exit 1
    fi
  fi

  # Run pre-deployment tests (skip for staging with SKIP_TESTS)
  if [[ "$environment" == "production" ]]; then
    run_pre_deployment_tests
  elif [[ "${SKIP_TESTS:-}" != "1" ]]; then
    run_pre_deployment_tests
  fi

  # Build dependencies and application
  log_info "Building dependencies..."
  pnpm run build:dependencies

  log_info "Building application..."
  pnpm run build

  # Deploy
  deploy_to_environment "$environment" "$auto_approve"

  echo ""
  log_success "Deployment complete!"
  echo ""
}

main "$@"
