# Staging Environment Configuration
# Deploy with: tofu apply -var-file=environments/staging.tfvars
#
# Cost optimization: Staging uses minimal resources to reduce costs
# - CloudWatch dashboard and alarms disabled
# - Lower API quotas
# - No deletion protection

environment        = "staging"
resource_prefix    = "stag"
log_level          = "DEBUG"
log_retention_days = 3

# Reduced quotas for staging
api_throttle_burst_limit = 20
api_throttle_rate_limit  = 10
api_quota_limit          = 1000

# Allow destruction in staging
dsql_deletion_protection = false

# Disable monitoring to reduce costs
enable_cloudwatch_dashboard = false
enable_cloudwatch_alarms = false

# Lower concurrency in staging
download_reserved_concurrency = 2
