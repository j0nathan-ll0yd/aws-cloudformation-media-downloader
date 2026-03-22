# Project-specific Variables
#
# Variables NOT detected by CLI (not from getRequiredEnv/getOptionalEnv calls).

variable "resource_prefix" {
  description = "Prefix for all resource names (stag, prod)"
  type        = string
  validation {
    condition     = contains(["stag", "prod"], var.resource_prefix)
    error_message = "Resource prefix must be 'stag' or 'prod'."
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

variable "dsql_deletion_protection" {
  description = "Enable deletion protection for DSQL cluster"
  type        = bool
  default     = true
}

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

variable "cors_allowed_origins" {
  description = "Origins allowed to fetch media files via CORS (empty list disables CORS)"
  type        = list(string)
  default     = []

  validation {
    condition     = alltrue([for o in var.cors_allowed_origins : can(regex("^https?://", o))])
    error_message = "Each origin must start with http:// or https://."
  }
}
