terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.62.0"
    }
    http = {
      source  = "hashicorp/http"
      version = "3.4.4"
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

data "aws_iam_policy_document" "SNSAssumeRole" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["sns.amazonaws.com"]
    }
  }
}

data "http" "icanhazip" {
  url = "https://ipv4.icanhazip.com/"
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
  value       = chomp(data.http.icanhazip.response_body)
}
