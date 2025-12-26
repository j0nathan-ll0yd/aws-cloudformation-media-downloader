# Aurora DSQL Cluster for Media Downloader
# Replaces DynamoDB single-table design with PostgreSQL-compatible serverless database
#
# Aurora DSQL Features:
# - PostgreSQL wire protocol compatible
# - Serverless with automatic scaling
# - No VPC required (eliminates VPC costs)
# - IAM authentication via SigV4
# - Multi-AZ by default
#
# Limitations to consider:
# - No enforced foreign keys (application-layer enforcement required)
# - No JSONB support (normalized tables instead)
# - Max 3000 rows per transaction

resource "aws_dsql_cluster" "media_downloader" {
  deletion_protection_enabled = true

  tags = merge(local.common_tags, {
    Name        = "MediaDownloader-DSQL"
    Description = "Aurora DSQL cluster for Media Downloader entities"
  })
}

# IAM policy for Lambda DSQL access
# Grants dbconnect admin permissions for all Lambdas that access the database
data "aws_iam_policy_document" "dsql_access" {
  statement {
    sid    = "DSQLAccess"
    effect = "Allow"
    actions = [
      "dsql:DbConnectAdmin"
    ]
    resources = [aws_dsql_cluster.media_downloader.arn]
  }
}

resource "aws_iam_policy" "LambdaDSQLAccess" {
  name        = "LambdaDSQLAccess"
  description = "Allows Lambda functions to connect to Aurora DSQL cluster"
  policy      = data.aws_iam_policy_document.dsql_access.json
  tags        = local.common_tags
}

# Output the cluster endpoint for Lambda configuration
output "dsql_cluster_endpoint" {
  description = "Aurora DSQL cluster endpoint for Lambda environment variables"
  value       = aws_dsql_cluster.media_downloader.endpoint
}

output "dsql_cluster_arn" {
  description = "Aurora DSQL cluster ARN for IAM policies"
  value       = aws_dsql_cluster.media_downloader.arn
}
