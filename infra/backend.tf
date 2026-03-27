terraform {
  backend "s3" {
    bucket               = "mantle-offlinemediadownloader-tfstate"
    key                  = "infra.tfstate"
    region               = "us-west-2"
    encrypt              = true
    dynamodb_table       = "TerraformStateLock"
    workspace_key_prefix = "env"
  }
}
