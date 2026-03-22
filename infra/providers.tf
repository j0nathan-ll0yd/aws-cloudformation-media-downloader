# Terraform Provider Configuration
#
# All providers and version constraints in one place.

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
    sops = {
      source  = "carlpett/sops"
      version = "~> 1.4"
    }
    http = {
      source  = "hashicorp/http"
      version = "~> 3.5"
    }
  }
}

# Primary region (us-west-2)
provider "aws" {
  region = var.aws_region
}

# us-east-1 provider for Lambda@Edge (CloudFront requires us-east-1)
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}
