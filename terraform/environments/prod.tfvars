# Production Environment Configuration
# Deploy with: tofu apply -var-file=environments/prod.tfvars

environment        = "prod"
resource_prefix    = "prod"
s3_bucket_name     = "prod-media-files"
log_level          = "INFO"
log_retention_days = 7
