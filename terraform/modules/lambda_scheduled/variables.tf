# Lambda Scheduled Module - Variables
# CloudWatch Events-triggered Lambda for scheduled execution

# ============================================================================
# Lambda Base Variables (passed through to lambda_base module)
# ============================================================================

variable "function_name" {
  description = "Lambda function name (PascalCase)"
  type        = string
}

variable "description" {
  description = "Lambda function description"
  type        = string
}

variable "handler" {
  description = "Lambda handler entry point"
  type        = string
  default     = "index.handler"
}

variable "runtime" {
  description = "Lambda runtime"
  type        = string
  default     = "nodejs24.x"
}

variable "architectures" {
  description = "Lambda CPU architectures"
  type        = list(string)
  default     = ["arm64"]
}

variable "memory_size" {
  description = "Lambda memory in MB"
  type        = number
  default     = 512
}

variable "timeout" {
  description = "Lambda timeout in seconds"
  type        = number
  default     = 30
}

variable "environment_variables" {
  description = "Lambda-specific environment variables (merged with common_lambda_env)"
  type        = map(string)
  default     = {}
}

variable "common_lambda_env" {
  description = "Common Lambda environment variables from root module"
  type        = map(string)
}

variable "layers" {
  description = "Lambda layer ARNs"
  type        = list(string)
  default     = []
}

variable "assume_role_policy" {
  description = "IAM assume role policy JSON"
  type        = string
}

variable "additional_policy_arns" {
  description = "Additional IAM policy ARNs to attach"
  type        = list(string)
  default     = []
}

variable "common_logging_policy_arn" {
  description = "ARN of CommonLambdaLogging policy"
  type        = string
}

variable "common_xray_policy_arn" {
  description = "ARN of CommonLambdaXRay policy"
  type        = string
}

variable "common_dsql_policy_arn" {
  description = "ARN of LambdaDSQLAccess policy (optional)"
  type        = string
  default     = ""
}

variable "enable_dsql" {
  description = "Whether to attach DSQL policy"
  type        = bool
  default     = true
}

variable "enable_xray" {
  description = "Whether to enable X-Ray tracing"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 7
}

variable "source_dir" {
  description = "Path to Lambda source directory"
  type        = string
}

variable "common_tags" {
  description = "Common resource tags"
  type        = map(string)
}

# ============================================================================
# CloudWatch Events Variables
# ============================================================================

variable "schedule_expression" {
  description = "CloudWatch Events schedule expression (e.g., 'rate(1 day)' or 'cron(0 3 * * ? *)')"
  type        = string
}

variable "schedule_description" {
  description = "Description for the CloudWatch Event rule"
  type        = string
  default     = ""
}

variable "schedule_enabled" {
  description = "Whether the schedule is enabled"
  type        = bool
  default     = true
}
