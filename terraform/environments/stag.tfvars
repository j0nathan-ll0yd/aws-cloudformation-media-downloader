# Staging Environment Configuration
# Deploy with: tofu apply -var-file=environments/stag.tfvars

environment        = "stag"
resource_prefix    = "stag"
s3_bucket_name     = "stag-media-files"
log_level          = "DEBUG"
log_retention_days = 3
