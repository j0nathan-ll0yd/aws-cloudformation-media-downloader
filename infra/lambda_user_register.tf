# Lambda: UserRegister (ejected — SOPS secrets for Better Auth + Sign In With Apple)

module "lambda_user_register" {
  source = "../../mantle/modules/lambda"

  function_name      = "UserRegister"
  description        = "Registers a new user via Better Auth / Sign In With Apple"
  name_prefix        = module.core.name_prefix
  source_dir         = "${path.module}/../build/lambdas/UserRegister"
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
    DSQL_ROLE_NAME              = local.lambda_dsql_roles["UserRegister"].role_name
    AUTH_SECRET                 = data.sops_file.secrets.data["platform.key"]
    AUTH_BASE_URL               = "https://${module.api.rest_api_id}.execute-api.${module.core.region}.amazonaws.com/prod"
    APPLE_CLIENT_ID             = data.sops_file.secrets.data["signInWithApple.config"]
    APPLE_CLIENT_SECRET         = data.sops_file.secrets.data["signInWithApple.authKey"]
    APPLE_APP_BUNDLE_IDENTIFIER = "lifegames.OfflineMediaDownloader"
  })

  additional_policy_arns = [module.database.connect_policy_arn]
}

resource "aws_api_gateway_resource" "user_register" {
  rest_api_id = module.api.rest_api_id
  parent_id   = aws_api_gateway_resource.path_user.id
  path_part   = "register"
}

resource "aws_api_gateway_method" "user_register" {
  rest_api_id   = module.api.rest_api_id
  resource_id   = aws_api_gateway_resource.user_register.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "user_register" {
  rest_api_id             = module.api.rest_api_id
  resource_id             = aws_api_gateway_resource.user_register.id
  http_method             = aws_api_gateway_method.user_register.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = module.lambda_user_register.invoke_arn
}
