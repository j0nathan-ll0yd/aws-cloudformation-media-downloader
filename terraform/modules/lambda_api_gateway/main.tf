# Lambda API Gateway Module - Main
# API Gateway-triggered Lambda with method and integration

# Use the base Lambda module for core infrastructure
module "lambda" {
  source = "../lambda_base"

  function_name             = var.function_name
  description               = var.description
  handler                   = var.handler
  runtime                   = var.runtime
  architectures             = var.architectures
  memory_size               = var.memory_size
  timeout                   = var.timeout
  environment_variables     = var.environment_variables
  common_lambda_env         = var.common_lambda_env
  layers                    = var.layers
  assume_role_policy        = var.assume_role_policy
  additional_policy_arns    = var.additional_policy_arns
  common_logging_policy_arn = var.common_logging_policy_arn
  common_xray_policy_arn    = var.common_xray_policy_arn
  common_dsql_policy_arn    = var.common_dsql_policy_arn
  enable_dsql               = var.enable_dsql
  enable_xray               = var.enable_xray
  log_retention_days        = var.log_retention_days
  source_dir                = var.source_dir
  common_tags               = var.common_tags
}

# Allow API Gateway to invoke this Lambda
resource "aws_lambda_permission" "api_gateway" {
  action        = "lambda:InvokeFunction"
  function_name = module.lambda.function_name
  principal     = "apigateway.amazonaws.com"
}

# API Gateway Method
resource "aws_api_gateway_method" "this" {
  rest_api_id      = var.api_gateway_rest_api_id
  resource_id      = var.api_gateway_resource_id
  http_method      = var.http_method
  authorization    = var.authorization
  authorizer_id    = var.authorization == "CUSTOM" ? var.authorizer_id : null
  api_key_required = var.api_key_required
}

# API Gateway Integration (Lambda Proxy)
resource "aws_api_gateway_integration" "this" {
  rest_api_id             = var.api_gateway_rest_api_id
  resource_id             = var.api_gateway_resource_id
  http_method             = aws_api_gateway_method.this.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = module.lambda.invoke_arn
}
