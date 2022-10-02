resource "aws_iam_role" "CloudfrontMiddlewareRole" {
  name               = "CloudfrontMiddlewareRole"
  assume_role_policy = data.aws_iam_policy_document.LamdbaEdgeAssumeRole.json
}

data "aws_iam_policy_document" "CloudfrontMiddleware" {
  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.PrivateEncryptionKey.arn]
  }
}

resource "aws_iam_policy" "CloudfrontMiddlewarePolicy" {
  name   = "CloudfrontMiddlewarePolicy"
  policy = data.aws_iam_policy_document.CloudfrontMiddleware.json
}

resource "aws_iam_role_policy_attachment" "CloudfrontMiddlewarePolicy" {
  role       = aws_iam_role.CloudfrontMiddlewareRole.name
  policy_arn = aws_iam_policy.CloudfrontMiddlewarePolicy.arn
}

resource "aws_iam_role_policy_attachment" "CloudfrontMiddlewarePolicyLogging" {
  role       = aws_iam_role.CloudfrontMiddlewareRole.name
  policy_arn = aws_iam_policy.CommonLambdaLogging.arn
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

data "archive_file" "CloudfrontMiddleware" {
  type        = "zip"
  source_file = "./../build/lambdas/CloudfrontMiddleware.js"
  output_path = "./../build/lambdas/CloudfrontMiddleware.zip"
}

resource "aws_lambda_function" "CloudfrontMiddleware" {
  description      = "A lambda that acts as middleware before hitting the API."
  function_name    = "CloudfrontMiddleware"
  role             = aws_iam_role.CloudfrontMiddlewareRole.arn
  handler          = "CloudfrontMiddleware.handler"
  runtime          = "nodejs14.x"
  publish          = true
  provider         = aws.us_east_1
  filename         = data.archive_file.CloudfrontMiddleware.output_path
  source_code_hash = data.archive_file.CloudfrontMiddleware.output_base64sha256
}

resource "aws_cloudfront_distribution" "Production" {
  // This comment needs to match the associated lambda function
  comment = aws_lambda_function.CloudfrontMiddleware.function_name
  origin {
    domain_name = replace(aws_api_gateway_deployment.Main.invoke_url, "/^https?://([^/]*).*/", "$1")
    origin_path = "/${aws_api_gateway_stage.Production.stage_name}"
    origin_id   = "CloudfrontMiddleware"
    custom_header {
      name  = "X-Reserved-Client-IP"
      value = chomp(data.http.icanhazip.body)
    }
    custom_header {
      name  = "X-WWW-Authenticate-Realm"
      value = aws_api_gateway_stage.Production.stage_name
    }
    custom_origin_config {
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
      http_port              = 80
      https_port             = 443
    }
  }
  enabled = true
  default_cache_behavior {
    lambda_function_association {
      event_type = "origin-request"
      lambda_arn = aws_lambda_function.CloudfrontMiddleware.qualified_arn
    }
    viewer_protocol_policy = "https-only"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "CloudfrontMiddleware"
    forwarded_values {
      query_string = true
      headers      = ["X-API-Key", "Authorization", "User-Agent"]
      cookies {
        forward = "none"
      }
    }
    // Intentionally set these values to not cache
    default_ttl = 0
    min_ttl     = 0
    max_ttl     = 0
  }
  restrictions {
    geo_restriction {
      restriction_type = "whitelist"
      locations        = ["US"]
    }
  }
  viewer_certificate {
    cloudfront_default_certificate = true
  }
}
