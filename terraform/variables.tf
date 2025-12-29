# Environment Configuration Variables
# Used with OpenTofu workspaces for multi-environment support

variable "environment" {
  type        = string
  description = "Environment name (stag, prod)"
  validation {
    condition     = contains(["stag", "prod"], var.environment)
    error_message = "Environment must be 'stag' or 'prod'."
  }
}

variable "resource_prefix" {
  type        = string
  description = "Prefix for all resource names (e.g., 'stag', 'prod')"
}

variable "s3_bucket_name" {
  type        = string
  description = "S3 bucket name for media files"
}

variable "log_level" {
  type        = string
  description = "Log level for Lambda functions"
  default     = "INFO"
}

variable "log_retention_days" {
  type        = number
  description = "CloudWatch log retention in days"
  default     = 7
}
