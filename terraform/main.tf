provider "aws" {
  profile = "default"
  region  = "us-west-2"
}

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

resource "aws_s3_bucket" "Files" {
  bucket = "lifegames-media-downloader-files"
  acl    = "public-read"
}

resource "aws_lambda_layer_version" "NodeModules" {
  filename            = "./../build/artifacts/layer-node-modules.zip"
  layer_name          = "NodeModules"
  compatible_runtimes = ["nodejs12.x"]
  source_code_hash    = filebase64sha256("./../build/artifacts/layer-node-modules.zip")
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
  description = "IAM policy for logging from a lambda"
  policy      = data.aws_iam_policy_document.CommonLambdaLogging.json
}

data "aws_iam_policy_document" "CommonUpdateFilesTable" {
  statement {
    actions   = ["dynamodb:UpdateItem"]
    resources = [aws_dynamodb_table.Files.arn]
  }
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

data "aws_iam_policy_document" "lambda-assume-role-policy" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["apigateway.amazonaws.com", "lambda.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "states-assume-role-policy" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["states.amazonaws.com"]
    }
  }
}

output "api_gateway_subdomain" { value = aws_api_gateway_rest_api.Main.id }
output "api_gateway_region" { value = data.aws_region.current.name }
output "api_gateway_stage" { value = aws_api_gateway_stage.Production.stage_name }
output "api_gateway_api_key" { value = aws_api_gateway_api_key.iOSApp.value }
