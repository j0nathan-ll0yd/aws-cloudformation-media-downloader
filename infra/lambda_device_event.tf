# Lambda: DeviceEvent (ejected — common_lambda_env, ADOT)

module "lambda_device_event" {
  source = "../../mantle/modules/lambda"

  function_name      = "DeviceEvent"
  description        = "Receives telemetry events from iOS devices"
  name_prefix        = module.core.name_prefix
  source_dir         = "${path.module}/../build/lambdas/DeviceEvent"
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
    DSQL_ROLE_NAME = local.lambda_dsql_roles["DeviceEvent"].role_name
  })

  additional_policy_arns = [module.database.connect_policy_arn]
}

resource "aws_api_gateway_resource" "device_event" {
  rest_api_id = module.api.rest_api_id
  parent_id   = aws_api_gateway_resource.path_device.id
  path_part   = "event"
}

resource "aws_api_gateway_method" "device_event" {
  rest_api_id   = module.api.rest_api_id
  resource_id   = aws_api_gateway_resource.device_event.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "device_event" {
  rest_api_id             = module.api.rest_api_id
  resource_id             = aws_api_gateway_resource.device_event.id
  http_method             = aws_api_gateway_method.device_event.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = module.lambda_device_event.invoke_arn
}
