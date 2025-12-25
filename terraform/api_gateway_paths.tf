# Parent API Gateway resources for nested path structure
# These resources define the parent path segments for RESTful API paths

# /user - Parent resource for user-related endpoints
# Children: /user/login, /user/register, /user/refresh, /user/subscribe, DELETE /user
resource "aws_api_gateway_resource" "User" {
  rest_api_id = aws_api_gateway_rest_api.Main.id
  parent_id   = aws_api_gateway_rest_api.Main.root_resource_id
  path_part   = "user"
}

# /device - Parent resource for device-related endpoints
# Children: /device/register
resource "aws_api_gateway_resource" "Device" {
  rest_api_id = aws_api_gateway_rest_api.Main.id
  parent_id   = aws_api_gateway_rest_api.Main.root_resource_id
  path_part   = "device"
}
