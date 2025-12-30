terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.19.0"
    }
    http = {
      source  = "hashicorp/http"
      version = "3.5.0"
    }
    sops = {
      source  = "carlpett/sops"
      version = "1.2.1"
    }
  }
}

provider "aws" {
  profile = "default"
  region  = var.aws_region
}

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

# Read encrypted secrets from YAML
data "sops_file" "secrets" {
  source_file = "../secrets.enc.yaml"
}

data "aws_iam_policy_document" "CommonLambdaLogging" {
  statement {
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]
    # Scoped to Lambda log groups in this account/region (least privilege)
    resources = [
      "arn:aws:logs:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/*",
      "arn:aws:logs:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/*:*"
    ]
  }
}

resource "aws_iam_policy" "CommonLambdaLogging" {
  name        = "CommonLambdaLogging"
  description = "Allows Lambda functions to write to CloudWatch logs"
  policy      = data.aws_iam_policy_document.CommonLambdaLogging.json
  tags        = local.common_tags
}

data "aws_iam_policy_document" "CommonLambdaXRay" {
  statement {
    actions = [
      "xray:PutTraceSegments",
      "xray:PutTelemetryRecords"
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "CommonLambdaXRay" {
  name        = "CommonLambdaXRay"
  description = "Allows Lambda functions to write X-Ray traces"
  policy      = data.aws_iam_policy_document.CommonLambdaXRay.json
  tags        = local.common_tags
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
