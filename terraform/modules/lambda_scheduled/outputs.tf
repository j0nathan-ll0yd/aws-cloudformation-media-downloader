# Lambda Scheduled Module - Outputs

# Re-export all lambda_base outputs
output "function_name" {
  description = "Lambda function name"
  value       = module.lambda.function_name
}

output "function_arn" {
  description = "Lambda function ARN"
  value       = module.lambda.function_arn
}

output "invoke_arn" {
  description = "Lambda invoke ARN for API Gateway"
  value       = module.lambda.invoke_arn
}

output "qualified_arn" {
  description = "Lambda qualified ARN (with version)"
  value       = module.lambda.qualified_arn
}

output "role_name" {
  description = "IAM role name"
  value       = module.lambda.role_name
}

output "role_arn" {
  description = "IAM role ARN"
  value       = module.lambda.role_arn
}

output "log_group_name" {
  description = "CloudWatch log group name"
  value       = module.lambda.log_group_name
}

output "log_group_arn" {
  description = "CloudWatch log group ARN"
  value       = module.lambda.log_group_arn
}

# CloudWatch Events specific outputs
output "event_rule_name" {
  description = "CloudWatch Event rule name"
  value       = aws_cloudwatch_event_rule.this.name
}

output "event_rule_arn" {
  description = "CloudWatch Event rule ARN"
  value       = aws_cloudwatch_event_rule.this.arn
}
