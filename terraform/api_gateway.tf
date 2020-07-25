resource "aws_api_gateway_rest_api" "Main" {
  name           = "OfflineMediaDownloader"
  description    = "The API that supports the App"
  api_key_source = "AUTHORIZER"
}

resource "aws_api_gateway_deployment" "Main" {
  depends_on = [
    aws_api_gateway_integration.ListFilesGet
  ]
  rest_api_id = aws_api_gateway_rest_api.Main.id
  triggers = {
    redeployment = sha1(join(",", list(
      jsonencode(aws_api_gateway_integration.ListFilesGet),
      jsonencode(aws_api_gateway_integration.LogClientEventPost),
      jsonencode(aws_api_gateway_integration.WebhookFeedlyPost),
    )))
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

resource "aws_iam_role" "GatewayLogRole" {
  name               = "GatewayLogRole"
  assume_role_policy = data.aws_iam_policy_document.gateway-assume-role-policy.json
}

resource "aws_iam_role_policy_attachment" "aws-managed-policy-attachment" {
  role       = aws_iam_role.GatewayLogRole.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs"
}

resource "aws_api_gateway_account" "Main" {
  cloudwatch_role_arn = aws_iam_role.GatewayLogRole.arn
}
