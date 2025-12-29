#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../terraform"
tofu workspace select stag 2>/dev/null || tofu workspace new stag
tofu plan -var-file=environments/stag.tfvars "$@"
