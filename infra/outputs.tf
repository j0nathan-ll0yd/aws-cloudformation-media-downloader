# Infrastructure Outputs

output "api_url" {
  description = "API Gateway invoke URL"
  value       = module.api.invoke_url
}

output "api_key" {
  description = "API key value"
  value       = module.api.api_key_value
  sensitive   = true
}

output "api_gateway_url" {
  description = "API Gateway deployment URL"
  value       = module.api.invoke_url
}

output "event_bus_name" {
  description = "EventBridge event bus name"
  value       = aws_cloudwatch_event_bus.media_downloader.name
}

output "event_bus_arn" {
  description = "EventBridge event bus ARN"
  value       = aws_cloudwatch_event_bus.media_downloader.arn
}

output "media_bucket_name" {
  description = "S3 bucket name for media files"
  value       = aws_s3_bucket.media_files.id
}

output "dsql_endpoint" {
  description = "Aurora DSQL cluster endpoint"
  value       = module.database.cluster_endpoint
}

output "database_endpoint" {
  description = "Database cluster endpoint"
  value       = module.database.cluster_endpoint
}

output "download_queue_url" {
  description = "SQS download queue URL"
  value       = aws_sqs_queue.download_queue.url
}

output "push_notification_queue_url" {
  description = "SQS push notification queue URL"
  value       = aws_sqs_queue.push_notification_queue.url
}

output "public_ip" {
  description = "Your public IP address (for local development)"
  value       = chomp(data.http.icanhazip.response_body)
}

output "cloudfront_api_domain" {
  description = "CloudFront distribution domain for API"
  value       = aws_cloudfront_distribution.api.domain_name
}

output "cloudfront_media_files_domain" {
  description = "CloudFront domain for media files"
  value       = aws_cloudfront_distribution.media_files.domain_name
}

output "sns_platform_application_arn" {
  description = "SNS platform application ARN for APNS"
  value       = aws_sns_platform_application.apns.arn
}

output "sns_push_notifications_topic_arn" {
  description = "SNS push notifications topic ARN"
  value       = aws_sns_topic.push_notifications.arn
}

# Lambda function ARNs
output "api_gateway_authorizer_function_arn" {
  description = "ARN of the ApiGatewayAuthorizer Lambda function"
  value       = module.lambda_api_gateway_authorizer.function_arn
}

output "cleanup_expired_records_function_arn" {
  description = "ARN of the CleanupExpiredRecords Lambda function"
  value       = module.lambda_cleanup_expired_records.function_arn
}

output "cloudfront_middleware_function_arn" {
  description = "ARN of the CloudfrontMiddleware Lambda function"
  value       = module.lambda_cloudfront_middleware.function_arn
}

output "migrate_dsql_function_arn" {
  description = "ARN of the MigrateDSQL Lambda function"
  value       = module.lambda_migrate_dsql.function_arn
}

output "prune_devices_function_arn" {
  description = "ARN of the PruneDevices Lambda function"
  value       = module.lambda_prune_devices.function_arn
}

output "s3object_created_function_arn" {
  description = "ARN of the S3ObjectCreated Lambda function"
  value       = module.lambda_s3object_created.function_arn
}

output "send_push_notification_function_arn" {
  description = "ARN of the SendPushNotification Lambda function"
  value       = module.lambda_send_push_notification.function_arn
}

output "start_file_upload_function_arn" {
  description = "ARN of the StartFileUpload Lambda function"
  value       = module.lambda_start_file_upload.function_arn
}

output "device_event_function_arn" {
  description = "ARN of the DeviceEvent Lambda function"
  value       = module.lambda_device_event.function_arn
}

output "device_register_function_arn" {
  description = "ARN of the DeviceRegister Lambda function"
  value       = module.lambda_device_register.function_arn
}

output "feedly_webhook_function_arn" {
  description = "ARN of the FeedlyWebhook Lambda function"
  value       = module.lambda_feedly_webhook.function_arn
}

output "files_get_function_arn" {
  description = "ARN of the FilesGet Lambda function"
  value       = module.lambda_files_get.function_arn
}

output "user_delete_function_arn" {
  description = "ARN of the UserDelete Lambda function"
  value       = module.lambda_user_delete.function_arn
}

output "user_login_function_arn" {
  description = "ARN of the UserLogin Lambda function"
  value       = module.lambda_user_login.function_arn
}

output "user_logout_function_arn" {
  description = "ARN of the UserLogout Lambda function"
  value       = module.lambda_user_logout.function_arn
}

output "user_refresh_function_arn" {
  description = "ARN of the UserRefresh Lambda function"
  value       = module.lambda_user_refresh.function_arn
}

output "user_register_function_arn" {
  description = "ARN of the UserRegister Lambda function"
  value       = module.lambda_user_register.function_arn
}

output "user_subscribe_function_arn" {
  description = "ARN of the UserSubscribe Lambda function"
  value       = module.lambda_user_subscribe.function_arn
}

# migration_result output disabled — auto-migration commented out for fresh deploys
# output "migration_result" {
#   value = jsondecode(data.aws_lambda_invocation.run_migration.result)
# }
