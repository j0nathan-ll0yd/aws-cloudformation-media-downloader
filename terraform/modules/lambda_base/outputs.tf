# Lambda Base Module - Outputs

output "function_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.this.function_name
}

output "function_arn" {
  description = "Lambda function ARN"
  value       = aws_lambda_function.this.arn
}

output "invoke_arn" {
  description = "Lambda invoke ARN for API Gateway"
  value       = aws_lambda_function.this.invoke_arn
}

output "qualified_arn" {
  description = "Lambda qualified ARN (with version)"
  value       = aws_lambda_function.this.qualified_arn
}

output "role_name" {
  description = "IAM role name"
  value       = aws_iam_role.this.name
}

output "role_arn" {
  description = "IAM role ARN"
  value       = aws_iam_role.this.arn
}

output "log_group_name" {
  description = "CloudWatch log group name"
  value       = aws_cloudwatch_log_group.this.name
}

output "log_group_arn" {
  description = "CloudWatch log group ARN"
  value       = aws_cloudwatch_log_group.this.arn
}
