# Aurora DSQL Cluster for Media Downloader
# Serverless PostgreSQL-compatible database with IAM authentication
# See: https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/issues/196

resource "aws_dsql_cluster" "media_downloader" {
  deletion_protection_enabled = true
  tags = merge(local.common_tags, {
    Name = "MediaDownloader-DSQL"
  })
}

# IAM policy for Lambda DSQL access (read/write operations)
data "aws_iam_policy_document" "dsql_access" {
  statement {
    sid       = "DSQLConnect"
    actions   = ["dsql:DbConnect"]
    resources = [aws_dsql_cluster.media_downloader.arn]
  }
}

resource "aws_iam_policy" "LambdaDSQLAccess" {
  name        = "LambdaDSQLAccess"
  description = "Allows Lambda functions to connect to Aurora DSQL"
  policy      = data.aws_iam_policy_document.dsql_access.json
  tags        = local.common_tags
}

# IAM policy for Lambda DSQL admin access (migrations only)
data "aws_iam_policy_document" "dsql_admin_access" {
  statement {
    sid       = "DSQLConnectAdmin"
    actions   = ["dsql:DbConnectAdmin"]
    resources = [aws_dsql_cluster.media_downloader.arn]
  }
}

resource "aws_iam_policy" "LambdaDSQLAdminAccess" {
  name        = "LambdaDSQLAdminAccess"
  description = "Allows Lambda functions admin access to Aurora DSQL (migrations only)"
  policy      = data.aws_iam_policy_document.dsql_admin_access.json
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
