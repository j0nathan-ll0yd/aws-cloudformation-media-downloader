# API Gateway Path Resources
#
# Shared parent path segments for nested RESTful API routes.

resource "aws_api_gateway_resource" "path_device" {
  rest_api_id = module.api.rest_api_id
  parent_id   = module.api.rest_api_root_resource_id
  path_part   = "device"
}

resource "aws_api_gateway_resource" "path_feedly" {
  rest_api_id = module.api.rest_api_id
  parent_id   = module.api.rest_api_root_resource_id
  path_part   = "feedly"
}

resource "aws_api_gateway_resource" "path_user" {
  rest_api_id = module.api.rest_api_id
  parent_id   = module.api.rest_api_root_resource_id
  path_part   = "user"
}
