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
  adot_layer_arn = "arn:aws:lambda:${data.aws_region.current.id}:901920570463:layer:aws-otel-nodejs-amd64-ver-1-30-2:1"

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
    DSQL_CLUSTER_ENDPOINT = aws_dsql_cluster.media_downloader.endpoint
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

# Single-table DynamoDB design for all entities
# ElectroDB manages entity discrimination via pk/sk composite keys
resource "aws_dynamodb_table" "MediaDownloader" {
  name         = "MediaDownloader"
  billing_mode = "PAY_PER_REQUEST" # On-demand billing - best for low/variable traffic
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  # UserCollection: Query all resources by userId (files, devices)
  # Access pattern: "Get all files and devices for a user"
  # Used by: ListFiles, UserDelete, RegisterDevice
  attribute {
    name = "gsi1pk"
    type = "S"
  }

  attribute {
    name = "gsi1sk"
    type = "S"
  }

  global_secondary_index {
    name            = "UserCollection"
    hash_key        = "gsi1pk"
    range_key       = "gsi1sk"
    projection_type = "ALL"
  }

  # FileCollection: Query all users by fileId (reverse lookup)
  # Access pattern: "Which users need notification for this file?"
  # Used by: S3ObjectCreated
  attribute {
    name = "gsi2pk"
    type = "S"
  }

  attribute {
    name = "gsi2sk"
    type = "S"
  }

  global_secondary_index {
    name            = "FileCollection"
    hash_key        = "gsi2pk"
    range_key       = "gsi2sk"
    projection_type = "ALL"
  }

  # DeviceCollection: Query all users by deviceId (reverse lookup)
  # Access pattern: "Which users are affected by this device?"
  # Used by: PruneDevices
  attribute {
    name = "gsi3pk"
    type = "S"
  }

  attribute {
    name = "gsi3sk"
    type = "S"
  }

  global_secondary_index {
    name            = "DeviceCollection"
    hash_key        = "gsi3pk"
    range_key       = "gsi3sk"
    projection_type = "ALL"
  }

  # StatusIndex: Query files by status, sorted by availableAt
  # Access pattern: "Find files ready to download"
  # Used by: FileCoordinator
  attribute {
    name = "gsi4pk"
    type = "S"
  }

  attribute {
    name = "gsi4sk"
    type = "N"
  }

  global_secondary_index {
    name            = "StatusIndex"
    hash_key        = "gsi4pk"
    range_key       = "gsi4sk"
    projection_type = "ALL"
  }

  # KeyIndex: Query files by S3 object key
  # Access pattern: "Find file by S3 event key"
  # Used by: S3ObjectCreated
  attribute {
    name = "gsi5pk"
    type = "S"
  }

  global_secondary_index {
    name            = "KeyIndex"
    hash_key        = "gsi5pk"
    projection_type = "ALL"
  }

  # GSI6: Query FileDownloads by status and retryAfter
  # Access pattern: "Find downloads ready for retry"
  # Used by: FileCoordinator
  # Note: gsi6sk is String because ElectroDB composite keys serialize as strings
  attribute {
    name = "gsi6pk"
    type = "S"
  }

  attribute {
    name = "gsi6sk"
    type = "S"
  }

  global_secondary_index {
    name            = "GSI6"
    hash_key        = "gsi6pk"
    range_key       = "gsi6sk"
    projection_type = "ALL"
  }

  # AppleDeviceIndex: Query users by Apple device ID
  # Access pattern: "Find user by Apple Sign-In device identifier"
  # Used by: LoginUser, RegisterUser
  attribute {
    name = "gsi7pk"
    type = "S"
  }

  attribute {
    name = "gsi7sk"
    type = "S"
  }

  global_secondary_index {
    name            = "AppleDeviceIndex"
    hash_key        = "gsi7pk"
    range_key       = "gsi7sk"
    projection_type = "ALL"
  }

  # EmailIndex: Query users by email address
  # Access pattern: "Find user by email for login/registration"
  # Used by: RegisterUser, LoginUser (Better Auth adapter)
  attribute {
    name = "gsi8pk"
    type = "S"
  }

  attribute {
    name = "gsi8sk"
    type = "S"
  }

  global_secondary_index {
    name            = "EmailIndex"
    hash_key        = "gsi8pk"
    range_key       = "gsi8sk"
    projection_type = "ALL"
  }

  # TokenIndex: Query sessions by token
  # Access pattern: "Validate session token for authentication"
  # Used by: ApiGatewayAuthorizer (Better Auth session validation)
  attribute {
    name = "gsi9pk"
    type = "S"
  }

  attribute {
    name = "gsi9sk"
    type = "S"
  }

  global_secondary_index {
    name            = "TokenIndex"
    hash_key        = "gsi9pk"
    range_key       = "gsi9sk"
    projection_type = "ALL"
  }

  # ProviderIndex: Query accounts by OAuth provider
  # Access pattern: "Find account by providerId + providerAccountId"
  # Used by: LoginUser, RegisterUser (Better Auth adapter)
  attribute {
    name = "gsi10pk"
    type = "S"
  }

  attribute {
    name = "gsi10sk"
    type = "S"
  }

  global_secondary_index {
    name            = "ProviderIndex"
    hash_key        = "gsi10pk"
    range_key       = "gsi10sk"
    projection_type = "ALL"
  }

  # TTL for automatic cleanup of completed/failed FileDownloads
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = merge(local.common_tags, {
    Name        = "MediaDownloader"
    Description = "Single-table design for all entities"
  })
}

data "http" "icanhazip" {
  url = "https://ipv4.icanhazip.com/"
}

output "public_ip" {
  description = "Your public IP address (used for local development/testing)"
  value       = chomp(data.http.icanhazip.response_body)
}
