# Production Environment Configuration
# Deploy with: tofu apply -var-file=environments/production.tfvars
#
# Full production settings with monitoring and protection enabled

environment        = "production"
resource_prefix    = "prod"
log_level          = "INFO"
log_retention_days = 7

# Full quotas for production
api_throttle_burst_limit = 100
api_throttle_rate_limit  = 50
api_quota_limit          = 10000

# Protect production data
dsql_deletion_protection = true

# Full monitoring (within free tier - 3 critical alarms)
enable_cloudwatch_dashboard = false # Use AWS Console on-demand ($3/month savings)
enable_cloudwatch_alarms    = true

# Production concurrency
download_reserved_concurrency = 10
