#!/usr/bin/env bash
#
# Initialize OpenTofu workspaces for staging and production.
# Run once after backend.tf is updated with workspace_key_prefix.
#
# Usage:
#   ./bin/init-workspaces.sh

set -euo pipefail

cd "$(dirname "$0")/../terraform"

echo "Initializing OpenTofu backend..."
tofu init -reconfigure

echo ""
echo "Creating workspaces..."

# Create staging workspace if it doesn't exist
if ! tofu workspace list | grep -q "staging"; then
  tofu workspace new staging
  echo "Created workspace: staging"
else
  echo "Workspace exists: staging"
fi

# Create production workspace if it doesn't exist
if ! tofu workspace list | grep -q "production"; then
  tofu workspace new production
  echo "Created workspace: production"
else
  echo "Workspace exists: production"
fi

echo ""
echo "Available workspaces:"
tofu workspace list

echo ""
echo "Done! Use 'tofu workspace select <env>' to switch environments."
