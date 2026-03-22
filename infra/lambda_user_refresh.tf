# Lambda: UserRefresh (ejected — ADOT layers, common_lambda_env)

module "lambda_user_refresh" {
  source = "../../mantle/modules/lambda"

  function_name      = "UserRefresh"
  description        = "Refreshes user authentication token"
  name_prefix        = module.core.name_prefix
  source_dir         = "${path.module}/../build/lambdas/UserRefresh"
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
    DSQL_ROLE_NAME = local.lambda_dsql_roles["UserRefresh"].role_name
  })

  additional_policy_arns = [module.database.connect_policy_arn]
}

resource "aws_api_gateway_resource" "user_refresh" {
  rest_api_id = module.api.rest_api_id
  parent_id   = aws_api_gateway_resource.path_user.id
  path_part   = "refresh"
}

resource "aws_api_gateway_method" "user_refresh" {
  rest_api_id   = module.api.rest_api_id
  resource_id   = aws_api_gateway_resource.user_refresh.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = module.api.authorizer_id
}

resource "aws_api_gateway_integration" "user_refresh" {
  rest_api_id             = module.api.rest_api_id
  resource_id             = aws_api_gateway_resource.user_refresh.id
  http_method             = aws_api_gateway_method.user_refresh.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = module.lambda_user_refresh.invoke_arn
}
