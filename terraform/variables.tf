variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-west-2"
}

variable "environment" {
  description = "Deployment environment (production, staging, development)"
  type        = string
  default     = "production"
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 7
}

variable "lambda_runtime" {
  description = "Node.js runtime version for Lambda functions"
  type        = string
  default     = "nodejs24.x"
}

variable "lambda_architecture" {
  description = "Lambda CPU architecture (arm64 for cost savings, x86_64 for binary compatibility)"
  type        = string
  default     = "arm64"
}

variable "enable_xray_tracing" {
  description = "Enable X-Ray tracing for all Lambda functions"
  type        = bool
  default     = true
}
