locals {
  cloudfront_middleware_function_name = "${var.resource_prefix}-CloudfrontMiddleware"
}

resource "aws_iam_role" "CloudfrontMiddleware" {
  name               = local.cloudfront_middleware_function_name
  assume_role_policy = data.aws_iam_policy_document.LamdbaEdgeAssumeRole.json
  tags               = local.common_tags
}

resource "aws_iam_role_policy_attachment" "CloudfrontMiddlewareLogging" {
  role       = aws_iam_role.CloudfrontMiddleware.name
  policy_arn = aws_iam_policy.CommonLambdaLogging.arn
}

resource "aws_iam_role_policy_attachment" "CloudfrontMiddlewareXRay" {
  role       = aws_iam_role.CloudfrontMiddleware.name
  policy_arn = aws_iam_policy.CommonLambdaXRay.arn
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

data "archive_file" "CloudfrontMiddleware" {
  type        = "zip"
  source_dir  = "./../build/lambdas/CloudfrontMiddleware"
  output_path = "./../build/lambdas/CloudfrontMiddleware.zip"
}

resource "aws_lambda_function" "CloudfrontMiddleware" {
  description      = "A lambda that acts as middleware before hitting the API."
  function_name    = local.cloudfront_middleware_function_name
  role             = aws_iam_role.CloudfrontMiddleware.arn
  handler          = "index.handler"
  runtime          = "nodejs24.x"
  publish          = true
  provider         = aws.us_east_1
  filename         = data.archive_file.CloudfrontMiddleware.output_path
  source_code_hash = data.archive_file.CloudfrontMiddleware.output_base64sha256

  tracing_config {
    mode = "Active"
  }

  tags = merge(local.common_tags, {
    Name = local.cloudfront_middleware_function_name
  })
}

resource "aws_cloudfront_distribution" "Production" {
  // This comment needs to match the associated lambda function
  comment = aws_lambda_function.CloudfrontMiddleware.function_name
  origin {
    domain_name = "${aws_api_gateway_rest_api.Main.id}.execute-api.${data.aws_region.current.id}.amazonaws.com"
    origin_path = "/${aws_api_gateway_stage.Production.stage_name}"
    origin_id   = "CloudfrontMiddleware"
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

  tags = merge(local.common_tags, {
    Name = "${var.resource_prefix}-CloudFront"
  })
}

output "cloudfront_distribution_domain" {
  description = "The CloudFront distribution domain. The URL to make requests (e.g. d3q75k9ayjjukw.cloudfront.net)"
  value       = aws_cloudfront_distribution.Production.domain_name
}
