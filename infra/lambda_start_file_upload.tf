# Lambda: StartFileUpload (ejected — SOPS secrets, SQS trigger, x86_64, reserved concurrency)

module "lambda_start_file_upload" {
  source = "../../mantle/modules/lambda"

  function_name      = "StartFileUpload"
  description        = "Downloads video via yt-dlp and uploads to S3"
  name_prefix        = module.core.name_prefix
  source_dir         = "${path.module}/../build/lambdas/StartFileUpload"
  assume_role_policy = module.core.lambda_assume_role_policy
  region             = module.core.region
  account_id         = module.core.account_id
  tags               = module.core.common_tags
  environment        = var.environment
  timeout            = 900
  memory_size        = 2048
  architecture       = "x86_64"
  log_retention_days = var.log_retention_days
  log_level          = var.log_level
  layers             = [local.adot_layer_arn_x86_64]
  xray_policy_arn    = module.core.lambda_xray_policy_arn
  sqs_trigger_arn     = aws_sqs_queue.download_queue.arn
  sqs_trigger_enabled = true
  sqs_batch_size      = 1

  reserved_concurrent_executions = var.download_reserved_concurrency

  inline_policies = {
    SQSAccess = jsonencode({
      Version = "2012-10-17"
      Statement = [{
        Effect   = "Allow"
        Action   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
        Resource = [aws_sqs_queue.download_queue.arn, aws_sqs_queue.download_dlq.arn]
      }]
    })
  }

  environment_variables = merge(local.common_lambda_env, {
    DSQL_ROLE_NAME                 = local.lambda_dsql_roles["StartFileUpload"].role_name
    BUCKET                         = aws_s3_bucket.media_files.id
    CLOUDFRONT_DOMAIN              = aws_cloudfront_distribution.media_files.domain_name
    EVENT_BUS_NAME                 = local.event_bus_name
    SNS_QUEUE_URL                  = aws_sqs_queue.push_notification_queue.url
    IDEMPOTENCY_TABLE_NAME         = aws_dynamodb_table.idempotency.name
    GITHUB_PERSONAL_TOKEN          = data.sops_file.secrets.data["github.issue.token"]
    YTDLP_BINARY_PATH             = "/opt/bin/yt-dlp_linux"
    YTDLP_COOKIES_PATH            = "/opt/cookies/youtube-cookies.txt"
  })

  additional_policy_arns = [module.database.connect_policy_arn]
}
