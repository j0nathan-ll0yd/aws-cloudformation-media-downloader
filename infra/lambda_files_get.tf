# Lambda: FilesGet (ejected — ADOT layers, common_lambda_env)

module "lambda_files_get" {
  source = "../../mantle/modules/lambda"

  function_name      = "FilesGet"
  description        = "Lists available media files"
  name_prefix        = module.core.name_prefix
  source_dir         = "${path.module}/../build/lambdas/FilesGet"
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
    DSQL_ROLE_NAME                    = local.lambda_dsql_roles["FilesGet"].role_name
    ASSET_VIDEOS_DEFAULT_FILE_KEY          = aws_s3_object.asset_videos_default_file.key
    ASSET_VIDEOS_DEFAULT_FILE_URL          = "https://${aws_cloudfront_distribution.media_files.domain_name}/${aws_s3_object.asset_videos_default_file.key}"
    ASSET_VIDEOS_DEFAULT_FILE_SIZE         = 436743
    ASSET_VIDEOS_DEFAULT_FILE_CONTENT_TYPE = "video/mp4"
  })

  additional_policy_arns = [module.database.connect_policy_arn]
}

resource "aws_api_gateway_resource" "files_get" {
  rest_api_id = module.api.rest_api_id
  parent_id   = module.api.rest_api_root_resource_id
  path_part   = "files"
}

resource "aws_api_gateway_method" "files_get" {
  rest_api_id   = module.api.rest_api_id
  resource_id   = aws_api_gateway_resource.files_get.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = module.api.authorizer_id
}

resource "aws_api_gateway_integration" "files_get" {
  rest_api_id             = module.api.rest_api_id
  resource_id             = aws_api_gateway_resource.files_get.id
  http_method             = aws_api_gateway_method.files_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = module.lambda_files_get.invoke_arn
}
