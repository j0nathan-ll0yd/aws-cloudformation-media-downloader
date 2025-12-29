# Environment Configuration Variables
# These variables enable multi-environment deployment (staging, production)

variable "environment" {
  type        = string
  description = "Environment name (staging, production)"
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be 'staging' or 'production'."
  }
}

variable "resource_prefix" {
  type        = string
  description = "Prefix for all resource names (e.g., 'omd-staging', 'omd')"
}

variable "s3_bucket_name" {
  type        = string
  description = "S3 bucket name for media files"
}

variable "api_stage_name" {
  type        = string
  description = "API Gateway stage name (e.g., 'staging', 'prod')"
  default     = "prod"
}

variable "log_retention_days" {
  type        = number
  description = "CloudWatch log retention in days"
  default     = 14
}

variable "log_level" {
  type        = string
  description = "Log level for Lambda functions (DEBUG, INFO, WARN, ERROR)"
  default     = "DEBUG"
  validation {
    condition     = contains(["DEBUG", "INFO", "WARN", "ERROR"], var.log_level)
    error_message = "Log level must be one of: DEBUG, INFO, WARN, ERROR."
  }
}

variable "apns_host" {
  type        = string
  description = "APNS endpoint (api.sandbox.push.apple.com for staging, api.push.apple.com for production)"
  default     = "api.sandbox.push.apple.com"
}
