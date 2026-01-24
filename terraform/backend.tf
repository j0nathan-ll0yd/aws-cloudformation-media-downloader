# Terraform Remote State Configuration
#
# State is stored in S3 with DynamoDB locking to prevent concurrent apply corruption.
# The S3 bucket and DynamoDB table are managed by terraform/bootstrap/main.tf.
#
# Benefits:
# - Locking prevents concurrent apply corruption
# - S3 versioning enables state rollback
# - KMS encryption for secrets in state
# - No more crew symlink coordination
# - S3 11 9's durability vs local disk

terraform {
  backend "s3" {
    bucket         = "lifegames-media-downloader-tfstate"
    key            = "terraform.tfstate"
    region         = "us-west-2"
    encrypt        = true
    dynamodb_table = "MediaDownloader-TerraformStateLock"
  }
}
