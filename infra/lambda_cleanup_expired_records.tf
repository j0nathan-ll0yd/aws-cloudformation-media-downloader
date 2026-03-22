# Lambda: CleanupExpiredRecords (ejected — ADOT layers, common_lambda_env)

module "lambda_cleanup_expired_records" {
  source = "../../mantle/modules/lambda"

  function_name      = "CleanupExpiredRecords"
  description        = "Removes expired sessions and verification records"
  name_prefix        = module.core.name_prefix
  source_dir         = "${path.module}/../build/lambdas/CleanupExpiredRecords"
  assume_role_policy = module.core.lambda_assume_role_policy
  region             = module.core.region
  account_id         = module.core.account_id
  tags               = module.core.common_tags
  environment        = var.environment
  timeout            = 60
  log_retention_days = var.log_retention_days
  log_level          = var.log_level
  layers             = [local.adot_layer_arn]
  xray_policy_arn    = module.core.lambda_xray_policy_arn

  schedule_expression = "cron(0 3 * * ? *)"

  environment_variables = merge(local.common_lambda_env, {
    DSQL_ROLE_NAME = local.lambda_dsql_roles["CleanupExpiredRecords"].role_name
  })

  additional_policy_arns = [module.database.connect_policy_arn]
}
