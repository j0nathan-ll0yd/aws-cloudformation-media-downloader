terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.8.0"
    }
    http = {
      source  = "hashicorp/http"
      version = "3.4.0"
    }
  }
}

provider "aws" {
  profile = "default"
  region  = "us-west-2"
}

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

# Pull environment variables from .env
locals {
  envs = { for tuple in regexall("(.*)=(.*)", file("./../.env")) : tuple[0] => sensitive(tuple[1]) }
}

output "api_gateway_region" {
  description = "The region of the API Gateway (e.g. us-west-2)"
  value       = data.aws_region.current.name
}

data "aws_iam_policy_document" "CommonLambdaLogging" {
  statement {
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]
    resources = ["arn:aws:logs:*:*:*"]
  }
}

resource "aws_iam_policy" "CommonLambdaLogging" {
  name        = "CommonLambdaLogging"
  description = "Allows Lambda functions to write to ALL CloudWatch logs"
  policy      = data.aws_iam_policy_document.CommonLambdaLogging.json
}

data "aws_iam_policy_document" "LambdaGatewayAssumeRole" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["apigateway.amazonaws.com", "lambda.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "LamdbaEdgeAssumeRole" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com", "edgelambda.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "LambdaAssumeRole" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "StatesAssumeRole" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["states.amazonaws.com"]
    }
  }
}

variable "GithubPersonalToken" {
  type    = string
  default = "./../secure/githubPersonalToken.txt"
}

resource "aws_secretsmanager_secret" "GithubPersonalToken" {
  name                    = "GithubPersonalToken"
  description             = "The private certificate for APNS"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "GithubPersonalToken" {
  secret_id     = aws_secretsmanager_secret.GithubPersonalToken.id
  secret_string = file(var.GithubPersonalToken)
}

output "public_ip" {
  description = "Your public IP address (used for local development/testing)"
  value       = "104.1.88.244"
}

module "apns" {
  source = "./modules/apns"
  APNS_SANDBOX_DEFAULT_TOPIC = ""
  APNS_SANDBOX_KEY_ID = ""
  APNS_SANDBOX_TEAM = ""
}
