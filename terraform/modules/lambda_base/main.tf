# Lambda Base Module - Main
# Core Lambda infrastructure including IAM role, log group, and Lambda function

# IAM Role for Lambda function
resource "aws_iam_role" "this" {
  name               = var.function_name
  assume_role_policy = var.assume_role_policy
  tags               = var.common_tags
}

# Attach common logging policy
resource "aws_iam_role_policy_attachment" "logging" {
  role       = aws_iam_role.this.name
  policy_arn = var.common_logging_policy_arn
}

# Attach X-Ray policy (optional)
resource "aws_iam_role_policy_attachment" "xray" {
  count      = var.enable_xray ? 1 : 0
  role       = aws_iam_role.this.name
  policy_arn = var.common_xray_policy_arn
}

# Attach DSQL policy (optional)
resource "aws_iam_role_policy_attachment" "dsql" {
  count      = var.enable_dsql && var.common_dsql_policy_arn != "" ? 1 : 0
  role       = aws_iam_role.this.name
  policy_arn = var.common_dsql_policy_arn
}

# Attach additional custom policies
resource "aws_iam_role_policy_attachment" "additional" {
  count      = length(var.additional_policy_arns)
  role       = aws_iam_role.this.name
  policy_arn = var.additional_policy_arns[count.index]
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "this" {
  name              = "/aws/lambda/${var.function_name}"
  retention_in_days = var.log_retention_days
  tags              = var.common_tags
}

# Archive the Lambda source code
data "archive_file" "this" {
  type        = "zip"
  source_dir  = var.source_dir
  output_path = "${var.source_dir}.zip"
}

# Lambda Function
resource "aws_lambda_function" "this" {
  function_name                  = var.function_name
  description                    = var.description
  role                           = aws_iam_role.this.arn
  handler                        = var.handler
  runtime                        = var.runtime
  architectures                  = var.architectures
  memory_size                    = var.memory_size
  timeout                        = var.timeout
  reserved_concurrent_executions = var.reserved_concurrent_executions > 0 ? var.reserved_concurrent_executions : null
  filename                       = data.archive_file.this.output_path
  source_code_hash               = data.archive_file.this.output_base64sha256
  layers                         = var.layers
  publish                        = var.publish

  dynamic "ephemeral_storage" {
    for_each = var.ephemeral_storage_size > 512 ? [1] : []
    content {
      size = var.ephemeral_storage_size
    }
  }

  dynamic "tracing_config" {
    for_each = var.enable_xray ? [1] : []
    content {
      mode = "Active"
    }
  }

  environment {
    variables = merge(var.common_lambda_env, var.environment_variables, {
      OTEL_SERVICE_NAME = var.function_name
    })
  }

  tags = merge(var.common_tags, {
    Name = var.function_name
  })

  depends_on = [
    aws_iam_role_policy_attachment.logging,
    aws_cloudwatch_log_group.this
  ]
}
