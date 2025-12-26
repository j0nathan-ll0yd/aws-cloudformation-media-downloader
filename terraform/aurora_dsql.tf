# Aurora DSQL Cluster for Media Downloader
# Serverless PostgreSQL-compatible database with IAM authentication
# See: https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/issues/196

resource "aws_dsql_cluster" "media_downloader" {
  deletion_protection_enabled = true
  tags = merge(local.common_tags, {
    Name = "MediaDownloader-DSQL"
  })
}

# IAM policy for Lambda DSQL access
data "aws_iam_policy_document" "dsql_access" {
  statement {
    sid       = "DSQLConnect"
    actions   = ["dsql:DbConnectAdmin"]
    resources = [aws_dsql_cluster.media_downloader.arn]
  }
}

resource "aws_iam_policy" "LambdaDSQLAccess" {
  name        = "LambdaDSQLAccess"
  description = "Allows Lambda functions to connect to Aurora DSQL"
  policy      = data.aws_iam_policy_document.dsql_access.json
  tags        = local.common_tags
}

# Output the cluster endpoint for Lambda configuration
output "dsql_cluster_endpoint" {
  description = "Aurora DSQL cluster endpoint"
  value       = aws_dsql_cluster.media_downloader.endpoint
}

output "dsql_cluster_arn" {
  description = "Aurora DSQL cluster ARN"
  value       = aws_dsql_cluster.media_downloader.arn
}
