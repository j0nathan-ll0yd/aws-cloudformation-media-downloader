# Lambda Base Module - Variables
# Core Lambda infrastructure module for AWS serverless functions

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

variable "reserved_concurrent_executions" {
  description = "Reserved concurrent executions (-1 for unreserved)"
  type        = number
  default     = -1
}

variable "ephemeral_storage_size" {
  description = "Ephemeral storage size in MB (512-10240)"
  type        = number
  default     = 512
}

variable "publish" {
  description = "Whether to publish a new version"
  type        = bool
  default     = false
}
