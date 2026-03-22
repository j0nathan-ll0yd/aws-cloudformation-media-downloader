# Lambda@Edge: CloudFront Middleware
#
# Must be hand-written because CLI has no Lambda@Edge support.
# Lambda@Edge requires us-east-1 provider and x86_64 architecture.

module "lambda_cloudfront_middleware" {
  source = "../../mantle/modules/lambda"

  providers = {
    aws = aws.us_east_1
  }

  function_name      = "CloudfrontMiddleware"
  description        = "Lambda@Edge for CloudFront origin-request modification"
  name_prefix        = module.core.name_prefix
  source_dir         = "${path.module}/../build/lambdas/CloudfrontMiddleware"
  assume_role_policy = module.core.lambda_edge_assume_role_policy
  region             = "us-east-1"
  account_id         = module.core.account_id
  tags               = module.core.common_tags
  environment        = var.environment
  memory_size        = 128
  timeout            = 5
  log_retention_days = var.log_retention_days
  log_level          = var.log_level
  is_edge_function   = true
  architecture       = "x86_64"
}

# CloudFront Distribution for API Gateway
resource "aws_cloudfront_distribution" "api" {
  comment = module.lambda_cloudfront_middleware.function_name
  origin {
    domain_name = "${module.api.rest_api_id}.execute-api.${module.core.region}.amazonaws.com"
    origin_path = "/${module.api.stage_name}"
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
      lambda_arn = module.lambda_cloudfront_middleware.qualified_arn
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
    # Intentionally set to not cache
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

  tags = merge(module.core.common_tags, {
    Name = "Production"
  })
}
