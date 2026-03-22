# Media Downloader Infrastructure
#
# Module-wrapped infrastructure using Mantle framework modules.
# Providers are configured in providers.tf.

module "core" {
  source       = "../../mantle/modules/core"
  project_name = var.project_name
  environment  = var.environment
}

module "api" {
  source      = "../../mantle/modules/api-gateway"
  name_prefix = module.core.name_prefix
  tags        = module.core.common_tags

  redeployment_trigger = sha1(join(",", [
      module.lambda_device_event.invoke_arn,
      module.lambda_device_register.invoke_arn,
      module.lambda_feedly_webhook.invoke_arn,
      module.lambda_files_get.invoke_arn,
      module.lambda_user_delete.invoke_arn,
      module.lambda_user_login.invoke_arn,
      module.lambda_user_logout.invoke_arn,
      module.lambda_user_refresh.invoke_arn,
      module.lambda_user_register.invoke_arn,
      module.lambda_user_subscribe.invoke_arn,
      # Method auth config (triggers redeployment when authorization changes)
      "device_event:none",
      "device_register:none",
      "feedly_webhook:authorizer",
      "files_get:none",
      "user_delete:none",
      "user_login:none",
      "user_logout:none",
      "user_refresh:none",
      "user_register:none",
      "user_subscribe:none",
    ]))

  authorizer_lambda_invoke_arn = module.lambda_api_gateway_authorizer.invoke_arn
  authorizer_enabled           = true
  authorizer_ttl_seconds       = 300
}
