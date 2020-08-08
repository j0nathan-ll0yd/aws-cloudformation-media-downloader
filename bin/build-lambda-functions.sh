#!/usr/bin/env bash
set -euo pipefail

# Get the directory of this file (where the package.json file is located)
bin_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# setup file paths
zip_file_path="${bin_dir}/../build/artifacts/dist.zip"
directory_to_zip="${bin_dir}/../dist"

echo "Running TypeScript checker"
npm run check-types

echo "Building distribution directory"
"${bin_dir}/../node_modules/@babel/cli/bin/babel.js" "${bin_dir}/../src" --out-dir "${bin_dir}/../dist" --extensions '.ts'

echo "Prepping artifacts directory"
mkdir -p "$(dirname "${zip_file_path}")"
rm -f "${zip_file_path}"

echo "Zipping distribution directory to ${zip_file_path}"
zip -r -X "${zip_file_path}" "${directory_to_zip}"
