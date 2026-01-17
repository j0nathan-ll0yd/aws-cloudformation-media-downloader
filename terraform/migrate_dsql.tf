# MigrateDSQL Lambda
# Applies database migrations to Aurora DSQL during deployment
# Invoked automatically by Terraform after DSQL cluster creation
#
# See: docs/wiki/Conventions/Database-Migrations.md

locals {
  migrate_dsql_function_name = "MigrateDSQL"
}

resource "aws_iam_role" "MigrateDSQL" {
  name               = local.migrate_dsql_function_name
  assume_role_policy = data.aws_iam_policy_document.LambdaAssumeRole.json
  tags               = local.common_tags
}

resource "aws_iam_role_policy" "MigrateDSQLLogging" {
  name = "MigrateDSQLLogging"
  role = aws_iam_role.MigrateDSQL.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ]
      Resource = [
        "arn:aws:logs:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.migrate_dsql_function_name}",
        "arn:aws:logs:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.migrate_dsql_function_name}:*"
      ]
    }]
  })
}

resource "aws_iam_role_policy_attachment" "MigrateDSQLXRay" {
  role       = aws_iam_role.MigrateDSQL.name
  policy_arn = aws_iam_policy.CommonLambdaXRay.arn
}

# DSQL policy attachment handled by terraform/dsql_permissions.tf

resource "aws_cloudwatch_log_group" "MigrateDSQL" {
  name              = "/aws/lambda/${aws_lambda_function.MigrateDSQL.function_name}"
  retention_in_days = 7
  tags              = local.common_tags
}

data "archive_file" "MigrateDSQL" {
  type        = "zip"
  source_dir  = "./../build/lambdas/MigrateDSQL"
  output_path = "./../build/lambdas/MigrateDSQL.zip"
}

resource "aws_lambda_function" "MigrateDSQL" {
  description      = "Applies database migrations to Aurora DSQL"
  function_name    = local.migrate_dsql_function_name
  role             = aws_iam_role.MigrateDSQL.arn
  handler          = "index.handler"
  runtime          = "nodejs24.x"
  architectures    = [local.lambda_architecture]
  timeout          = 300 # 5 minutes for complex migrations
  memory_size      = 256
  depends_on       = [aws_iam_role_policy.MigrateDSQLLogging]
  filename         = data.archive_file.MigrateDSQL.output_path
  source_code_hash = data.archive_file.MigrateDSQL.output_base64sha256
  layers           = [local.adot_layer_arn]

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = merge(local.common_lambda_env, {
      OTEL_SERVICE_NAME = local.migrate_dsql_function_name
      DSQL_ROLE_NAME    = local.lambda_dsql_roles["MigrateDSQL"].role_name
      AWS_ACCOUNT_ID    = data.aws_caller_identity.current.account_id
    })
  }

  tags = merge(local.common_tags, {
    Name = local.migrate_dsql_function_name
  })
}

# Invoke the migration Lambda during every deployment
# The Lambda is idempotent - it only applies pending migrations
# and skips already-applied migrations
data "aws_lambda_invocation" "run_migration" {
  function_name = aws_lambda_function.MigrateDSQL.function_name

  # Include source for logging/debugging
  input = jsonencode({
    source = "terraform-deploy"
  })

  depends_on = [
    aws_lambda_function.MigrateDSQL,
    time_sleep.wait_for_dsql
  ]
}

# Output migration results for visibility in Terraform apply output
output "migration_result" {
  description = "Result of database migration"
  value       = jsondecode(data.aws_lambda_invocation.run_migration.result)
}
