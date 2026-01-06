locals {
  s3_object_created_function_name = "S3ObjectCreated"
}

resource "aws_s3_bucket" "Files" {
  bucket = "lifegames-media-downloader-files"
  tags   = local.common_tags
}

resource "aws_s3_bucket_intelligent_tiering_configuration" "FilesTiering" {
  bucket = aws_s3_bucket.Files.id
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

# Origin Access Control for CloudFront (replaces public-read ACL)
resource "aws_cloudfront_origin_access_control" "MediaFilesOAC" {
  name                              = "media-files-oac"
  description                       = "OAC for media files S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# CloudFront Distribution for S3 media files
resource "aws_cloudfront_distribution" "MediaFiles" {
  enabled             = true
  default_root_object = ""
  price_class         = "PriceClass_100" # US, Canada, Europe - lowest cost

  origin {
    domain_name              = aws_s3_bucket.Files.bucket_regional_domain_name
    origin_id                = "S3-media-files"
    origin_access_control_id = aws_cloudfront_origin_access_control.MediaFilesOAC.id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-media-files"
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 86400    # 1 day
    max_ttl     = 31536000 # 1 year
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
    Name = "MediaFilesDistribution"
  })
}

# S3 Bucket Policy for CloudFront OAC access
resource "aws_s3_bucket_policy" "CloudfrontAccess" {
  bucket = aws_s3_bucket.Files.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowCloudFrontAccess"
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.Files.arn}/*"
      Condition = {
        StringEquals = {
          "AWS:SourceArn" = aws_cloudfront_distribution.MediaFiles.arn
        }
      }
    }]
  })
}

output "cloudfront_media_files_domain" {
  description = "CloudFront domain for media files (use this in iOS app)"
  value       = aws_cloudfront_distribution.MediaFiles.domain_name
}

resource "aws_s3_bucket_notification" "Files" {
  bucket = aws_s3_bucket.Files.bucket
  lambda_function {
    events              = ["s3:ObjectCreated:*"]
    lambda_function_arn = aws_lambda_function.S3ObjectCreated.arn
  }
}

resource "aws_lambda_permission" "S3ObjectCreated" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.S3ObjectCreated.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.Files.arn
}

resource "aws_cloudwatch_log_group" "S3ObjectCreated" {
  name              = "/aws/lambda/${aws_lambda_function.S3ObjectCreated.function_name}"
  retention_in_days = 7
  tags              = local.common_tags
}

data "archive_file" "S3ObjectCreated" {
  type        = "zip"
  source_dir  = "./../build/lambdas/S3ObjectCreated"
  output_path = "./../build/lambdas/S3ObjectCreated.zip"
}

resource "aws_lambda_function" "S3ObjectCreated" {
  description      = "Dispatches a notification after a file is uploaded to an S3 bucket"
  function_name    = local.s3_object_created_function_name
  role             = aws_iam_role.S3ObjectCreated.arn
  handler          = "index.handler"
  runtime          = "nodejs24.x"
  architectures    = [local.lambda_architecture]
  timeout          = local.default_lambda_timeout
  depends_on       = [aws_iam_role_policy.S3ObjectCreatedLogging]
  filename         = data.archive_file.S3ObjectCreated.output_path
  source_code_hash = data.archive_file.S3ObjectCreated.output_base64sha256
  layers           = [local.adot_layer_arn]

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = merge(local.common_lambda_env, {
      SNS_QUEUE_URL     = aws_sqs_queue.SendPushNotification.id
      OTEL_SERVICE_NAME = local.s3_object_created_function_name
      DSQL_ACCESS_LEVEL = "readonly"
    })
  }

  tags = merge(local.common_tags, {
    Name = local.s3_object_created_function_name
  })
}

resource "aws_iam_role" "S3ObjectCreated" {
  name               = local.s3_object_created_function_name
  assume_role_policy = data.aws_iam_policy_document.LambdaAssumeRole.json
  tags               = local.common_tags
}

data "aws_iam_policy_document" "S3ObjectCreated" {
  statement {
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.SendPushNotification.arn]
  }
}

resource "aws_iam_policy" "S3ObjectCreated" {
  name   = local.s3_object_created_function_name
  policy = data.aws_iam_policy_document.S3ObjectCreated.json
  tags   = local.common_tags
}

resource "aws_iam_role_policy_attachment" "S3ObjectCreated" {
  role       = aws_iam_role.S3ObjectCreated.name
  policy_arn = aws_iam_policy.S3ObjectCreated.arn
}

resource "aws_iam_role_policy" "S3ObjectCreatedLogging" {
  name = "S3ObjectCreatedLogging"
  role = aws_iam_role.S3ObjectCreated.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ]
      Resource = [
        "arn:aws:logs:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.s3_object_created_function_name}",
        "arn:aws:logs:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.s3_object_created_function_name}:*"
      ]
    }]
  })
}

resource "aws_iam_role_policy_attachment" "S3ObjectCreatedXRay" {
  role       = aws_iam_role.S3ObjectCreated.name
  policy_arn = aws_iam_policy.CommonLambdaXRay.arn
}

resource "aws_iam_role_policy_attachment" "S3ObjectCreatedDSQL" {
  role       = aws_iam_role.S3ObjectCreated.name
  policy_arn = aws_iam_policy.LambdaDSQLReadOnly.arn
}
