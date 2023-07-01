#!/usr/bin/env bash

# THESE WORKAROUNDS ARE IN PLACE BECAUSE THE EXCLUDE METHOD OF TDSOC DOESN'T WORK
# TODO: File a bug demonstrating the issue to the TSDoc project

# Get the directory of this file (where the package.json file is located)
bin_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

test_file_path="${bin_dir}/../src/pipeline/terraform.environment.test.ts"
types_file_path="${bin_dir}/../src/types/terraform.d.ts"
git_diff_output=`git diff ${test_file_path}`
git_diff_output_length=${#git_diff_output}
if [[ $git_diff_output_length -gt 0 ]]
then
  echo "Test file has changed; commit changes before running"
  exit
fi

# remove the generated definitions and the file(s) they rely on
if test -f $types_file_path; then
  rm "${bin_dir}/../src/types/terraform.d.ts"
fi
rm "${test_file_path}"

# generate the documentation
typedoc_command="${bin_dir}/../node_modules/typedoc/bin/typedoc --options ./typedoc.json"
eval $typedoc_command

# retrieve or rebuild the files
git checkout "${test_file_path}"
npm run build-terraform-types
