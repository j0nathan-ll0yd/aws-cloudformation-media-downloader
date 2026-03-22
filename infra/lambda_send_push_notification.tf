# Lambda: SendPushNotification (ejected — SNS topic ARN, SQS trigger)

module "lambda_send_push_notification" {
  source = "../../mantle/modules/lambda"

  function_name      = "SendPushNotification"
  description        = "Delivers push notifications to iOS devices via APNS"
  name_prefix        = module.core.name_prefix
  source_dir         = "${path.module}/../build/lambdas/SendPushNotification"
  assume_role_policy = module.core.lambda_assume_role_policy
  region             = module.core.region
  account_id         = module.core.account_id
  tags               = module.core.common_tags
  environment        = var.environment
  memory_size        = 512
  log_retention_days = var.log_retention_days
  log_level          = var.log_level
  layers             = [local.adot_layer_arn]
  xray_policy_arn    = module.core.lambda_xray_policy_arn
  sqs_trigger_arn     = aws_sqs_queue.push_notification_queue.arn
  sqs_trigger_enabled = true
  sqs_batch_size      = 1

  inline_policies = {
    SQSAccess = jsonencode({
      Version = "2012-10-17"
      Statement = [{
        Effect   = "Allow"
        Action   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
        Resource = [aws_sqs_queue.push_notification_queue.arn, aws_sqs_queue.push_notification_dlq.arn]
      }]
    })
  }

  environment_variables = merge(local.common_lambda_env, {
    DSQL_ROLE_NAME = local.lambda_dsql_roles["SendPushNotification"].role_name
    SNS_TOPIC_ARN  = aws_sns_topic.push_notifications.arn
  })

  additional_policy_arns = [module.database.connect_policy_arn]
}
