# Terraform Remote State Configuration
#
# State is stored in S3 with DynamoDB locking to prevent concurrent apply corruption.
# The S3 bucket and DynamoDB table are managed by terraform/bootstrap/main.tf.
#
# Each environment (staging/production) uses a separate state file via workspace_key_prefix.
# State paths:
#   - staging:    s3://lifegames-media-downloader-tfstate/env:staging/terraform.tfstate
#   - production: s3://lifegames-media-downloader-tfstate/env:production/terraform.tfstate
#
# Benefits:
# - Locking prevents concurrent apply corruption
# - S3 versioning enables state rollback
# - KMS encryption for secrets in state
# - No more crew symlink coordination
# - S3 11 9's durability vs local disk
# - Complete state isolation between environments

terraform {
  backend "s3" {
    bucket               = "lifegames-media-downloader-tfstate"
    key                  = "terraform.tfstate"
    region               = "us-west-2"
    encrypt              = true
    dynamodb_table       = "MediaDownloader-TerraformStateLock"
    workspace_key_prefix = "env"
  }
}
