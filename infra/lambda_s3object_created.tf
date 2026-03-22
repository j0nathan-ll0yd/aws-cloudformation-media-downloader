# Lambda: S3ObjectCreated (ejected — S3 trigger, common_lambda_env, ADOT)

module "lambda_s3object_created" {
  source = "../../mantle/modules/lambda"

  function_name      = "S3ObjectCreated"
  description        = "Dispatches a notification after a file is uploaded to S3"
  name_prefix        = module.core.name_prefix
  source_dir         = "${path.module}/../build/lambdas/S3ObjectCreated"
  assume_role_policy = module.core.lambda_assume_role_policy
  region             = module.core.region
  account_id         = module.core.account_id
  tags               = module.core.common_tags
  environment        = var.environment
  log_retention_days = var.log_retention_days
  log_level          = var.log_level
  layers             = [local.adot_layer_arn]
  xray_policy_arn    = module.core.lambda_xray_policy_arn

  # S3 trigger permission is handled in storage.tf (aws_lambda_permission + aws_s3_bucket_notification)
  # We don't use s3_trigger_bucket_arn here because the bucket ARN is computed and causes plan-time count issues.

  environment_variables = merge(local.common_lambda_env, {
    DSQL_ROLE_NAME = local.lambda_dsql_roles["S3ObjectCreated"].role_name
    SNS_QUEUE_URL  = aws_sqs_queue.push_notification_queue.url
  })

  additional_policy_arns = [module.database.connect_policy_arn]
}
