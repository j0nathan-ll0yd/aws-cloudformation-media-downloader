#!/usr/bin/env bash

# Creating the Bucket and enable encryption
echo "Using ${DEPLOYMENT_BUCKET} for deployment artifacts"
bucket_count=`aws s3api list-buckets | grep "${DEPLOYMENT_BUCKET}" | wc -m | xargs`
if [ $bucket_count == 0 ]; then
  echo "Creating ${DEPLOYMENT_BUCKET} on AWS"
  aws s3api create-bucket --region ${AWS_REGION} --bucket ${DEPLOYMENT_BUCKET} --create-bucket-configuration LocationConstraint=${AWS_REGION} | jq -r '.Location'
  aws s3api put-bucket-encryption --bucket ${DEPLOYMENT_BUCKET} --server-side-encryption-configuration '{"Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]}'
fi
