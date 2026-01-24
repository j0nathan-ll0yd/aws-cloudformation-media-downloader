# =============================================================================
# Environment Configuration Variables
# =============================================================================
# These variables enable the same Terraform code to deploy to different
# environments (staging, production) with appropriate settings.
#
# Usage:
#   tofu apply -var-file=environments/staging.tfvars
#   tofu apply -var-file=environments/production.tfvars

variable "environment" {
  description = "Environment name (staging, production)"
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be 'staging' or 'production'."
  }
}

variable "resource_prefix" {
  description = "Prefix for all resource names (stag, prod)"
  type        = string
  validation {
    condition     = contains(["stag", "prod"], var.resource_prefix)
    error_message = "Resource prefix must be 'stag' or 'prod'."
  }
}

# =============================================================================
# Lambda Configuration
# =============================================================================

variable "log_level" {
  description = "Lambda log level"
  type        = string
  default     = "INFO"
  validation {
    condition     = contains(["DEBUG", "INFO", "WARN", "ERROR"], var.log_level)
    error_message = "Log level must be DEBUG, INFO, WARN, or ERROR."
  }
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 7
  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90], var.log_retention_days)
    error_message = "Must be a valid CloudWatch retention period."
  }
}

variable "download_reserved_concurrency" {
  description = "Reserved concurrency for StartFileUpload Lambda"
  type        = number
  default     = 10
}

# =============================================================================
# API Gateway Configuration
# =============================================================================

variable "api_throttle_burst_limit" {
  description = "API Gateway throttle burst limit"
  type        = number
  default     = 100
}

variable "api_throttle_rate_limit" {
  description = "API Gateway throttle rate limit"
  type        = number
  default     = 50
}

variable "api_quota_limit" {
  description = "API Gateway daily quota limit"
  type        = number
  default     = 10000
}

# =============================================================================
# Database Configuration
# =============================================================================

variable "dsql_deletion_protection" {
  description = "Enable deletion protection for DSQL cluster"
  type        = bool
  default     = true
}

# =============================================================================
# Monitoring Configuration (Cost Optimization)
# =============================================================================
# CloudWatch costs are the primary cost driver (~70% of total).
# - Dashboard: $3/month per dashboard with >50 metrics
# - Alarms: $0.10/alarm after first 10 free
#
# For cost savings:
# - Disable dashboard (use AWS Console on-demand)
# - Keep alarms <= 10 to stay in free tier

variable "enable_cloudwatch_dashboard" {
  description = "Enable CloudWatch dashboard (costs $3/month per environment)"
  type        = bool
  default     = false
}

variable "enable_cloudwatch_alarms" {
  description = "Enable CloudWatch alarms (first 10 free, then $0.10/alarm)"
  type        = bool
  default     = false
}
