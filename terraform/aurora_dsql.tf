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

# Wait for DSQL cluster to be fully available before running migrations
# Aurora DSQL clusters may take a moment to be connection-ready after creation
resource "time_sleep" "wait_for_dsql" {
  depends_on      = [aws_dsql_cluster.media_downloader]
  create_duration = "30s"
}
