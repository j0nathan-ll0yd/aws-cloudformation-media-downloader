# Lambda: MigrateDSQL (ejected — needs DSQL_REGION, DSQL_ROLE_NAME)
# Runs schema migrations and applies per-Lambda permissions on every deploy.

module "lambda_migrate_dsql" {
  source = "../../mantle/modules/lambda"

  function_name      = "MigrateDSQL"
  name_prefix        = module.core.name_prefix
  source_dir         = "${path.module}/../build/lambdas/MigrateDSQL"
  assume_role_policy = module.core.lambda_assume_role_policy
  xray_policy_arn    = module.core.lambda_xray_policy_arn
  region             = module.core.region
  account_id         = module.core.account_id
  environment        = var.environment
  tags               = module.core.common_tags
  timeout            = 300

  environment_variables = {
    DSQL_ENDPOINT     = module.database.cluster_endpoint
    DSQL_REGION       = module.core.region
    METRICS_NAMESPACE = "MediaDownloader"
    AWS_ACCOUNT_ID    = module.core.account_id
    RESOURCE_PREFIX   = module.core.name_prefix
    DSQL_ROLE_NAME    = "admin"
  }

  additional_policy_arns = [module.database.admin_connect_policy_arn]
}

# Auto-migration: runs MigrateDSQL Lambda on every deploy after DSQL cluster is ready.
# The 60s wait ensures the cluster and IAM role propagation are complete.
resource "time_sleep" "wait_for_dsql" {
  depends_on      = [module.database, module.lambda_migrate_dsql]
  create_duration = "60s"
}

data "aws_lambda_invocation" "run_migration" {
  function_name = module.lambda_migrate_dsql.function_name
  input         = jsonencode({ source = "terraform-deploy" })
  depends_on    = [time_sleep.wait_for_dsql]
}

output "migration_result" {
  description = "Result of the MigrateDSQL Lambda invocation"
  value       = jsondecode(data.aws_lambda_invocation.run_migration.result)
}
