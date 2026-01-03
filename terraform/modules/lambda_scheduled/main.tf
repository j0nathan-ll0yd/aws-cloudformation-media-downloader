# Lambda Scheduled Module - Main
# CloudWatch Events-triggered Lambda for scheduled execution

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

# CloudWatch Event Rule for scheduled execution
resource "aws_cloudwatch_event_rule" "this" {
  name                = var.function_name
  description         = var.schedule_description != "" ? var.schedule_description : "Triggers ${var.function_name} Lambda on schedule"
  schedule_expression = var.schedule_expression
  state               = var.schedule_enabled ? "ENABLED" : "DISABLED"
  tags                = var.common_tags
}

# CloudWatch Event Target
resource "aws_cloudwatch_event_target" "this" {
  rule = aws_cloudwatch_event_rule.this.name
  arn  = module.lambda.function_arn
}

# Allow CloudWatch Events to invoke this Lambda
resource "aws_lambda_permission" "cloudwatch" {
  action        = "lambda:InvokeFunction"
  function_name = module.lambda.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.this.arn
}
