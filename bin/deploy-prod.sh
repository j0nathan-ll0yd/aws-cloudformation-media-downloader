#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../terraform"
tofu workspace select prod 2>/dev/null || tofu workspace new prod
tofu apply -var-file=environments/prod.tfvars "$@"
