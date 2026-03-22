# Lambda: FeedlyWebhook (ejected — SNS_QUEUE_URL from our SQS resources, ADOT)

module "lambda_feedly_webhook" {
  source = "../../mantle/modules/lambda"

  function_name      = "FeedlyWebhook"
  description        = "Processes Feedly webhook events and creates download requests"
  name_prefix        = module.core.name_prefix
  source_dir         = "${path.module}/../build/lambdas/FeedlyWebhook"
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

  inline_policies = {
    DynamoDBIdempotency = jsonencode({
      Version = "2012-10-17"
      Statement = [{
        Effect   = "Allow"
        Action   = ["dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem"]
        Resource = aws_dynamodb_table.idempotency.arn
      }]
    })
  }

  environment_variables = merge(local.common_lambda_env, {
    DSQL_ROLE_NAME         = local.lambda_dsql_roles["FeedlyWebhook"].role_name
    SNS_QUEUE_URL          = aws_sqs_queue.push_notification_queue.url
    EVENT_BUS_NAME         = local.event_bus_name
    IDEMPOTENCY_TABLE_NAME = aws_dynamodb_table.idempotency.name
  })

  additional_policy_arns = [module.database.connect_policy_arn]
}

resource "aws_api_gateway_resource" "feedly_webhook" {
  rest_api_id = module.api.rest_api_id
  parent_id   = aws_api_gateway_resource.path_feedly.id
  path_part   = "webhook"
}

resource "aws_api_gateway_method" "feedly_webhook" {
  rest_api_id   = module.api.rest_api_id
  resource_id   = aws_api_gateway_resource.feedly_webhook.id
  http_method   = "POST"
  authorization = "CUSTOM"
  authorizer_id = module.api.authorizer_id
}

resource "aws_api_gateway_integration" "feedly_webhook" {
  rest_api_id             = module.api.rest_api_id
  resource_id             = aws_api_gateway_resource.feedly_webhook.id
  http_method             = aws_api_gateway_method.feedly_webhook.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = module.lambda_feedly_webhook.invoke_arn
}
