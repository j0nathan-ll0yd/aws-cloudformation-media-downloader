resource "aws_api_gateway_rest_api" "Main" {
  name           = "OfflineMediaDownloader"
  description    = "The API that supports the App"
  api_key_source = "HEADER"

  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

resource "aws_api_gateway_deployment" "Main" {
  depends_on = [
    aws_api_gateway_integration.ListFilesGet
  ]
  rest_api_id = aws_api_gateway_rest_api.Main.id
  triggers = {
    redeployment = sha1(join(",", tolist([
      jsonencode(aws_api_gateway_integration.ListFilesGet),
      jsonencode(aws_api_gateway_integration.LogClientEventPost),
      jsonencode(aws_api_gateway_integration.LoginUserPost),
      jsonencode(aws_api_gateway_integration.RegisterDevicePost),
      jsonencode(aws_api_gateway_integration.RegisterUserPost),
      jsonencode(aws_api_gateway_integration.WebhookFeedlyPost),
      jsonencode(aws_api_gateway_integration.UserSubscribePost),
      jsonencode(aws_api_gateway_method.ListFilesGet),
      jsonencode(aws_api_gateway_method.LogClientEventPost),
      jsonencode(aws_api_gateway_method.LoginUserPost),
      jsonencode(aws_api_gateway_method.RegisterDevicePost),
      jsonencode(aws_api_gateway_method.RegisterUserPost),
      jsonencode(aws_api_gateway_method.WebhookFeedlyPost),
      jsonencode(aws_api_gateway_method.UserSubscribePost),
      jsonencode(aws_api_gateway_method.HealthCheckGet)
    ])))
  }
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_stage" "Production" {
  stage_name    = "prod"
  rest_api_id   = aws_api_gateway_rest_api.Main.id
  deployment_id = aws_api_gateway_deployment.Main.id
}

resource "aws_api_gateway_method_settings" "Production" {
  rest_api_id = aws_api_gateway_rest_api.Main.id
  stage_name  = aws_api_gateway_stage.Production.stage_name
  method_path = "*/*"
  settings {
    metrics_enabled    = true
    logging_level      = "INFO"
    data_trace_enabled = true
  }
}

resource "aws_api_gateway_usage_plan" "iOSApp" {
  name        = "iOSApp"
  description = "Internal consumption"
  api_stages {
    api_id = aws_api_gateway_rest_api.Main.id
    stage  = aws_api_gateway_stage.Production.stage_name
  }
}

resource "aws_api_gateway_api_key" "iOSApp" {
  name        = "iOSAppKey"
  description = "The key for the iOS App"
  enabled     = true
}

resource "aws_api_gateway_usage_plan_key" "iOSApp" {
  key_id        = aws_api_gateway_api_key.iOSApp.id
  key_type      = "API_KEY"
  usage_plan_id = aws_api_gateway_usage_plan.iOSApp.id
}

resource "aws_api_gateway_gateway_response" "Default400GatewayResponse" {
  rest_api_id   = aws_api_gateway_rest_api.Main.id
  response_type = "DEFAULT_4XX"
  response_templates = {
    "application/json" = "{\"error\":{\"code\":\"custom-4XX-generic\",\"message\":$context.error.messageString},\"requestId\":\"$context.requestId\"}"
  }
}

resource "aws_api_gateway_gateway_response" "Default500GatewayResponse" {
  rest_api_id   = aws_api_gateway_rest_api.Main.id
  response_type = "DEFAULT_5XX"
  response_templates = {
    "application/json" = "{\"error\":{\"code\":\"custom-5XX-generic\",\"message\":$context.error.messageString},\"requestId\":\"$context.requestId\"}"
  }
}

resource "aws_iam_role" "ApiGatewayCloudwatchRole" {
  name               = "ApiGatewayCloudwatchRole"
  assume_role_policy = data.aws_iam_policy_document.ApiGatewayCloudwatchRole.json
  managed_policy_arns = ["arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs"]
}

data "aws_iam_policy_document" "ApiGatewayCloudwatchRole" {
  statement {
    actions = ["sts:AssumeRole"]
    effect  = "Allow"
    principals {
      type        = "Service"
      identifiers = ["apigateway.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "ApiGatewayCloudwatchRolePolicy" {
  name   = "ApiGatewayCloudwatchRolePolicy"
  role   = aws_iam_role.ApiGatewayCloudwatchRole.id
  policy = data.aws_iam_policy_document.CommonLambdaLogging.json
}

resource "aws_api_gateway_account" "Main" {
  cloudwatch_role_arn = aws_iam_role.ApiGatewayCloudwatchRole.arn
}

output "api_gateway_subdomain" {
  description = "The subdomain of the API Gateway (e.g. ow9mzeewuf)"
  value       = aws_api_gateway_rest_api.Main.id
}

output "api_gateway_stage" {
  description = "The stage of the API Gateway (e.g. prod, staging)"
  value       = aws_api_gateway_stage.Production.stage_name
}

output "api_gateway_api_key" {
  description = "The API key for the API Gateway"
  value       = aws_api_gateway_api_key.iOSApp.value
  sensitive   = true
}
