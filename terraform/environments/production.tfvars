# Production Environment Configuration
# Deploy with: tofu workspace select production && tofu apply -var-file=environments/production.tfvars

environment        = "production"
resource_prefix    = "omd"
s3_bucket_name     = "omd-media-files"
api_stage_name     = "prod"
log_retention_days = 14
log_level          = "INFO"
apns_host          = "api.push.apple.com"
