# Consolidated outputs for the media-downloader infrastructure
# Moved from individual .tf files for organization

# =============================================================================
# API Gateway
# =============================================================================

output "api_gateway_subdomain" {
  description = "The subdomain of the API Gateway (e.g. ow9mzeewuf)"
  value       = aws_api_gateway_rest_api.Main.id
}

output "api_gateway_stage" {
  description = "The stage of the API Gateway (e.g. prod, staging)"
  value       = aws_api_gateway_stage.Production.stage_name
}

output "api_gateway_api_key" {
  description = "The API key for the API Gateway"
  value       = aws_api_gateway_api_key.iOSApp.value
  sensitive   = true
}

output "api_gateway_url" {
  description = "Full API Gateway URL for API requests"
  value       = "https://${aws_api_gateway_rest_api.Main.id}.execute-api.${data.aws_region.current.id}.amazonaws.com/${aws_api_gateway_stage.Production.stage_name}"
}

# =============================================================================
# Aurora DSQL
# =============================================================================

output "dsql_cluster_endpoint" {
  description = "Aurora DSQL cluster endpoint"
  value       = "${aws_dsql_cluster.media_downloader.identifier}.dsql.${data.aws_region.current.id}.on.aws"
}

output "dsql_cluster_arn" {
  description = "Aurora DSQL cluster ARN"
  value       = aws_dsql_cluster.media_downloader.arn
}

# =============================================================================
# S3 and CloudFront
# =============================================================================

output "cloudfront_media_files_domain" {
  description = "CloudFront domain for media files (use this in iOS app)"
  value       = aws_cloudfront_distribution.MediaFiles.domain_name
}

output "cloudfront_distribution_domain" {
  description = "The CloudFront distribution domain for API requests"
  value       = aws_cloudfront_distribution.Production.domain_name
}

output "s3_bucket_name" {
  description = "S3 bucket name for media files"
  value       = aws_s3_bucket.Files.bucket
}

# =============================================================================
# SQS Queues
# =============================================================================

output "download_queue_url" {
  description = "Download Queue URL"
  value       = aws_sqs_queue.DownloadQueue.id
}

output "download_queue_arn" {
  description = "Download Queue ARN"
  value       = aws_sqs_queue.DownloadQueue.arn
}

# =============================================================================
# DynamoDB
# =============================================================================

output "idempotency_table_name" {
  description = "Name of the Idempotency DynamoDB table"
  value       = aws_dynamodb_table.IdempotencyTable.name
}

output "idempotency_table_arn" {
  description = "ARN of the Idempotency DynamoDB table"
  value       = aws_dynamodb_table.IdempotencyTable.arn
}

# =============================================================================
# EventBridge
# =============================================================================

output "event_bus_name" {
  description = "EventBridge event bus name for media-downloader"
  value       = aws_cloudwatch_event_bus.MediaDownloader.name
}

output "event_bus_arn" {
  description = "EventBridge event bus ARN"
  value       = aws_cloudwatch_event_bus.MediaDownloader.arn
}

# =============================================================================
# CloudWatch
# =============================================================================

output "cloudwatch_dashboard_url" {
  description = "URL to the CloudWatch dashboard"
  value       = "https://${data.aws_region.current.id}.console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.id}#dashboards:name=${aws_cloudwatch_dashboard.Main.dashboard_name}"
}

# =============================================================================
# Database Migration
# =============================================================================

output "migration_result" {
  description = "Result of database migration"
  value       = jsondecode(data.aws_lambda_invocation.run_migration.result)
}

# =============================================================================
# Utility
# =============================================================================

output "public_ip" {
  description = "Your public IP address (used for local development/testing)"
  value       = chomp(data.http.icanhazip.response_body)
}

# =============================================================================
# Lambda Functions (for monitoring and debugging)
# =============================================================================

output "lambda_arns" {
  description = "Map of Lambda function ARNs"
  value = {
    api_gateway_authorizer  = aws_lambda_function.ApiGatewayAuthorizer.arn
    cleanup_expired_records = aws_lambda_function.CleanupExpiredRecords.arn
    device_event            = aws_lambda_function.DeviceEvent.arn
    list_files              = aws_lambda_function.ListFiles.arn
    login_user              = aws_lambda_function.LoginUser.arn
    prune_devices           = aws_lambda_function.PruneDevices.arn
    refresh_token           = aws_lambda_function.RefreshToken.arn
    register_device         = aws_lambda_function.RegisterDevice.arn
    register_user           = aws_lambda_function.RegisterUser.arn
    s3_object_created       = aws_lambda_function.S3ObjectCreated.arn
    send_push_notification  = aws_lambda_function.SendPushNotification.arn
    start_file_upload       = aws_lambda_function.StartFileUpload.arn
    user_delete             = aws_lambda_function.UserDelete.arn
    user_subscribe          = aws_lambda_function.UserSubscribe.arn
    webhook_feedly          = aws_lambda_function.WebhookFeedly.arn
  }
}
