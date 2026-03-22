# Lambda: ApiGatewayAuthorizer (ejected — SOPS secrets, custom authorizer config)

module "lambda_api_gateway_authorizer" {
  source = "../../mantle/modules/lambda"

  function_name      = "ApiGatewayAuthorizer"
  description        = "Custom API Gateway authorizer for API key and session validation"
  name_prefix        = module.core.name_prefix
  source_dir         = "${path.module}/../build/lambdas/ApiGatewayAuthorizer"
  assume_role_policy = module.core.lambda_gateway_assume_role_policy
  region             = module.core.region
  account_id         = module.core.account_id
  tags               = module.core.common_tags
  environment        = var.environment
  log_retention_days = var.log_retention_days
  log_level          = var.log_level
  layers             = [local.adot_layer_arn]
  xray_policy_arn    = module.core.lambda_xray_policy_arn

  environment_variables = merge(local.common_lambda_env, {
    DSQL_ROLE_NAME                  = local.lambda_dsql_roles["ApiGatewayAuthorizer"].role_name
    MULTI_AUTHENTICATION_PATH_PARTS = "device/register,device/event,files"
    RESERVED_CLIENT_IP              = "104.1.88.244"
    AUTH_SECRET                     = data.sops_file.secrets.data["platform.key"]
  })

  inline_policies = {
    "ApiGatewayAccess" = jsonencode({
      Version = "2012-10-17"
      Statement = [{
        Effect   = "Allow"
        Action   = ["apigateway:GET"]
        Resource = "arn:aws:apigateway:*::/*"
      }]
    })
  }

  additional_policy_arns = [module.database.connect_policy_arn]
}
