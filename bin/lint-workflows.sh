#!/usr/bin/env bash

# Lint every GitHub Actions workflow in .github/workflows.

set -euo pipefail

workflow_files=()
while IFS= read -r workflow_file; do
  workflow_files+=("$workflow_file")
done < <(find .github/workflows -type f \( -name '*.yml' -o -name '*.yaml' \) -print | sort)

actionlint "${workflow_files[@]}"
