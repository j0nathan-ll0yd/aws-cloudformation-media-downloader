# Aurora DSQL Cluster for Media Downloader
# Serverless PostgreSQL-compatible database with IAM authentication
# See: https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/issues/196

resource "aws_dsql_cluster" "media_downloader" {
  deletion_protection_enabled = var.dsql_deletion_protection
  tags = merge(local.common_tags, {
    Name = "${var.resource_prefix}-MediaDownloader-DSQL"
  })

  lifecycle {
    prevent_destroy = true
  }
}

# =============================================================================
# Per-Lambda DSQL Access Model
# =============================================================================
# - Connect: Per-Lambda PostgreSQL roles with fine-grained GRANT permissions
# - AdminConnect: Built-in admin user for DDL (MigrateDSQL only)
#
# IAM controls token generation, PostgreSQL roles control actual SQL permissions.
# Per-Lambda roles and GRANTs defined in migrations/0002_lambda_roles.sql.
# Policy attachments generated in terraform/dsql_permissions.tf.
# =============================================================================

# Connect policy - per-Lambda PostgreSQL roles via DbConnect
data "aws_iam_policy_document" "dsql_connect" {
  statement {
    sid       = "DSQLConnect"
    actions   = ["dsql:DbConnect"]
    resources = [aws_dsql_cluster.media_downloader.arn]
  }
}

resource "aws_iam_policy" "LambdaDSQLConnect" {
  name        = "LambdaDSQLConnect"
  description = "Allows Lambda functions to connect to Aurora DSQL with per-Lambda PostgreSQL roles"
  policy      = data.aws_iam_policy_document.dsql_connect.json
  tags        = local.common_tags
}

# AdminConnect policy - built-in admin user via DbConnectAdmin (migrations only)
data "aws_iam_policy_document" "dsql_admin_connect" {
  statement {
    sid       = "DSQLAdminConnect"
    actions   = ["dsql:DbConnectAdmin"]
    resources = [aws_dsql_cluster.media_downloader.arn]
  }
}

resource "aws_iam_policy" "LambdaDSQLAdminConnect" {
  name        = "LambdaDSQLAdminConnect"
  description = "Allows Lambda functions admin access to Aurora DSQL (MigrateDSQL only)"
  policy      = data.aws_iam_policy_document.dsql_admin_connect.json
  tags        = local.common_tags
}

# Output the cluster endpoint for Lambda configuration
# Aurora DSQL endpoints follow the pattern: <identifier>.dsql.<region>.on.aws
output "dsql_cluster_endpoint" {
  description = "Aurora DSQL cluster endpoint"
  value       = "${aws_dsql_cluster.media_downloader.identifier}.dsql.${data.aws_region.current.id}.on.aws"
}

output "dsql_cluster_arn" {
  description = "Aurora DSQL cluster ARN"
  value       = aws_dsql_cluster.media_downloader.arn
}

# Wait for DSQL cluster to be fully available before running migrations
# Aurora DSQL clusters may take a moment to be connection-ready after creation
resource "time_sleep" "wait_for_dsql" {
  depends_on      = [aws_dsql_cluster.media_downloader]
  create_duration = "30s"
}
