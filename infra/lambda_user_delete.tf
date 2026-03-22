# Lambda: UserDelete (ejected — SOPS secrets for GitHub token)

module "lambda_user_delete" {
  source = "../../mantle/modules/lambda"

  function_name      = "UserDelete"
  description        = "Deletes user account and associated data"
  name_prefix        = module.core.name_prefix
  source_dir         = "${path.module}/../build/lambdas/UserDelete"
  assume_role_policy = module.core.lambda_gateway_assume_role_policy
  region             = module.core.region
  account_id         = module.core.account_id
  tags               = module.core.common_tags
  environment        = var.environment
  log_retention_days = var.log_retention_days
  log_level          = var.log_level
  layers             = [local.adot_layer_arn]
  xray_policy_arn    = module.core.lambda_xray_policy_arn
  api_gateway_enabled = true

  environment_variables = merge(local.common_lambda_env, {
    DSQL_ROLE_NAME        = local.lambda_dsql_roles["UserDelete"].role_name
    GITHUB_PERSONAL_TOKEN = data.sops_file.secrets.data["github.issue.token"]
    SNS_TOPIC_ARN         = aws_sns_topic.push_notifications.arn
  })

  additional_policy_arns = [module.database.connect_policy_arn]
}

resource "aws_api_gateway_method" "user_delete" {
  rest_api_id   = module.api.rest_api_id
  resource_id   = aws_api_gateway_resource.path_user.id
  http_method   = "DELETE"
  authorization = "CUSTOM"
  authorizer_id = module.api.authorizer_id
}

resource "aws_api_gateway_integration" "user_delete" {
  rest_api_id             = module.api.rest_api_id
  resource_id             = aws_api_gateway_resource.path_user.id
  http_method             = aws_api_gateway_method.user_delete.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = module.lambda_user_delete.invoke_arn
}
