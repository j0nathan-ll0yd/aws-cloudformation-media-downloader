#!/usr/bin/env bash

# THESE WORKAROUNDS ARE IN PLACE BECAUSE THE EXCLUDE METHOD DOESN'T WORK
# TODO: File a bug demonstrating the issue to the TSDoc project

# Get the directory of this file (where the package.json file is located)
bin_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

test_file_path="${bin_dir}/../src/pipeline/terraform.environment.test.ts"
size=${#myvar}

# remove the generated definitions and the file(s) they rely on
rm "${bin_dir}/../src/types/terraform.d.ts"
rm "${test_file_path}"

# generate the documentation
typedoc_command="${bin_dir}/../node_modules/typedoc/bin/typedoc"
eval $typedoc_command

# retrieve the files
git checkout "${bin_dir}/../src/pipeline/terraform.environment.test.ts"
npm run build-terraform-types
