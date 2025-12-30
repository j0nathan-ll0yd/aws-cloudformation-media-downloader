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
  region  = "us-west-2"
}

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

# AWS Distro for OpenTelemetry (ADOT) collector layer
# Used for Lambda tracing - sends traces to X-Ray via OTLP
# Layer version list: https://aws-otel.github.io/docs/getting-started/lambda/lambda-js#lambda-layer
# AWS-managed layer published in account 901920570463
locals {
  # Lambda architecture: arm64 (Graviton2) for 20% cost savings and 13-24% faster cold starts
  # Exception: StartFileUpload uses x86_64 for yt-dlp/ffmpeg binary compatibility
  lambda_architecture = "arm64"

  # AWS Distro for OpenTelemetry (ADOT) collector layers
  # Must match Lambda architecture - using wrong arch causes "cannot execute binary file" errors
  adot_layer_arn        = "arn:aws:lambda:${data.aws_region.current.id}:901920570463:layer:aws-otel-nodejs-arm64-ver-1-30-2:1"
  adot_layer_arn_x86_64 = "arn:aws:lambda:${data.aws_region.current.id}:901920570463:layer:aws-otel-nodejs-amd64-ver-1-30-2:1"

  # Common tags for all resources (drift detection & identification)
  common_tags = {
    ManagedBy   = "terraform"
    Project     = "media-downloader"
    Environment = "production"
  }

  # Common environment variables for all lambdas with ADOT layer
  # OPENTELEMETRY_EXTENSION_LOG_LEVEL=warn silences extension INFO logs (~14 lines per cold start)
  # OPENTELEMETRY_COLLECTOR_CONFIG_URI points to custom config that fixes deprecated telemetry.metrics.address
  # NODE_OPTIONS suppresses url.parse() deprecation warning from AWS SDK v3
  # LOG_LEVEL=DEBUG for development visibility (change to INFO for production)
  #
  # Note: OTEL_EXPORTER_OTLP_ENDPOINT and OTEL_PROPAGATORS are not needed as ADOT layer
  # defaults to localhost:4318 (HTTP) and X-Ray propagation respectively.
  common_lambda_env = {
    OPENTELEMETRY_EXTENSION_LOG_LEVEL  = "warn"
    OPENTELEMETRY_COLLECTOR_CONFIG_URI = "/var/task/collector.yaml"
    NODE_OPTIONS                       = "--no-deprecation"
    LOG_LEVEL                          = "DEBUG"
    # Aurora DSQL connection configuration
    # Aurora DSQL endpoints follow the pattern: <identifier>.dsql.<region>.on.aws
    DSQL_CLUSTER_ENDPOINT = "${aws_dsql_cluster.media_downloader.identifier}.dsql.${data.aws_region.current.id}.on.aws"
    DSQL_REGION           = data.aws_region.current.id
  }
}

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
    resources = ["arn:aws:logs:*:*:*"]
  }
}

resource "aws_iam_policy" "CommonLambdaLogging" {
  name        = "CommonLambdaLogging"
  description = "Allows Lambda functions to write to ALL CloudWatch logs"
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

output "public_ip" {
  description = "Your public IP address (used for local development/testing)"
  value       = chomp(data.http.icanhazip.response_body)
}
