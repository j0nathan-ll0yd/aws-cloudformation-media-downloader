# Terraform moved blocks for raw-resource to module state migration
# This file is temporary — remove after first successful tofu apply in all environments.

# --- Storage: S3 bucket + CloudFront ---

moved {
  from = aws_s3_bucket.media_files
  to   = module.storage_files.aws_s3_bucket.bucket
}

moved {
  from = aws_s3_bucket_versioning.media_files
  to   = module.storage_files.aws_s3_bucket_versioning.bucket[0]
}

moved {
  from = aws_s3_bucket_intelligent_tiering_configuration.media_files
  to   = module.storage_files.aws_s3_bucket_intelligent_tiering_configuration.bucket[0]
}

moved {
  from = aws_s3_bucket_public_access_block.media_files
  to   = module.storage_files.aws_s3_bucket_public_access_block.bucket
}

moved {
  from = aws_cloudfront_origin_access_control.media_files
  to   = module.storage_files.aws_cloudfront_origin_access_control.bucket[0]
}

moved {
  from = aws_cloudfront_distribution.media_files
  to   = module.storage_files.aws_cloudfront_distribution.bucket[0]
}

moved {
  from = aws_s3_bucket_policy.cloudfront_access
  to   = module.storage_files.aws_s3_bucket_policy.cloudfront_access[0]
}

moved {
  from = aws_s3_bucket_notification.media_files
  to   = module.storage_files.aws_s3_bucket_notification.lambda[0]
}

# --- SQS Queues ---

moved {
  from = aws_sqs_queue.download_queue
  to   = module.queue_DownloadQueue.aws_sqs_queue.queue
}

moved {
  from = aws_sqs_queue.download_dlq
  to   = module.queue_DownloadQueue.aws_sqs_queue.dlq
}

moved {
  from = aws_sqs_queue.push_notification_queue
  to   = module.queue_SendPushNotification.aws_sqs_queue.queue
}

moved {
  from = aws_sqs_queue.push_notification_dlq
  to   = module.queue_SendPushNotification.aws_sqs_queue.dlq
}

# --- DynamoDB ---

moved {
  from = aws_dynamodb_table.idempotency
  to   = module.dynamodb_idempotency.aws_dynamodb_table.table
}
