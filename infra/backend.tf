# Terraform Remote State Configuration
#
# State is stored in S3 with DynamoDB locking to prevent concurrent apply corruption.
# Each environment (staging/production) uses a separate state file via workspace_key_prefix.
#
# State paths:
#   - staging:    s3://lifegames-media-downloader-tfstate/env:staging/infra.tfstate
#   - production: s3://lifegames-media-downloader-tfstate/env:production/infra.tfstate

terraform {
  backend "s3" {
    bucket               = "lifegames-media-downloader-tfstate"
    key                  = "infra.tfstate"
    region               = "us-west-2"
    encrypt              = true
    dynamodb_table       = "MediaDownloader-TerraformStateLock"
    workspace_key_prefix = "env"
  }
}
