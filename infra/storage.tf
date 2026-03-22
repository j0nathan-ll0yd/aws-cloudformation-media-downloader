# S3 Bucket for Media Files
#
# Stores downloaded video files served via CloudFront.

resource "aws_s3_bucket" "media_files" {
  bucket = "lifegames-${var.resource_prefix}-media-files-${module.core.account_id}"

  tags = merge(module.core.common_tags, {
    Purpose = "Media file storage"
  })
}

resource "aws_s3_bucket_versioning" "media_files" {
  bucket = aws_s3_bucket.media_files.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_intelligent_tiering_configuration" "media_files" {
  bucket = aws_s3_bucket.media_files.id
  name   = "EntireBucket"

  tiering {
    access_tier = "ARCHIVE_ACCESS"
    days        = 90
  }

  tiering {
    access_tier = "DEEP_ARCHIVE_ACCESS"
    days        = 180
  }
}

resource "aws_s3_bucket_public_access_block" "media_files" {
  bucket = aws_s3_bucket.media_files.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_cors_configuration" "media_files" {
  count  = length(var.cors_allowed_origins) > 0 ? 1 : 0
  bucket = aws_s3_bucket.media_files.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = var.cors_allowed_origins
    expose_headers  = ["Content-Length", "Content-Type", "ETag"]
    max_age_seconds = 3600
  }
}

# Origin Access Control for CloudFront
resource "aws_cloudfront_origin_access_control" "media_files" {
  name                              = "${var.resource_prefix}-media-files-oac"
  description                       = "OAC for media files S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# CloudFront Distribution for S3 media files
resource "aws_cloudfront_distribution" "media_files" {
  enabled             = true
  default_root_object = ""
  price_class         = "PriceClass_100"

  origin {
    domain_name              = aws_s3_bucket.media_files.bucket_regional_domain_name
    origin_id                = "S3-media-files"
    origin_access_control_id = aws_cloudfront_origin_access_control.media_files.id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-media-files"
    viewer_protocol_policy = "redirect-to-https"

    response_headers_policy_id = length(var.cors_allowed_origins) > 0 ? aws_cloudfront_response_headers_policy.media_files_cors[0].id : null

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 86400
    max_ttl     = 31536000
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
    Name = "MediaFilesDistribution"
  })
}

# CORS Response Headers Policy for media files
resource "aws_cloudfront_response_headers_policy" "media_files_cors" {
  count   = length(var.cors_allowed_origins) > 0 ? 1 : 0
  name    = "${var.resource_prefix}-media-files-cors"
  comment = "CORS for Astro dashboard site"

  cors_config {
    access_control_allow_credentials = false
    origin_override                  = true

    access_control_allow_headers {
      items = ["*"]
    }

    access_control_allow_methods {
      items = ["GET", "HEAD"]
    }

    access_control_allow_origins {
      items = var.cors_allowed_origins
    }

    access_control_max_age_sec = 86400
  }
}

# S3 Bucket Policy for CloudFront OAC access
resource "aws_s3_bucket_policy" "cloudfront_access" {
  bucket = aws_s3_bucket.media_files.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowCloudFrontAccess"
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.media_files.arn}/*"
      Condition = {
        StringEquals = {
          "AWS:SourceArn" = aws_cloudfront_distribution.media_files.arn
        }
      }
    }]
  })
}

# Lambda permission for S3 to invoke S3ObjectCreated
resource "aws_lambda_permission" "s3object_created" {
  action        = "lambda:InvokeFunction"
  function_name = module.lambda_s3object_created.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.media_files.arn
}

# S3 event notification for S3ObjectCreated Lambda
resource "aws_s3_bucket_notification" "media_files" {
  bucket = aws_s3_bucket.media_files.id

  lambda_function {
    lambda_function_arn = module.lambda_s3object_created.function_arn
    events              = ["s3:ObjectCreated:*"]
    filter_suffix       = ".mp4"
  }

  depends_on = [module.lambda_s3object_created]
}

moved {
  from = aws_s3_object.default_file
  to   = aws_s3_object.asset_videos_default_file
}

# Static asset: default demo file for anonymous/unauthenticated users
resource "aws_s3_object" "asset_videos_default_file" {
  bucket       = aws_s3_bucket.media_files.id
  key          = "videos/default-file.mp4"
  source       = "${path.module}/../static/videos/default-file.mp4"
  content_type = "video/mp4"
  etag         = filemd5("${path.module}/../static/videos/default-file.mp4")
}
