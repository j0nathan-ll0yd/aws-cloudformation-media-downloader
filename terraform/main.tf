provider "aws" {
  profile = "default"
  region  = "us-west-2"
}

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

resource "aws_s3_bucket" "file_bucket" {
  bucket = "lifegames-media-downloader-files"
  acl    = "public-read"
}

resource "aws_lambda_layer_version" "lambda_layer" {
  filename            = "./../build/artifacts/layer-node-modules.zip"
  layer_name          = "node_modules_layer"
  compatible_runtimes = ["nodejs12.x"]
  source_code_hash    = filebase64sha256("./../build/artifacts/layer-node-modules.zip")
}

resource "aws_iam_policy" "lambda_logging" {
  name        = "lambda_logging"
  path        = "/"
  description = "IAM policy for logging from a lambda"

  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*",
      "Effect": "Allow"
    }
  ]
}
EOF
}

resource "aws_iam_policy" "AuthorizationFunctionRolePolicy" {
  name = "AuthorizationFunctionRolePolicy"

  # The policy below is incorrect; gotta figure out why
  policy = <<-EOF
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Action": [
          "apigateway:GET"
        ],
        "Effect": "Allow",
        "Resource": [
          "arn:aws:apigateway:${data.aws_region.current.name}::/apikeys",
          "arn:aws:apigateway:${data.aws_region.current.name}::/apikeys/*",
          "arn:aws:apigateway:${data.aws_region.current.name}::/usageplans",
          "arn:aws:apigateway:${data.aws_region.current.name}::/usageplans/*/usage"
        ]
      }
    ]
  }
  EOF
}

data "aws_iam_policy_document" "example" {
  statement {
    actions = [
      "s3:ListBucket"
    ]

    resources = [
      "arn:aws:s3:::${aws_s3_bucket.file_bucket.bucket}/*"
    ]
  }
}

resource "aws_iam_policy" "ListFilesRolePolicy" {
  name = "ListFilesRolePolicy"
  policy = data.aws_iam_policy_document.example.json
}

data "aws_iam_policy_document" "gateway-assume-role-policy" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["apigateway.amazonaws.com", "lambda.amazonaws.com"]
    }
  }
}
