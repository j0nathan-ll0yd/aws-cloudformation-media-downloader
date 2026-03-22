# Lambda: PruneDevices (ejected — SOPS secrets for APNS config)

module "lambda_prune_devices" {
  source = "../../mantle/modules/lambda"

  function_name      = "PruneDevices"
  description        = "Removes inactive devices and their SNS subscriptions"
  name_prefix        = module.core.name_prefix
  source_dir         = "${path.module}/../build/lambdas/PruneDevices"
  assume_role_policy = module.core.lambda_assume_role_policy
  region             = module.core.region
  account_id         = module.core.account_id
  tags               = module.core.common_tags
  environment        = var.environment
  timeout            = 300
  log_retention_days = var.log_retention_days
  log_level          = var.log_level
  layers             = [local.adot_layer_arn]
  xray_policy_arn    = module.core.lambda_xray_policy_arn

  schedule_expression = "rate(1 day)"

  environment_variables = merge(local.common_lambda_env, {
    DSQL_ROLE_NAME     = local.lambda_dsql_roles["PruneDevices"].role_name
    APNS_SIGNING_KEY   = data.sops_file.secrets.data["apns.staging.signingKey"]
    APNS_TEAM          = data.sops_file.secrets.data["apns.staging.team"]
    APNS_KEY_ID        = data.sops_file.secrets.data["apns.staging.keyId"]
    APNS_DEFAULT_TOPIC = data.sops_file.secrets.data["apns.staging.defaultTopic"]
    APNS_HOST          = "api.sandbox.push.apple.com"
    SNS_TOPIC_ARN      = aws_sns_topic.push_notifications.arn
  })

  additional_policy_arns = [module.database.connect_policy_arn]
}
