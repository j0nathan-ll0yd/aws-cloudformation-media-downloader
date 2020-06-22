resource "aws_api_gateway_rest_api" "MyApi" {
  name           = "OfflineMediaDownloader"
  description    = "This is my API for demonstration purposes"
  api_key_source = "AUTHORIZER"
}

resource "aws_api_gateway_deployment" "MyDeployment" {
  depends_on  = [aws_api_gateway_integration.MyGatewayIntegration]
  rest_api_id = aws_api_gateway_rest_api.MyApi.id
}

resource "aws_api_gateway_stage" "StageProduction" {
  stage_name    = "prod"
  rest_api_id   = aws_api_gateway_rest_api.MyApi.id
  deployment_id = aws_api_gateway_deployment.MyDeployment.id
}

resource "aws_api_gateway_method_settings" "s" {
  rest_api_id = aws_api_gateway_rest_api.MyApi.id
  stage_name  = aws_api_gateway_stage.StageProduction.stage_name
  method_path = "*/*"

  settings {
    metrics_enabled    = true
    logging_level      = "INFO"
    data_trace_enabled = true
  }
}

resource "aws_api_gateway_usage_plan" "MyUsagePlan" {
  name        = "Basic"
  description = "Internal consumption"

  api_stages {
    api_id = aws_api_gateway_rest_api.MyApi.id
    stage  = aws_api_gateway_stage.StageProduction.stage_name
  }
}

resource "aws_api_gateway_api_key" "iOSApiKey" {
  name        = "iOSAppKey"
  description = "The key for the iOS App"
  enabled     = "true"
}

resource "aws_api_gateway_usage_plan_key" "main" {
  key_id        = aws_api_gateway_api_key.iOSApiKey.id
  key_type      = "API_KEY"
  usage_plan_id = aws_api_gateway_usage_plan.MyUsagePlan.id
}

resource "aws_iam_role" "GatewayLogRole" {
  name               = "foobar"
  assume_role_policy = data.aws_iam_policy_document.assume-role-policy.json
}

data "aws_iam_policy_document" "assume-role-policy" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["apigateway.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "assume-role-policy" {
  name   = "instance_role"
  path   = "/"
  assume_role_policy = data.aws_iam_policy_document.assume-role-policy.json
}

resource "aws_iam_role_policy_attachment" "aws-managed-policy-attachment" {
  role       = aws_iam_role.GatewayLogRole.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs"
}

resource "aws_api_gateway_account" "demo" {
  cloudwatch_role_arn = aws_iam_role.GatewayLogRole.arn
}

resource "aws_api_gateway_resource" "MockResource" {
  rest_api_id = aws_api_gateway_rest_api.MyApi.id
  parent_id   = aws_api_gateway_rest_api.MyApi.root_resource_id
  path_part   = "mock"
}

resource "aws_api_gateway_method" "MockMethod" {
  rest_api_id   = aws_api_gateway_rest_api.MyApi.id
  resource_id   = aws_api_gateway_resource.MockResource.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "MyGatewayIntegration" {
  rest_api_id = aws_api_gateway_rest_api.MyApi.id
  resource_id = aws_api_gateway_resource.MockResource.id
  http_method = aws_api_gateway_method.MockMethod.http_method
  type        = "MOCK"
}

resource "aws_api_gateway_gateway_response" "Default400GatewayResponse" {
  rest_api_id   = aws_api_gateway_rest_api.MyApi.id
  response_type = "DEFAULT_4XX"
  response_templates = {
    "application/json" = "{\"error\":{\"code\":\"custom-4XX-generic\",\"message\":$context.error.messageString},\"requestId\":\"$context.requestId\"}"
  }
}

resource "aws_api_gateway_gateway_response" "Default500GatewayResponse" {
  rest_api_id   = aws_api_gateway_rest_api.MyApi.id
  response_type = "DEFAULT_5XX"
  response_templates = {
    "application/json" = "{\"error\":{\"code\":\"custom-5XX-generic\",\"message\":$context.error.messageString},\"requestId\":\"$context.requestId\"}"
  }
}
