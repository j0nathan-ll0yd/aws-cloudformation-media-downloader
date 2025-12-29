# Staging Environment Configuration
# Deploy with: tofu workspace select staging && tofu apply -var-file=environments/staging.tfvars

environment        = "staging"
resource_prefix    = "omd-staging"
s3_bucket_name     = "omd-staging-media-files"
api_stage_name     = "staging"
log_retention_days = 7
log_level          = "DEBUG"
apns_host          = "api.sandbox.push.apple.com"
