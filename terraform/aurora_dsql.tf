# Aurora DSQL Cluster for Media Downloader
# Serverless PostgreSQL-compatible database with IAM authentication
# See: https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/issues/196

resource "aws_dsql_cluster" "media_downloader" {
  deletion_protection_enabled = true
  tags = merge(local.common_tags, {
    Name = "MediaDownloader-DSQL"
  })
}

# =============================================================================
# Three-Tier DSQL Access Model
# =============================================================================
# - ReadOnly: SELECT only (ListFiles, S3ObjectCreated)
# - ReadWrite: Full DML (most Lambdas)
# - Admin: Full DDL/DML (MigrateDSQL only)
#
# IAM controls token generation, PostgreSQL roles control actual SQL permissions.
# See migration 0003_create_access_roles.sql for role definitions.
# =============================================================================

# ReadOnly policy - uses custom PostgreSQL role via DbConnect
data "aws_iam_policy_document" "dsql_readonly" {
  statement {
    sid       = "DSQLConnectReadOnly"
    actions   = ["dsql:DbConnect"]
    resources = [aws_dsql_cluster.media_downloader.arn]
  }
}

resource "aws_iam_policy" "LambdaDSQLReadOnly" {
  name        = "LambdaDSQLReadOnly"
  description = "Allows Lambda functions SELECT-only access to Aurora DSQL (uses app_readonly role)"
  policy      = data.aws_iam_policy_document.dsql_readonly.json
  tags        = local.common_tags
}

# ReadWrite policy - uses custom PostgreSQL role via DbConnect
data "aws_iam_policy_document" "dsql_readwrite" {
  statement {
    sid       = "DSQLConnectReadWrite"
    actions   = ["dsql:DbConnect"]
    resources = [aws_dsql_cluster.media_downloader.arn]
  }
}

resource "aws_iam_policy" "LambdaDSQLReadWrite" {
  name        = "LambdaDSQLReadWrite"
  description = "Allows Lambda functions full DML access to Aurora DSQL (uses app_readwrite role)"
  policy      = data.aws_iam_policy_document.dsql_readwrite.json
  tags        = local.common_tags
}

# Admin policy - uses built-in admin user via DbConnectAdmin (migrations only)
data "aws_iam_policy_document" "dsql_admin" {
  statement {
    sid       = "DSQLConnectAdmin"
    actions   = ["dsql:DbConnectAdmin"]
    resources = [aws_dsql_cluster.media_downloader.arn]
  }
}

resource "aws_iam_policy" "LambdaDSQLAdmin" {
  name        = "LambdaDSQLAdmin"
  description = "Allows Lambda functions admin access to Aurora DSQL (MigrateDSQL only)"
  policy      = data.aws_iam_policy_document.dsql_admin.json
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
