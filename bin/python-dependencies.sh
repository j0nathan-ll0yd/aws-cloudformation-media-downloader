# Get the directory of this file (where the package.json file is located)
bin_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

requirements_file_path="${bin_dir}/../src/lambdas/YouTubeDownloader/requirements.txt"
lambda_file_path="${bin_dir}/../src/lambdas/YouTubeDownloader/lambda_function.py"
local_packages_dir="${bin_dir}/../src/lambdas/YouTubeDownloader/packages/local"
remote_packages_dir="${bin_dir}/../src/lambdas/YouTubeDownloader/packages/remote"

# Reference: https://docs.aws.amazon.com/lambda/latest/dg/python-package.html#python-package-native-libraries
pip install \
-r "${requirements_file_path}" \
--target="${local_packages_dir}" \
--implementation cp \
--python-version 3.11 \
--only-binary=:all: --upgrade

pip install \
-r "${requirements_file_path}" \
--platform manylinux2014_x86_64 \
--target="${remote_packages_dir}" \
--implementation cp \
--python-version 3.11 \
--only-binary=:all: --upgrade

# create a symblink to the lambda file for easy packaging in Terraform
ln -s "${lambda_file_path}" "${remote_packages_dir}"
