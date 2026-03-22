# Core Variables
#
# Project configuration, environment, and region.

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "media-downloader"
}

variable "api_bearer_token" {
  description = "Static bearer token for API authentication (unused when custom authorizer is enabled)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "dsql_endpoint" {
  description = "Override DSQL cluster endpoint (defaults to module.database.cluster_endpoint)"
  type        = string
  default     = ""
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "staging"

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be 'staging' or 'production'."
  }
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-west-2"
}

variable "log_level" {
  description = "Application log level (DEBUG, INFO, WARN, ERROR)"
  type        = string
  default     = "INFO"

  validation {
    condition     = contains(["DEBUG", "INFO", "WARN", "ERROR"], var.log_level)
    error_message = "Log level must be DEBUG, INFO, WARN, or ERROR."
  }
}
